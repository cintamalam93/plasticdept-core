// sortir.js
// Versi terbaru: support upload Excel baru, simpan ke root node PhxOutboundJobs, assignment job terhubung node baru
// Komentar sudah ditambahkan pada setiap fungsi dan listener

import { db, authPromise } from "./config.js";
import { ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

/* =========================
    UTILITY / HELPER FUNCTIONS
========================= */

/**
 * Menampilkan notifikasi pada halaman.
 * @param {string} message - Pesan yang akan ditampilkan.
 * @param {boolean} isError - Jika error, notifikasi berwarna merah.
 */
function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.style.display = 'block';
  notification.classList.toggle('error', isError);
  notification.classList.toggle('success', !isError);

  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show', 'error', 'success');
    notification.style.display = 'none';
    notification.textContent = '';
  }, 4000);
}

function savePlanTargetToFirebase(team, target) {
  if (!team || isNaN(target) || target <= 0) {
    showNotification("Data target plan tidak valid.", true);
    return;
  }
  const dbPath = "PlanTarget/" + team;
  set(ref(db, dbPath), target)
    .then(() => {
      showNotification(`Target plan untuk ${team} berhasil disimpan: ${target} kg.`);
    })
    .catch((err) => {
      showNotification("Gagal menyimpan target plan ke database.", true);
      console.error(err);
    });
}

// Fungsi mengatur target plan dari input
function handleSetPlanTarget() {
  const team = planTeamSelector.value;
  const target = parseInt(planTargetInput.value);

  if (isNaN(target) || target <= 0) {
    showNotification("Masukkan nilai target yang valid.", true);
    return;
  }

  savePlanTargetToFirebase(team, target);
  planTargetInput.value = "";
}

/**
 * Fungsi helper untuk membersihkan value agar selalu string.
 */
function sanitizeValue(value) {
  if (typeof value === "object") return "";
  if (typeof value === "function") return "";
  return value ?? "";
}

/**
 * Format tanggal menjadi dd-MMM-yyyy.
 */
function formatToCustomDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format tanggal dari input berbagai tipe ke custom format.
 */
function formatDate(input) {
  if (!input) return "";
  if (typeof input === "number") {
    const date = new Date(Math.round((input - 25569) * 86400 * 1000));
    return formatToCustomDate(date);
  }
  const parsed = new Date(input);
  if (!isNaN(parsed)) {
    return formatToCustomDate(parsed);
  }
  return input;
}

/**
 * Badge color untuk status tertentu.
 */
function badgeForStatus(status) {
  switch (status.toLowerCase()) { // <-- tambahkan .toLowerCase()
    case "newjob": return "badge-info";
    case "downloaded":
    case "picked":
    case "partialpicked": return "badge-warning";
    case "packed":
    case "loaded": return "badge-success";
    case "completed": return "badge-completed"; 
    default: return "badge-info";
  }
}

/**
 * Membuat satu baris (row) untuk table job.
 */
function createTableRow(job) {
  const row = document.createElement("tr");
  const badgeClass = badgeForStatus(job.status);
  row.innerHTML = `
    <td><input type="checkbox" data-jobno="${job.jobNo}"></td>
    <td>${job.jobNo}</td>
    <td>${job.deliveryDate}</td>
    <td>${job.deliveryNote}</td>
    <td>${job.remark}</td>
    <td><span class="badge ${badgeClass}">${job.status}</span></td>
    <td>${Number(job.qty).toLocaleString()}</td>
    <td>${job.team}</td>
    <td class="table-actions">
      <button class="assign">Assign</button>
      <button class="unassign">Unassign</button>
    </td>
  `;

// Fungsi sorting table langsung dari DOM, tetap bisa digunakan
window.sortTableBy = function (key) {
  const tbody = document.querySelector("#jobTable tbody");
  if (!tbody) {
    console.warn("Tbody belum tersedia saat sort dijalankan.");
    return;
  }

  const rows = Array.from(tbody.querySelectorAll("tr"));

  const jobsOnScreen = rows.map(row => {
    const cells = row.querySelectorAll("td");
    return {
      element: row,
      jobNo: cells[1]?.textContent.trim(),
      deliveryDate: cells[2]?.textContent.trim(),
      deliveryNote: cells[3]?.textContent.trim(),
      remark: cells[4]?.textContent.trim(),
      status: cells[5]?.textContent.trim(),
      qty: parseInt(cells[6]?.textContent.replace(/,/g, "") || "0"),
      team: cells[7]?.textContent.trim()
    };
  });

  if (window.sortTableBy.lastKey === key) {
    window.sortTableBy.asc = !window.sortTableBy.asc;
  } else {
    window.sortTableBy.asc = true;
  }
  window.sortTableBy.lastKey = key;

  jobsOnScreen.sort((a, b) => {
    const valA = a[key]?.toUpperCase?.() || "";
    const valB = b[key]?.toUpperCase?.() || "";
    if (valA < valB) return window.sortTableBy.asc ? -1 : 1;
    if (valA > valB) return window.sortTableBy.asc ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = "";
  jobsOnScreen.forEach(job => tbody.appendChild(job.element));
};

  // Listener tombol assign pada baris
  row.querySelector(".assign").addEventListener("click", async (e) => {
  // Cek apakah ada checkbox yang tercentang di tabel (selain yang sedang di-assign)
    const checked = document.querySelectorAll("#jobTable tbody input[type='checkbox']:checked");
    if (checked.length > 0) {
      // Optional: tampilkan notifikasi supaya user tahu kenapa tidak bisa assign
      showNotification("Terdapat checkbox yang tercentang.", true);
      return;
    }
    if (job.team && job.team.trim() !== "") {
      showNotification("⚠️ Job ini sudah di-assign ke team: " + job.team, true);
      return;
    }
    selectedSingleJob = job.jobNo;
    showModal();
  });

  // Listener tombol unassign pada baris
  row.querySelector(".unassign").addEventListener("click", async (e) => {
    const jobNo = job.jobNo;
    const jobRef = ref(db, "PhxOutboundJobs/" + jobNo);
    get(jobRef).then(snapshot => {
      if (!snapshot.exists()) {
        return showNotification("❌ Job tidak ditemukan di database.", true);
      }
      const jobData = snapshot.val();
      if (!jobData.team) {
        return showNotification("⚠️ Job ini belum di-assign ke team manapun.", true);
      }
      showConfirmModal({
        title: "Konfirmasi Unassign",
        message: "Apakah Anda yakin ingin membatalkan assignment job ini?",
        okText: "Unassign",
        okClass: "logout",
        onConfirm: () => {
          update(jobRef, { team: "", jobType: "" })
            .then(() => {
              showNotification("✅ Job berhasil di-unassign.");
              refreshDataWithoutReset();
            })
            .catch(err => {
              showNotification("❌ Gagal menghapus assignment job.", true);
            });
        }
      });
    });
  });

  return row;
}

/**
 * Modal konfirmasi (reusable)
 */
function showConfirmModal({ title = "Konfirmasi", message = "Apakah Anda yakin?", okText = "OK", cancelText = "Batal", okClass = "", onConfirm, onCancel }) {
  const modal = document.getElementById("confirmModal");
  const titleElem = document.getElementById("confirmModalTitle");
  const msgElem = document.getElementById("confirmModalMessage");
  const okBtn = document.getElementById("okConfirmBtn");
  const cancelBtn = document.getElementById("cancelConfirmBtn");

  titleElem.textContent = title;
  msgElem.innerHTML = message;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;

  okBtn.className = "modal-btn";
  if (okClass) okBtn.classList.add(okClass);

  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);
  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  newOkBtn.onclick = () => {
    modal.style.display = "none";
    if (typeof onConfirm === "function") onConfirm();
  };
  newCancelBtn.onclick = () => {
    modal.style.display = "none";
    if (typeof onCancel === "function") onCancel();
  };

  modal.style.display = "block";
  window.addEventListener("click", function handler(e) {
    if (e.target === modal) {
      modal.style.display = "none";
      window.removeEventListener("click", handler);
    }
  });
}

/**
 * Menyiapkan opsi filter tanggal pada dropdown.
 */
function populateDateOptions(dates) {
  dateOptions.innerHTML = '<option value="all">-- Show All --</option>';
  [...dates].sort().forEach(date => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    dateOptions.appendChild(option);
  });
}

/**
 * Menyiapkan opsi filter team pada dropdown.
 */
function populateTeamOptions(teams) {
  teamOptions.innerHTML = '<option value="all">-- Show All --</option>';
  const uniqueTeams = new Set(teams);
  uniqueTeams.forEach(team => {
    const value = team.trim() === "" ? "none" : team;
    const label = team.trim() === "" ? "None/blank" : team;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    teamOptions.appendChild(option);
  });
}

/**
 * Mengambil data job yang dipilih (checked).
 */
function getSelectedJobs() {
  const checkboxes = document.querySelectorAll("tbody input[type='checkbox']:checked");
  return Array.from(checkboxes).map(cb => cb.getAttribute("data-jobno"));
}

/**
 * Menampilkan modal assign.
 */
function showModal() { modal.style.display = "block"; }
/**
 * Menyembunyikan modal assign.
 */
function hideModal() { modal.style.display = "none"; }

/**
 * Menghapus semua job di node PhxOutboundJobs.
 */
function clearAllJobs() {
  showConfirmModal({
    title: "Konfirmasi Hapus Semua",
    message: "Apakah Anda yakin ingin <b>MENGHAPUS SEMUA</b> job dan plan target dari database?",
    okText: "Hapus",
    okClass: "logout",
    onConfirm: () => {
      const outboundRef = ref(db, "PhxOutboundJobs");
      
      // Jalankan penghapusan paralel
      remove(outboundRef)
        .then(() => {
          showNotification("✅ Semua job dan plan target berhasil dihapus.");
          loadJobsFromFirebase(); // Pastikan fungsi ini tidak tergantung PlanTarget
        })
        .catch((err) => {
          console.error(err);
          showNotification("❌ Gagal menghapus data!", true);
        });
    }
  });
}

/* =========================
   HANDLE EXCEL FILE UPLOAD
========================= */

/**
 * Fungsi parsing file Excel sesuai struktur baru.
 * Header di row ke-4, data mulai row ke-5.
 * Field mapping: JobNo, ETD, DeliveryNoteNo, RefNo., Status, BCNo
 */
function parseExcel(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      let json = [];
      if (currentMode === "phoenix") {
        // --- PHOENIX MODE ---
        const headerIndex = 2;
        const headers = sheetData[headerIndex];
        if (!headers) {
          showNotification("Header tidak ditemukan pada baris ke-3. Pastikan format file Phoenix benar.", true);
          fileInput.value = "";
          return;
        }
        const colIndex = {
          JobNo: headers.findIndex(h => h.trim().toLowerCase() === "job no."),
          ETD: headers.findIndex(h => h.trim().toLowerCase() === "etd"),
          DeliveryNoteNo: headers.findIndex(h => h.trim().toLowerCase() === "delivery note no."),
          RefNo: headers.findIndex(h => h.trim().toLowerCase() === "ref no."),
          Status: headers.findIndex(h => h.trim().toLowerCase() === "status"),
          BCNo: headers.findIndex(h => h.trim().toLowerCase() === "bc no."),
        };
        const requiredKeys = Object.keys(colIndex);
        const missingHeaders = requiredKeys.filter(key => colIndex[key] === -1);
        if (missingHeaders.length > 0) {
          showNotification(
            "File yang Anda upload tidak sesuai dengan sistem yang dipilih. Silakan pilih file yang benar.",
            true
          );
          fileInput.value = "";
          return;
        }
        const rows = sheetData.slice(headerIndex + 1);
        json = rows
          .map(row => ({
            JobNo: row[colIndex.JobNo] ?? "",
            ETD: row[colIndex.ETD] ?? "",
            DeliveryNoteNo: row[colIndex.DeliveryNoteNo] ?? "",
            RefNo: row[colIndex.RefNo] ?? "",
            Status: row[colIndex.Status] ?? "",
            BCNo: row[colIndex.BCNo] ?? ""
          }))
          .filter(job => job.JobNo && job.JobNo.trim() !== "");
      } else if (currentMode === "zlogix") {
        // --- Z-LOGIX MODE ---
        // Cari baris header (yang mengandung "Job No" dsb)
        let headerIndex = -1;
        for (let i = 0; i < sheetData.length; i++) {
          if (
            sheetData[i].some(h =>
              typeof h === "string" && h.trim().toLowerCase() === "job no"
            )
          ) {
            headerIndex = i;
            break;
          }
        }
        if (headerIndex === -1) {
          showNotification("Header tidak ditemukan pada file Z-Logix. Pastikan format file benar.", true);
          fileInput.value = "";
          return;
        }
        const headers = sheetData[headerIndex];
        const colIndex = {
          JobNo: headers.findIndex(h => h.trim().toLowerCase() === "job no"),
          DeliveryDate: headers.findIndex(h => h.trim().toLowerCase() === "delivery date"),
          DeliveryNote: headers.findIndex(h => h.trim().toLowerCase() === "delivery note"),
          Remark: headers.findIndex(h => h.trim().toLowerCase() === "remark"),
          PlanQty: headers.findIndex(h => h.trim().toLowerCase() === "plan qty"),
          Status: headers.findIndex(h => h.trim().toLowerCase() === "status"),
        };
        const requiredKeys = Object.keys(colIndex);
        const missingHeaders = requiredKeys.filter(key => colIndex[key] === -1);
        if (missingHeaders.length > 0) {
          showNotification(
            `File tidak bisa diproses. Pastikan header berikut ada dan benar penulisannya: ${missingHeaders.join(", ")}`,
            true
          );
          fileInput.value = "";
          return;
        }
        const rows = sheetData.slice(headerIndex + 1);
        json = rows
          .map(row => ({
            JobNo: row[colIndex.JobNo] ?? "",
            ETD: row[colIndex.DeliveryDate] ?? "",
            DeliveryNoteNo: row[colIndex.DeliveryNote] ?? "",
            RefNo: row[colIndex.Remark] ?? "",
            Status: row[colIndex.Status] ?? "",
            BCNo: row[colIndex.PlanQty] ?? ""
          }))
          .filter(job => job.JobNo && job.JobNo.trim() !== "");
      } else {
        showNotification("Mode tidak valid.", true);
        return;
      }

      syncJobsToFirebase(json);

    } catch (err) {
      console.error("ERROR parsing Excel:", err);
      showNotification("Terjadi kesalahan saat membaca file Excel.", true);
    }
    fileInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}
/**
 * Simpan data hasil parsing ke PhxOutboundJobs di Firebase.
 * Jika ada job di database yang tidak ada di data baru, status-nya diubah menjadi "Completed".
 */
function syncJobsToFirebase(jobs) {
  // 1. Ambil semua jobNo dari data baru
  const newJobNos = jobs.map(job => sanitizeValue(job.JobNo)).filter(jn => jn && !/[.#$\[\]]/.test(jn));

  // 2. Ambil semua job di database
  get(ref(db, "PhxOutboundJobs")).then(snapshot => {
    const existingJobs = snapshot.exists() ? snapshot.val() : {};
    const existingJobNos = Object.keys(existingJobs);

    // 3. Cari jobNo yang tidak ada di data baru
    const missingJobNos = existingJobNos.filter(jobNo => !newJobNos.includes(jobNo));

    // 4. Update status job yang tidak ada di data baru menjadi "Completed"
    const updateMissing = missingJobNos.map(jobNo =>
      update(ref(db, "PhxOutboundJobs/" + jobNo), { status: "Completed" })
    );

    // 5. Upload/update data baru
    let uploadCount = 0;
    let errorCount = 0;
    const uploadJobs = jobs.map(job => {
      const jobNo = sanitizeValue(job.JobNo);
      if (!jobNo || /[.#$\[\]]/.test(jobNo)) return Promise.resolve();
      const formattedDate = formatDate(job.ETD);
      const jobRef = ref(db, "PhxOutboundJobs/" + jobNo);
      return get(jobRef).then(existingSnap => {
        const existing = existingSnap.exists() ? existingSnap.val() : {};
        const jobData = {
          jobNo,
          deliveryDate: sanitizeValue(formattedDate),
          deliveryNote: sanitizeValue(job.DeliveryNoteNo),
          remark: sanitizeValue(job.RefNo),
          status: sanitizeValue(job.Status),
          qty: sanitizeValue(job.BCNo),
          team: existing.team || "",
          jobType: existing.jobType || ""
        };
        return set(jobRef, jobData);
      })
      .then(() => { uploadCount++; })
      .catch(() => { errorCount++; });
    });

    // 6. Setelah semua selesai, tampilkan notifikasi & refresh
    Promise.all([...updateMissing, ...uploadJobs]).then(() => {
      showNotification("Upload selesai. Berhasil: " + uploadCount + ", Gagal: " + errorCount);
      loadJobsFromFirebase();
    });
  });
}

/**
 * Load jobs dari node baru PhxOutboundJobs ke tabel assignment.
 */
function loadJobsFromFirebase() {
  jobTable.innerHTML = "";
  allJobsData = [];
  get(ref(db, "PhxOutboundJobs"))
    .then(snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const uniqueDates = new Set();
        const uniqueTeams = new Set();
        Object.values(data).forEach(job => {
          allJobsData.push(job);
          const row = createTableRow(job);
          jobTable.appendChild(row);
          uniqueDates.add(job.deliveryDate);
          uniqueTeams.add(job.team || "");
        });
        populateDateOptions(uniqueDates);
        populateTeamOptions(uniqueTeams);
      }
    })
    .catch(() => {
      showNotification("Gagal mengambil data dari Firebase.", true);
    });
}

/**
 * Refresh data tanpa reset filter (setelah assign/unassign).
 */
function refreshDataWithoutReset() {
  get(ref(db, "PhxOutboundJobs")).then(snapshot => {
    const data = snapshot.val();
    jobTable.innerHTML = "";
    allJobsData = [];
    if (data) {
      const uniqueDates = new Set();
      const uniqueTeams = new Set();
      Object.values(data).forEach(job => {
        allJobsData.push(job);
        uniqueDates.add(job.deliveryDate);
        uniqueTeams.add(job.team || "");
      });
      applyMultiFilter();
      updateFilterIndicator();
    }
  });
}

/**
 * Filter multi (status, tanggal, team) pada tabel assignment.
 */
function applyMultiFilter() {
  const selectedStatus = statusOptions.value;
  const selectedDate = dateOptions.value;
  const selectedTeam = teamOptions.value;
  jobTable.innerHTML = "";
  filteredJobs = [];
  allJobsData.forEach(job => {
    const matchStatus = selectedStatus === "all" || job.status === selectedStatus;
    const matchDate = selectedDate === "all" || job.deliveryDate === selectedDate;
    const isBlankTeam = !job.team || job.team.toLowerCase() === "none";
    const matchTeam = selectedTeam === "all" || (selectedTeam === "none" && isBlankTeam) || job.team === selectedTeam;
    if (matchStatus && matchDate && matchTeam) {
      jobTable.appendChild(createTableRow(job));
      filteredJobs.push(job);
    }
  });
}

/**
 * Update indikator filter aktif di halaman.
 */
function updateFilterIndicator() {
  const status = statusOptions.value;
  const date = dateOptions.value;
  const team = teamOptions.value;
  const filters = [];
  if (status !== "all") filters.push(`Status: ${status}`);
  if (date !== "all") filters.push(`Date: ${date}`);
  if (team !== "all") filters.push(`Team: ${team === "none" ? "None/blank" : team}`);
  const filterIndicator = document.getElementById("filterIndicator");
  if (filters.length > 0) {
    filterIndicator.textContent = "Filtered by: " + filters.join(" | ");
  } else {
    filterIndicator.textContent = "";
  }
}

/**
 * Tutup semua dropdown filter.
 */
function closeAllDropdowns() {
  statusDropdown.style.display = "none";
  dateDropdown.style.display = "none";
  teamDropdown.style.display = "none";
}

/**
 * Fungsi untuk navigasi (jika digunakan).
 */
window.navigateTo = function (page) {
  window.location.href = page;
};

/* =========================
    INISIALISASI & EVENT LISTENER
========================= */

// Ambil semua elemen DOM yang diperlukan
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const jobTable = document.getElementById("jobTable").getElementsByTagName("tbody")[0];
const bulkAddBtn = document.getElementById("bulkAddBtn");
const modal = document.getElementById("addModal");
const closeModal = document.getElementById("closeModal");
const confirmAdd = document.getElementById("confirmAdd");
const selectAllCheckbox = document.getElementById("selectAll");
const sortStatusBtn = document.getElementById("sortStatusBtn");
const statusDropdown = document.getElementById("statusDropdown");
const statusOptions = document.getElementById("statusOptions");
const sortDateBtn = document.getElementById("sortDateBtn");
const dateDropdown = document.getElementById("dateDropdown");
const dateOptions = document.getElementById("dateOptions");
const sortTeamBtn = document.getElementById("sortTeamBtn");
const teamDropdown = document.getElementById("teamDropdown");
const teamOptions = document.getElementById("teamOptions");
const planTargetInput = document.getElementById("planTargetInput");
const planTeamSelector = document.getElementById("planTeamSelector");
const setPlanTargetBtn = document.getElementById("setPlanTargetBtn");
const manPowerInput = document.getElementById("manPowerInput");
const manPowerTeamSelector = document.getElementById("manPowerTeamSelector");
const setManPowerBtn = document.getElementById("setManPowerBtn");

let selectedSingleJob = null;
let allJobsData = [];
let filteredJobs = [];
let currentSort = { key: null, asc: true };
let currentMode = "phoenix"; // default

// Ambil mode dari localStorage jika ada
const savedMode = localStorage.getItem("outboundSystemMode");
if (savedMode === "zlogix" || savedMode === "phoenix") {
  currentMode = savedMode;
  document.getElementById("modePhoenix").checked = savedMode === "phoenix";
  document.getElementById("modeZLogix").checked = savedMode === "zlogix";
}

// Listener tombol set plan target (jika masih digunakan)
setPlanTargetBtn?.addEventListener("click", handleSetPlanTarget);

// Listener tombol set man power
setManPowerBtn?.addEventListener("click", handleSetManPower);

// --- Fungsi Set Man Power ---
function saveManPowerToFirebase(team, manPower) {
  if (!team || isNaN(manPower) || manPower <= 0) {
    showNotification("Data man power tidak valid.", true);
    return;
  }
  const dbPath = "ManPower/" + team;
  set(ref(db, dbPath), manPower)
    .then(() => {
      showNotification(`Man Power untuk ${team} berhasil disimpan: ${manPower} orang.`);
    })
    .catch((err) => {
      showNotification("Gagal menyimpan man power ke database.", true);
      console.error(err);
    });
}
function handleSetManPower() {
  const team = manPowerTeamSelector.value;
  const manPower = parseInt(manPowerInput.value);

  if (isNaN(manPower) || manPower <= 0) {
    showNotification("Masukkan jumlah man power yang valid.", true);
    return;
  }
  saveManPowerToFirebase(team, manPower);
  manPowerInput.value = "";
}

// Fungsi simpan MP Overtime ke Firebase
function saveMpOvertimeToFirebase(mpOvertime) {
  if (isNaN(mpOvertime) || mpOvertime < 0) {
    showNotification("Masukkan jumlah man power overtime yang valid.", true);
    return;
  }
  set(ref(db, "ManPowerOvertime"), mpOvertime)
    .then(() => {
      showNotification(`Man Power Overtime berhasil disimpan: ${mpOvertime} orang.`);
    })
    .catch((err) => {
      showNotification("Gagal menyimpan man power overtime ke database.", true);
      console.error(err);
    });
}
function handleSetMpOvertime() {
  const mpOvertime = parseInt(document.getElementById("mpOvertimeInput").value);
  if (isNaN(mpOvertime) || mpOvertime < 0) {
    showNotification("Masukkan jumlah man power overtime yang valid.", true);
    return;
  }
  saveMpOvertimeToFirebase(mpOvertime);
  document.getElementById("mpOvertimeInput").value = "";
}
document.getElementById("setMpOvertimeBtn")?.addEventListener("click", handleSetMpOvertime);

// Listener upload file Excel baru
uploadBtn.addEventListener("click", () => {
  const file = fileInput.files[0];
  if (file) {
    parseExcel(file);
  } else {
    showNotification("Pilih file Excel terlebih dahulu.", true);
  }
});

// Listener tombol bulk assign
bulkAddBtn.addEventListener("click", async () => {
  const selectedJobs = getSelectedJobs();
  if (selectedJobs.length === 0) {
    showNotification("Pilih minimal satu job.", true);
    return;
  }
  let jobsWithTeam = [];
  await Promise.all(
    selectedJobs.map(async (jobNo) => {
      const jobRef = ref(db, "PhxOutboundJobs/" + jobNo);
      const snap = await get(jobRef);
      if (snap.exists()) {
        const data = snap.val();
        if (data.team && data.team.trim() !== "") {
          jobsWithTeam.push({ jobNo, team: data.team });
        }
      }
    })
  );
  if (jobsWithTeam.length > 0) {
    showNotification(
      "Terdapat job yang sudah di-assign ke team dan tidak dapat lanjut bulk assign:\n" +
      jobsWithTeam.map(j => `- ${j.jobNo} (Team: ${j.team})`).join("\n"),
      true
    );
    return;
  }
  selectedSingleJob = null;
  window.jobsToBulkAssign = selectedJobs;
  showModal();
});

// Listener tombol assign di modal
confirmAdd.addEventListener("click", async () => {
  const team = document.getElementById("teamSelect").value;
  const jobType = document.getElementById("jobTypeSelect").value;
  const jobsToUpdate =
    window.jobsToBulkAssign && Array.isArray(window.jobsToBulkAssign) && window.jobsToBulkAssign.length > 0
      ? window.jobsToBulkAssign
      : (selectedSingleJob ? [selectedSingleJob] : getSelectedJobs());
  const loadingIndicator = document.getElementById("loadingIndicator");

  if (jobsToUpdate.length === 0) return showNotification("Tidak ada job yang dipilih.", true);

  loadingIndicator.style.display = "block";
  confirmAdd.disabled = true;

  try {
    await Promise.all(
      jobsToUpdate.map(jobNo =>
        update(ref(db, "PhxOutboundJobs/" + jobNo), { team, jobType })
      )
    );
    showNotification(`Job berhasil ditambahkan ke team: ${team}`);
    selectedSingleJob = null;
    window.jobsToBulkAssign = null;
    hideModal();
    refreshDataWithoutReset();
  } catch (error) {
    showNotification("Gagal menyimpan data ke Firebase.", true);
  } finally {
    loadingIndicator.style.display = "none";
    confirmAdd.disabled = false;
  }
});

// Listener select all checkbox
selectAllCheckbox.addEventListener("change", (e) => {
  document.querySelectorAll("tbody input[type='checkbox']")
    .forEach(cb => cb.checked = e.target.checked);
});

// Listener tombol close modal
closeModal.addEventListener("click", hideModal);

// Listener klik di luar modal untuk menutup
window.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
// Listener tombol escape key untuk menutup modal
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideModal(); });

// Listener sorting & filter dropdown
sortStatusBtn.addEventListener("click", () => {
  const isCurrentlyOpen = statusDropdown.style.display === "block";
  closeAllDropdowns();
  if (!isCurrentlyOpen) {
    statusDropdown.style.display = "block";
  }
});
sortDateBtn.addEventListener("click", () => {
  const isCurrentlyOpen = dateDropdown.style.display === "block";
  closeAllDropdowns();
  if (!isCurrentlyOpen) {
    dateDropdown.style.display = "block";
  }
});
sortTeamBtn.addEventListener("click", () => {
  const isCurrentlyOpen = teamDropdown.style.display === "block";
  closeAllDropdowns();
  if (!isCurrentlyOpen) {
    teamDropdown.style.display = "block";
  }
});
statusOptions.addEventListener("change", () => {
  applyMultiFilter();
  updateFilterIndicator();
  statusDropdown.style.display = "none";
});
dateOptions.addEventListener("change", () => {
  applyMultiFilter();
  updateFilterIndicator();
  dateDropdown.style.display = "none";
});
teamOptions.addEventListener("change", () => {
  applyMultiFilter();
  updateFilterIndicator();
  teamDropdown.style.display = "none";
});

// Listener tombol clear database
document.getElementById("clearDatabaseBtn").addEventListener("click", clearAllJobs);

// ========== EXPORT EXCEL (Sugity & Reguler) ==========
document.getElementById("exportExcelBtn").addEventListener("click", () => {
  get(ref(db, "PhxOutboundJobs")).then(snapshot => {
    if (!snapshot.exists()) {
      showNotification("Tidak ada data untuk di-export.", true);
      return;
    }
    const data = snapshot.val();
    const filtered = Object.values(data).filter(j =>
      j.team && (j.team.toLowerCase() === "sugity" || j.team.toLowerCase() === "reguler")
    );
    if (filtered.length === 0) {
      showNotification("Tidak ada job yang sudah assign ke Sugity/Reguler.", true);
      return;
    }

    // 1. Date Stamp (row 1)
    const now = new Date();
    const dateStr = now.toLocaleString("en-GB", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).replace(",", "");
    const datestampRow = ["Exported: " + dateStr];

    // 2. Qty Target (row 2, jumlah total qty)
    const totalQty = filtered.reduce((sum, j) => sum + (j.qty !== undefined && j.qty !== null && !isNaN(Number(j.qty)) ? Number(j.qty) : 0), 0);
    const totalQtyFormatted = totalQty.toLocaleString("en-US") + " kg";
    const qtyTotalRow = ["Qty Target: " + totalQtyFormatted];

    // 3. Header
    const header = [
      "Job No", "Delivery Date", "Delivery Note",
      "Remark", "Status", "Qty", "Type Job", "Team"
    ];

    // 4. Data rows, qty as number, type job
    const rows = filtered.map(j => [
      j.jobNo || "",
      j.deliveryDate || "",
      j.deliveryNote || "",
      j.remark || "",
      j.status || "",
      j.qty !== undefined && j.qty !== null && !isNaN(Number(j.qty)) ? Number(j.qty) : 0,
      j.jobType || "",
      j.team || ""
    ]);
    // 5. Gabungkan semua data
    const ws_data = [datestampRow, qtyTotalRow, header, ...rows];

    // 6. Buat worksheet
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // 7. Styling
    const headerRow = 2; // baris ke-3 (0-based)
    const totalCols = header.length;
    const totalRows = ws_data.length;
    const borderStyle = {
      top:    { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left:   { style: "thin", color: { rgb: "000000" } },
      right:  { style: "thin", color: { rgb: "000000" } }
    };

    // Style header: kuning, bold, border
    for (let c = 0; c < totalCols; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: headerRow, c });
      if (!ws[cellAddr]) continue;
      ws[cellAddr].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "FFF59D" } }, // kuning terang
        border: borderStyle,
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    // Style border all data (data rows)
    for (let r = headerRow + 1; r < totalRows; r++) {
      for (let c = 0; c < totalCols; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddr]) continue;
        ws[cellAddr].s = ws[cellAddr].s || {};
        ws[cellAddr].s.border = borderStyle;
        if (c === 5) { // Qty kolom
          ws[cellAddr].z = "#,##0";
        }
      }
    }
    // Style border for datestamp & qtyTotal row (baris 0 dan 1)
    for (let c = 0; c < totalCols; c++) {
      // Date stamp
      const cellAddr0 = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cellAddr0]) ws[cellAddr0] = { t: "s", v: "" };
      ws[cellAddr0].s = ws[cellAddr0].s || {};
      ws[cellAddr0].s.border = borderStyle;

      // Qty Total
      const cellAddr1 = XLSX.utils.encode_cell({ r: 1, c });
      if (!ws[cellAddr1]) ws[cellAddr1] = { t: "s", v: "" };
      ws[cellAddr1].s = ws[cellAddr1].s || {};
      ws[cellAddr1].s.border = borderStyle;
    }
    // Merge date stamp row & qty total row
    ws["!merges"] = ws["!merges"] || [];
    ws["!merges"].push({
      s: { r: 0, c: 0 },
      e: { r: 0, c: totalCols - 1 }
    });
    ws["!merges"].push({
      s: { r: 1, c: 0 },
      e: { r: 1, c: totalCols - 1 }
    });

    // Optional: Autosize columns
    ws["!cols"] = header.map(h => ({ wch: Math.max(10, h.length + 4) }));

    // 8. Workbook & Download
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TargetJob");
    XLSX.writeFile(wb, "target-job-assigned.xlsx");
  });
});

// ========== Logout Modal ==========
const headerLogoutBtn = document.getElementById("headerLogoutBtn");
const logoutModal = document.getElementById("logoutModal");
const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

// Listener tombol logout
headerLogoutBtn?.addEventListener("click", () => {
  logoutModal.style.display = "block";
});
cancelLogoutBtn?.addEventListener("click", () => {
  logoutModal.style.display = "none";
});
confirmLogoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../index.html"; // ✅ Dari /outbound/monitoring-control/ balik ke /outbound/index.html
});
window.addEventListener("click", (e) => {
  if (e.target === logoutModal) {
    logoutModal.style.display = "none";
  }
});

// SHIFT TOGGLE LOGIC
const shiftDayRadio = document.getElementById("shiftDay");
const shiftNightRadio = document.getElementById("shiftNight");

// Load saved shift on page load
const savedShiftType = localStorage.getItem("shiftType") || "Day";
if (savedShiftType === "Night") {
  shiftNightRadio.checked = true;
  shiftDayRadio.checked = false;
} else {
  shiftDayRadio.checked = true;
  shiftNightRadio.checked = false;
}
localStorage.setItem("shiftType", savedShiftType); // ensure always set

shiftDayRadio.addEventListener("change", function() {
  if (this.checked) localStorage.setItem("shiftType", "Day");
});
shiftNightRadio.addEventListener("change", function() {
  if (this.checked) localStorage.setItem("shiftType", "Night");
});

// Tampilkan shift dari localStorage di bagian user profile
const shiftValue = localStorage.getItem("shift");
const userShiftSpan = document.getElementById("userShift");

if (shiftValue && userShiftSpan) {
  userShiftSpan.textContent = shiftValue;
}

// (Opsional) Ganti huruf avatar jadi huruf awal shift
const userInitialSpan = document.getElementById("userInitial");
if (shiftValue && userInitialSpan) {
  userInitialSpan.textContent = shiftValue.charAt(0).toUpperCase();
}

// 🔐 Role-based UI protection
const position = localStorage.getItem("position");

if (position === "Asst. Manager" || position === "Manager") {
  const setTargetBtn = document.getElementById("setPlanTargetBtn");
  const uploadExcelBtn = document.getElementById("uploadBtn");
  const deleteDataBtn = document.getElementById("clearDatabaseBtn");

  if (setTargetBtn) setTargetBtn.style.display = "none";
  if (uploadExcelBtn) uploadExcelBtn.style.display = "none";
  if (deleteDataBtn) deleteDataBtn.style.display = "none";
}

// Mode switcher
document.getElementById("modePhoenix").addEventListener("change", function() {
  if (this.checked) {
    currentMode = "phoenix";
    localStorage.setItem("outboundSystemMode", "phoenix"); // simpan ke localStorage
    populateStatusOptions(currentMode);
    applyMultiFilter();
    updateFilterIndicator();
  }
});
document.getElementById("modeZLogix").addEventListener("change", function() {
  if (this.checked) {
    currentMode = "zlogix";
    localStorage.setItem("outboundSystemMode", "zlogix"); // simpan ke localStorage
    populateStatusOptions(currentMode);
    applyMultiFilter();
    updateFilterIndicator();
  }
});


authPromise.then(() => {
  populateStatusOptions(currentMode);
  loadJobsFromFirebase();
});

const STATUS_OPTIONS = {
  phoenix: [
    "Pending Allocation",
    "Partial Allocation",
    "Pending Pick",
    "Partial Picked",
    "Pending Pack",
    "Partial Pack",
    "Packed",
    "Loading",
    "Completed"
  ],
  zlogix: [
    "NewJob",
    "Downloaded",
    "PartialDownloaded",
    "PartialPicked",
    "Picked",
    "Packed",
    "Loaded",
    "Completed"
  ]
};

function populateStatusOptions(mode) {
  statusOptions.innerHTML = '<option value="all">-- Show All --</option>';
  STATUS_OPTIONS[mode].forEach(status => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusOptions.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // Ambil nama dari localStorage (sudah di-set di proses login: localStorage.setItem("pic", user.Name || username);)
  const userName = localStorage.getItem('pic') || 'User';
  function getInitials(name) {
    return name.split(' ').map(part => part[0]).join('').toUpperCase();
  }
  const userAvatar = document.getElementById('userAvatar');
  const userFullName = document.getElementById('userFullName');
  if (userAvatar) userAvatar.textContent = getInitials(userName);
  if (userFullName) userFullName.textContent = userName;
});

// Kumpulkan mapping nama ke userID (ambil dari key node, bukan isi objek)==================================================================================
let picUserMap = {}; // { name: { userID, name } }

async function populateMpPicSelector() {
  const shift = (localStorage.getItem("shift") || "").toLowerCase();
  const mpPicSelector = document.getElementById("mpPicSelector");
  if (!mpPicSelector) return;

  mpPicSelector.innerHTML = '<option value="">-- Pilih PIC --</option>';
  const snapshot = await get(ref(db, "users"));
  if (!snapshot.exists()) return;
  const usersRaw = snapshot.val();
  // usersRaw: { "100159": { Name: "Rizki Aldiansyah", ... }, ... }

  let filtered = [];
  Object.entries(usersRaw).forEach(([userID, userObj]) => {
    const s = (userObj.Shift || "").toLowerCase();
    // Logika filter shift:
    if (
      (shift === "green team" && (s === "green team" || s.includes("non shift"))) ||
      (shift === "blue team" && (s === "blue team" || s.includes("non shift"))) ||
      ((shift === "non shift" || shift === "non-shift" || shift === "nonshift") && (
        s === "green team" || s === "blue team" || s.includes("non shift")
      )) ||
      (!["green team", "blue team", "non shift", "nonshift", "non-shift"].includes(shift)) // default: tampilkan semua
    ) {
      filtered.push({ ...userObj, userID });
    }
  });

  // Bangun mapping nama ke userID dan render option
  picUserMap = {};
  filtered.forEach(u => {
    const name = u.Name || u.Username || "";
    if (name) {
      picUserMap[name] = {
        userID: u.userID,
        name: name
      };
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      mpPicSelector.appendChild(opt);
    }
  });
}

// Handler tombol Set MP PIC
document.getElementById("setMpPicBtn")?.addEventListener("click", async function() {
  const mpPicSelector = document.getElementById("mpPicSelector");
  const selectedName = mpPicSelector.value;
  const team = document.getElementById("mpPicTeamSelector")?.value || "";
  if (!selectedName || !picUserMap[selectedName]) {
    showNotification("Pilih PIC yang valid.", true);
    return;
  }
  const { userID, name } = picUserMap[selectedName];
  if (!userID) {
    showNotification("User ID PIC tidak ditemukan.", true);
    return;
  }

  // ==== CEK JUMLAH MP PIC DI TEAM INI ====
  try {
    const snapshot = await get(ref(db, "MPPIC"));
    let countForTeam = 0;
    if (snapshot.exists()) {
      const mpPicData = snapshot.val();
      countForTeam = Object.values(mpPicData).filter(entry => entry.team === team).length;
    }
    if (countForTeam >= 2) {
      showNotification(`Maksimal MP PIC untuk Team ${team} sudah 2 orang!`, true);
      return;
    }

    // ==== LANJUTKAN SET ====
    const waktu_set = new Date().toISOString();
    await set(ref(db, `MPPIC/${userID}`), {
      name,
      userID,
      waktu_set,
      team
    });
    showNotification(`PIC ${name} (${userID}) berhasil diset!`);
  } catch (err) {
    showNotification("Gagal menyimpan PIC ke database.", true);
    console.error(err);
  }
});

document.addEventListener("DOMContentLoaded", populateMpPicSelector);

//==============================================================================================================================
// Global state for current sort
let mpPicSortOrder = 'team'; // 'team' or 'name'
let mpPicSortAsc = true;

// Render tabel MP PIC aktif
async function renderMpPicListTable() {
  const mpPicListTable = document.getElementById('mpPicListTable').querySelector('tbody');
  if (!mpPicListTable) return;
  // Ambil semua data (bukan filter berdasarkan team saja)
  mpPicListTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
  try {
    const snapshot = await get(ref(db, "MPPIC"));
    let data = [];
    if (snapshot.exists()) {
      const mpPicData = snapshot.val();
      data = Object.values(mpPicData)
        .map(entry => ({
          name: entry.name,
          team: entry.team,
          userID: entry.userID
        }));
    }
    // Sort logic
    data.sort((a, b) => {
      let cmp = 0;
      if (mpPicSortOrder === 'team') {
        cmp = (a.team || '').localeCompare(b.team || '');
        if (cmp === 0) cmp = (a.name || '').localeCompare(b.name || '');
      } else {
        cmp = (a.name || '').localeCompare(b.name || '');
      }
      return mpPicSortAsc ? cmp : -cmp;
    });

    if (data.length === 0) {
      mpPicListTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada MP PIC</td></tr>';
      return;
    }
    mpPicListTable.innerHTML = "";
    data.forEach(entry => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.name}</td>
        <td>${entry.team}</td>
        <td>${entry.userID}</td>
        <td>
          <button type="button" class="hapus-mp-pic-btn" data-userid="${entry.userID}">Hapus</button>
        </td>
      `;
      mpPicListTable.appendChild(tr);
    });

    // Add event listener untuk hapus
    mpPicListTable.querySelectorAll('.hapus-mp-pic-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const userID = this.getAttribute('data-userid');
        if (!userID) return;
        if (confirm("Hapus MP PIC ini?")) {
          await remove(ref(db, `MPPIC/${userID}`));
          showNotification("MP PIC berhasil dihapus.");
          renderMpPicListTable();
        }
      });
    });

  } catch (err) {
    mpPicListTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Gagal memuat data.</td></tr>';
  }
}

// Tambah fitur sort pada judul kolom Team
function addMpPicTableSortListeners() {
  const ths = document.querySelectorAll('#mpPicListTable th');
  if (!ths.length) return;
  // Team column (index 1) = sort by team
  // Nama PIC column (index 0) = sort by name
  ths[1]?.addEventListener('click', function() {
    if (mpPicSortOrder === 'team') {
      mpPicSortAsc = !mpPicSortAsc;
    } else {
      mpPicSortOrder = 'team';
      mpPicSortAsc = true;
    }
    renderMpPicListTable();
  });
  ths[0]?.addEventListener('click', function() {
    if (mpPicSortOrder === 'name') {
      mpPicSortAsc = !mpPicSortAsc;
    } else {
      mpPicSortOrder = 'name';
      mpPicSortAsc = true;
    }
    renderMpPicListTable();
  });
}

// Inisialisasi setelah DOM ready
document.addEventListener("DOMContentLoaded", () => {
  renderMpPicListTable();
  addMpPicTableSortListeners();
});

// Setelah tambah/hapus MP PIC, panggil renderMpPicListTable();