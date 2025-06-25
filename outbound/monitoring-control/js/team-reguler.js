// team-sugity.js
import { db, authPromise } from "./config.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

const teamTable = document.getElementById("teamTable").getElementsByTagName("tbody")[0];
const currentTeam = "Reguler";

/**
 * Render PIC metric (array nama PIC dengan icon) ke dalam metric box.
 * @param {string[]|string} picNames
 */
function renderPicMetric(picNames) {
  // Hapus metric PIC lama jika sudah ada
  const oldMetric = document.querySelector(".metrics .metric-box[data-pic-metric]");
  if (oldMetric) oldMetric.remove();

  // Icon path (relative dari HTML team-sugity/reguler)
  const iconPath = "img/team_mp.png";

  // Gabungkan nama jadi beberapa baris dengan icon
  const namesHTML = Array.isArray(picNames)
    ? picNames.map(name =>
        `<div class="pic-row"><img src="${iconPath}" class="pic-icon" alt="MP" />${name}</div>`
      ).join("")
    : `<div class="pic-row"><img src="${iconPath}" class="pic-icon" alt="MP" />${picNames}</div>`;

  const picMetricHTML = `
    <div class="metric-box" data-pic-metric>
      <div class="icon">👤</div>
      <div class="label">PIC</div>
      <div class="value pic-list" id="picMetricValue">${namesHTML}</div>
    </div>
  `;
  document.querySelector(".metrics")?.insertAdjacentHTML("afterbegin", picMetricHTML);
}

/**
 * Ambil semua PIC dengan team "Sugity" dari node MPPIC dan render ke metric box.
 */
function setPicMetricFromDb() {
  onValue(ref(db, `MPPIC`), (snapshot) => {
    const allPicData = snapshot.val();
    if (!allPicData) {
      renderPicMetric("-");
      return;
    }
    // Filter hanya team Sugity lalu ambil nama-nama
    const picNames = Object.values(allPicData)
      .filter(pic => (pic.team || "").toLowerCase() === "reguler")
      .map(pic => pic.name || "-");

    if (picNames.length === 0) picNames.push("-");
    renderPicMetric(picNames);
  });
}

/**
 * Helper: Buat status label dengan warna sesuai status.
 * @param {string} status
 * @returns {HTMLSpanElement}
 */
function createStatusLabel(status) {
  const span = document.createElement("span");
  span.textContent = status;
  span.classList.add("status-label");

  // Normalisasi status (tanpa spasi, huruf besar-kecil TIDAK sensitif)
  const normalized = (status || "").replace(/\s/g, "").toLowerCase();

  switch (normalized) {
    case "pendingpick":
    case "pendingallocation":
      span.style.backgroundColor = "#e74c3c"; // Merah
      break;
    case "partialpicked":
    case "partialpacked":
      span.style.backgroundColor = "#f39c12"; // Oranye
      break;
    case "completed":
      span.style.backgroundColor = "#232323"; // Hitam untuk completed
      span.style.color = "#fff";
      break;
    case "packed":
    case "loading":
      span.style.backgroundColor = "#2ecc71"; // Hijau
      break;
    // ZLogix
    case "newjob":
      span.style.backgroundColor = "#e74c3c"; // Merah
      break;
    case "downloaded":
    case "picked":
      span.style.backgroundColor = "#f39c12"; // Kuning/Oranye
      break;
    case "loaded":
      span.style.backgroundColor = "#2ecc71";
      break;
    default:
      span.style.backgroundColor = "#bdc3c7"; // Abu-abu
  }

  span.style.padding = "4px 8px";
  span.style.borderRadius = "6px";
  span.style.fontSize = "0.85em";
  if (normalized !== "completed") span.style.color = "white";
  return span;
}

/**
 * Render donut chart progress untuk team Sugity.
 * Center label persentase hanya menggunakan HTML, tidak memakai plugin Chart.js.
 * Legend Chart.js dimatikan, legend manual via HTML.
 * @param {number} achievedQty - Jumlah progress yang tercapai
 * @param {number} totalQty - Plan Target (boleh diabaikan, gunakan PLAN_TARGET_QTY untuk konsistensi)
 */
function renderChart(achievedQty, totalQty) {
  const ctx = document.getElementById("progressChart").getContext("2d");
  const planTarget = typeof PLAN_TARGET_QTY !== "undefined" ? PLAN_TARGET_QTY : totalQty;
  const percentage = planTarget === 0 ? 0 : Math.round((achievedQty / planTarget) * 100);
  const remainingQty = Math.max(0, planTarget - achievedQty);

  // Destroy previous chart if exists
  if (window.progressChartInstance) window.progressChartInstance.destroy();

  window.progressChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achievedQty, remainingQty],
        backgroundColor: ["#2ecc71", "#ecf0f1"],
        borderWidth: 2
      }]
    },
    options: {
      cutout: "70%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // Legend manual via HTML
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.raw.toLocaleString();
              return `${label}: ${value} kg`;
            }
          },
          backgroundColor: "#fff",
          titleColor: "#2c3e50",
          bodyColor: "#2c3e50",
          borderColor: "#2ecc71",
          borderWidth: 1,
          titleFont: { weight: 'bold' },
          bodyFont: { weight: 'normal' }
        }
      }
    }
  });

  // Update center label di HTML (hanya satu, tidak dobel)
  const donutCenterText = document.getElementById("donutCenterTextTeam");
  if (donutCenterText) {
    animateCountUp(donutCenterText, percentage);
  }
}

/**
 * Load data outbound jobs untuk team Sugity, isi tabel dan update chart & metrics.
 */
function loadTeamJobs() {
  onValue(ref(db, "PhxOutboundJobs"), snapshot => {
    const data = snapshot.val();
    teamTable.innerHTML = "";
    let totalJobs = 0;
    let totalQty = 0;
    let achievedQty = 0;

    if (data) {
      Object.values(data).forEach(job => {
        if ((job.team || '').toLowerCase() === currentTeam.toLowerCase()) {
          totalJobs++;
          const qty = Number(job.qty) || 0;
          totalQty += qty;

          if (["packed", "loaded", "completed"].includes((job.status || '').toLowerCase())) {
            achievedQty += qty;
          }

          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${job.jobNo}</td>
            <td>${job.deliveryDate}</td>
            <td>${job.deliveryNote}</td>
            <td>${job.remark}</td>
            <td></td>
            <td>${qty.toLocaleString()}</td>
            <td>${job.jobType ? `<span class="job-type ${job.jobType}">${job.jobType}</span>` : ""}</td>
          `;
          row.querySelector("td:nth-child(5)").appendChild(createStatusLabel(job.status));
          teamTable.appendChild(row);
        }
      });
    }

    const remainingQty = totalQty - achievedQty;
    document.getElementById("planTarget").textContent = `${PLAN_TARGET_QTY.toLocaleString()} kg`;
    document.getElementById("actualTarget").textContent = `${totalQty.toLocaleString()} kg`;
    document.getElementById("achievedTarget").textContent = `${achievedQty.toLocaleString()} kg`;
    document.getElementById("remainingTarget").textContent = `${remainingQty.toLocaleString()} kg`;

    renderChart(achievedQty, PLAN_TARGET_QTY);

    if (!$.fn.DataTable.isDataTable("#teamTable")) {
      $("#teamTable").DataTable({
        paging: true,
        searching: true,
        ordering: true,
        info: true
      });
    }
  });
}

// Default Plan Target per team
let PLAN_TARGET_QTY = currentTeam.toLowerCase() === "reguler" ? 17640 : 35280;

/**
 * Setup tombol Logout/Back berdasarkan role user di database (bukan localStorage).
 */
async function setupRoleButtons() {
  await authPromise;
  const userId = sessionStorage.getItem("userId");
  const backBtn = document.getElementById("backToSortirBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Default: sembunyikan semua tombol dulu
  if (backBtn) backBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "none";

  if (!userId) return;

  // Ambil posisi user dari database
  const userSnap = await get(ref(db, `users/${userId}`));
  if (!userSnap.exists()) return;

  const userPosition = (userSnap.val().Position || "").toLowerCase();
  const isOperator = userPosition.includes("operator");

  if (isOperator) {
    // Operator: hanya tombol logout yang tampil
    if (logoutBtn) {
      logoutBtn.style.display = "inline-block";
      logoutBtn.onclick = () => {
        sessionStorage.clear();
        window.location.href = "../index.html";
      };
    }
    if (backBtn) backBtn.style.display = "none";
  } else {
    // Non-operator: hanya tombol back yang tampil
    if (backBtn) {
      backBtn.style.display = "inline-block";
      backBtn.onclick = () => window.location.href = "sort-job.html";
    }
    if (logoutBtn) logoutBtn.style.display = "none";
  }
}

// Inisialisasi setelah login anonymous sukses
authPromise.then(() => {
  setPicMetricFromDb("TeamSugity");
  setupRoleButtons();
  onValue(ref(db, `PlanTarget/Day Shift/${currentTeam}`), (snapshot) => {
    let val = snapshot.exists() ? parseInt(snapshot.val()) : 0;
    if (val && val > 0) {
      PLAN_TARGET_QTY = val;
      loadTeamJobs();
    } else {
      // Jika Day Shift kosong/0, ambil dari Night Shift
      onValue(ref(db, `PlanTarget/Night Shift/${currentTeam}`), (snapshot2) => {
        let val2 = snapshot2.exists() ? parseInt(snapshot2.val()) : 0;
        PLAN_TARGET_QTY = val2 && val2 > 0 ? val2 : 0;
        loadTeamJobs();
      }, { onlyOnce: true });
    }
  });
});

function animateCountUp(element, targetValue, duration = 800) {
  if (!element) return;
  let start = 0;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * targetValue);
    element.textContent = value + "%";
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.textContent = targetValue + "%";
    }
  };
  window.requestAnimationFrame(step);
}