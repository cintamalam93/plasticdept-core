// sortir.js
// Versi terbaru: support upload Excel baru, simpan ke root node PhxOutboundJobs, assignment job terhubung node baru
// Komentar sudah ditambahkan pada setiap fungsi dan listener

import { db } from "./config.js";
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
  switch (status) {
    case "NewJob": return "badge-info";
    case "Downloaded":
    case "Picked":
    case "PartialPicked": return "badge-warning";
    case "Packed":
    case "Loaded": return "badge-success";
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
    const jobNo = job.jobNo;
    if (job.team && job.team.trim() !== "") {
      showNotification("⚠️ Job ini sudah di-assign ke team: " + job.team, true);
      return;
    }
    selectedSingleJob = jobNo;
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
      const targetRef = ref(db, "PlanTarget");

      // Jalankan penghapusan paralel
      Promise.all([
        remove(outboundRef),
        remove(targetRef)
      ])
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
    
      // --- Header ada di baris ke-3 (index 2) ---
      const headerIndex = 2;
      const headers = sheetData[headerIndex];
      if (!headers) {
        showNotification("Header tidak ditemukan pada baris ke-3. Pastikan format file benar.", true);
        fileInput.value = "";
        return;
      }

      // --- Data mulai dari baris ke-4 (index 3) ---
      const rows = sheetData.slice(headerIndex + 1);

      // --- Cari index kolom untuk setiap field yang dibutuhkan ---
      // Semua pencarian kolom bersifat case-insensitive dan ignore spasi
      const colIndex = {
        JobNo: headers.findIndex(h => h.trim().toLowerCase() === "job no."),
        ETD: headers.findIndex(h => h.trim().toLowerCase() === "etd"),
        DeliveryNoteNo: headers.findIndex(h => h.trim().toLowerCase() === "delivery note no."),
        RefNo: headers.findIndex(h => h.trim().toLowerCase() === "ref no."),
        Status: headers.findIndex(h => h.trim().toLowerCase() === "status"),
        BCNo: headers.findIndex(h => h.trim().toLowerCase() === "bc no."),
      };

      // --- Validasi header ---
      const requiredKeys = Object.keys(colIndex);
      const missingHeaders = requiredKeys.filter(key => colIndex[key] === -1);
      if (missingHeaders.length > 0) {
        showNotification(
          `File tidak bisa diproses. Pastikan header berikut ada dan benar penulisannya ${missingHeaders.join(", ")}`,
          true
        );
        fileInput.value = "";
        return;
      }

      // --- Mapping ke JSON sesuai kolom yang dibutuhkan ---
      const json = rows
        .map(row => ({
          JobNo: row[colIndex.JobNo] ?? "",
          ETD: row[colIndex.ETD] ?? "",
          DeliveryNoteNo: row[colIndex.DeliveryNoteNo] ?? "",
          RefNo: row[colIndex.RefNo] ?? "",
          Status: row[colIndex.Status] ?? "",
          BCNo: row[colIndex.BCNo] ?? ""
        }))
        .filter(job => job.JobNo && job.JobNo.trim() !== ""); // Data valid hanya jika JobNo terisi

      // --- Lanjutkan ke proses berikutnya (misal sync ke Firebase) ---
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
 */
function syncJobsToFirebase(jobs) {
  let uploadCount = 0;
  let errorCount = 0;
  jobs.forEach(job => {
    const jobNo = sanitizeValue(job.JobNo);
    if (!jobNo || /[.#$\[\]]/.test(jobNo)) {
      return;
    }
    const formattedDate = formatDate(job.ETD);
    const jobRef = ref(db, "PhxOutboundJobs/" + jobNo);
    get(jobRef).then(existingSnap => {
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
    .then(() => {
      uploadCount++;
      if (uploadCount + errorCount === jobs.length) {
        showNotification("Upload selesai. Berhasil: " + uploadCount + ", Gagal: " + errorCount);
        loadJobsFromFirebase();
      }
    })
    .catch(() => {
      errorCount++;
      if (uploadCount + errorCount === jobs.length) {
        showNotification("Upload selesai. Berhasil: " + uploadCount + ", Gagal: " + errorCount, true);
      }
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

let selectedSingleJob = null;
let allJobsData = [];
let filteredJobs = [];
let currentSort = { key: null, asc: true };

// Listener tombol set plan target (jika masih digunakan)
setPlanTargetBtn?.addEventListener("click", handleSetPlanTarget);

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


// Load data pertama kali
loadJobsFromFirebase();
