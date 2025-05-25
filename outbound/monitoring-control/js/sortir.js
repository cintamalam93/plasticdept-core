// sortir.js
import { db } from "./config.js";
import { ref, set, get, update, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

/* =========================
    FUNGSI UTILITY/HELPER
========================= */
function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.style.display = 'block';
  notification.classList.toggle('error', isError);
  notification.classList.toggle('success', !isError);

  // Tambahkan class show (untuk animasi fade-in/fade-out jika pakai CSS)
  notification.classList.add('show');

  // Hilangkan notif setelah 4 detik
  setTimeout(() => {
    notification.classList.remove('show', 'error', 'success');
    notification.style.display = 'none';
    notification.textContent = '';
  }, 4000);
}

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

function sanitizeValue(value) {
  if (typeof value === "object") return "";
  if (typeof value === "function") return "";
  return value ?? "";
}

function formatToCustomDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

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
  const parts = input.split(/[-/]/);
  if (parts.length >= 2) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = new Date().getFullYear();
    const date = new Date(year, month, day);
    if (!isNaN(date)) {
      return formatToCustomDate(date);
    }
  }
  return input;
}

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
  row.querySelector(".assign").addEventListener("click", async (e) => {
    const jobNo = job.jobNo;
    if (job.team && job.team.trim() !== "") {
      showNotification("⚠️ Job ini sudah di-assign ke team: " + job.team, true);
      return;
    }
    selectedSingleJob = jobNo;
    showModal();
  });

  row.querySelector(".unassign").addEventListener("click", async (e) => {
    const jobNo = job.jobNo;
    const jobRef = ref(db, "outboundJobs/" + jobNo);
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

function savePlanTargetToFirebase(team, value) {
  set(ref(db, `planTargets/${team.toLowerCase()}`), value)
    .then(() => showNotification(`Target plan untuk team ${team} telah disimpan: ${value} kg.`))
    .catch((err) => showNotification("Gagal menyimpan plan target: " + err.message, true));
}

function handleSetPlanTarget() {
  const team = planTeamSelector.value;
  const target = parseInt(planTargetInput.value);
  if (isNaN(target) || target <= 0) {
    showNotification("Masukkan nilai target yang valid.", true);
    return;
  }
  showConfirmModal({
    title: "Konfirmasi Set Target",
    message: `Anda yakin ingin menyimpan target plan <b>${target} kg</b> untuk team <b>${team}</b>?`,
    okText: "Simpan",
    onConfirm: () => {
      savePlanTargetToFirebase(team, target);
      planTargetInput.value = "";
    }
  });
}

function populateDateOptions(dates) {
  dateOptions.innerHTML = '<option value="all">-- Show All --</option>';
  [...dates].sort().forEach(date => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    dateOptions.appendChild(option);
  });
}

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

function getSelectedJobs() {
  const checkboxes = document.querySelectorAll("tbody input[type='checkbox']:checked");
  return Array.from(checkboxes).map(cb => cb.getAttribute("data-jobno"));
}

function showModal() { modal.style.display = "block"; }
function hideModal() { modal.style.display = "none"; }

function clearAllJobs() {
  showConfirmModal({
    title: "Konfirmasi Hapus Semua",
    message: "Apakah Anda yakin ingin <b>MENGHAPUS SEMUA</b> job dari database?",
    okText: "Hapus",
    okClass: "logout",
    onConfirm: () => {
      remove(ref(db, "outboundJobs"))
        .then(() => {
          showNotification("✅ Semua job berhasil dihapus.");
          loadJobsFromFirebase();
        })
        .catch((err) => {
          showNotification("❌ Gagal menghapus job!", true);
        });
    }
  });
}

window.sortTableBy = function (key) {
  const tbody = document.querySelector("#jobTable tbody");
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const jobsOnScreen = rows.map(row => {
    const cells = row.querySelectorAll("td");
    return {
      element: row,
      jobNo: cells[1]?.textContent.trim(),
      deliveryDate: cells[2]?.textContent.trim(),
      deliveryNote: cells[3]?.textContent.trim(),
      remark: cells[4]?.textContent.trim(),
      status: cells[5]?.innerText.trim(),
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

function parseExcel(file) {
  const reader = new FileReader();
  showNotification("Memulai proses upload file...");
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      if (!Array.isArray(json) || json.length === 0) {
        showNotification("File Excel kosong atau tidak terbaca.", true);
        fileInput.value = "";
        return;
      }
      const requiredKeys = ["Job No", "Delivery Date"];
      const firstRow = Object.keys(json[0]);
      const missingHeaders = requiredKeys.filter(key => !firstRow.includes(key));
      if (missingHeaders.length > 0) {
        showNotification(`File tidak bisa diproses pastikan baris pertama harus ${missingHeaders.join(", ")}`, true);
        fileInput.value = "";
        return;
      }
      syncJobsToFirebase(json);
    } catch (err) {
      showNotification("Terjadi kesalahan saat membaca file Excel.", true);
    }
    fileInput.value = "";
  };
  reader.readAsArrayBuffer(file);
}

function syncJobsToFirebase(jobs) {
  let uploadCount = 0;
  let errorCount = 0;
  jobs.forEach(job => {
    const jobNo = sanitizeValue(job["Job No"]);
    if (!jobNo || /[.#$\[\]]/.test(jobNo)) {
      return;
    }
    const formattedDate = formatDate(job["Delivery Date"]);
    const jobRef = ref(db, "outboundJobs/" + jobNo);
    get(jobRef).then(existingSnap => {
      const existing = existingSnap.exists() ? existingSnap.val() : {};
      const jobData = {
        jobNo,
        deliveryDate: sanitizeValue(formattedDate),
        deliveryNote: sanitizeValue(job["Delivery Note"]),
        remark: sanitizeValue(job["Remark"]),
        status: sanitizeValue(job["Status"]),
        qty: sanitizeValue(job["Plan Qty"] || job["Qty"]),
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

function loadJobsFromFirebase() {
  jobTable.innerHTML = "";
  allJobsData = [];
  get(ref(db, "outboundJobs"))
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

function refreshDataWithoutReset() {
  get(ref(db, "outboundJobs")).then(snapshot => {
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

function closeAllDropdowns() {
  statusDropdown.style.display = "none";
  dateDropdown.style.display = "none";
  teamDropdown.style.display = "none";
}

window.navigateTo = function (page) {
  window.location.href = page;
};

/* =========================
    INISIALISASI & EVENT LISTENER
========================= */
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

// Plan Target
setPlanTargetBtn?.addEventListener("click", handleSetPlanTarget);

// Upload Excel
uploadBtn.addEventListener("click", () => {
  const file = fileInput.files[0];
  if (file) parseExcel(file);
  else showNotification("Pilih file Excel terlebih dahulu.", true);
});

// Bulk assign
bulkAddBtn.addEventListener("click", async () => {
  const selectedJobs = getSelectedJobs();
  if (selectedJobs.length === 0) {
    showNotification("Pilih minimal satu job.", true);
    return;
  }
  let jobsWithTeam = [];
  await Promise.all(
    selectedJobs.map(async (jobNo) => {
      const jobRef = ref(db, "outboundJobs/" + jobNo);
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

// Assign Modal
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
        update(ref(db, "outboundJobs/" + jobNo), { team, jobType })
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

selectAllCheckbox.addEventListener("change", (e) => {
  document.querySelectorAll("tbody input[type='checkbox']")
    .forEach(cb => cb.checked = e.target.checked);
});

closeModal.addEventListener("click", hideModal);
window.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideModal(); });

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

loadJobsFromFirebase();
document.getElementById("clearDatabaseBtn").addEventListener("click", clearAllJobs);

// ========== Logout Modal ==========
const logoutBtn = document.getElementById("logoutBtn");
const logoutModal = document.getElementById("logoutModal");
const cancelLogoutBtn = document.getElementById("cancelLogoutBtn");
const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");

logoutBtn?.addEventListener("click", () => {
  logoutModal.style.display = "block";
});
cancelLogoutBtn?.addEventListener("click", () => {
  logoutModal.style.display = "none";
});
confirmLogoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/outbound/index.html";
});
window.addEventListener("click", (e) => {
  if (e.target === logoutModal) {
    logoutModal.style.display = "none";
  }
});
