// Dashboard Progress Outbound - Gabungan Team Sugity & Reguler

import { db, authPromise } from "./config.js";
import { ref, get, onValue } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

let miniDonutSugityChart;
let miniDonutRegulerChart;

// --- DOM Elements (dashboard matrix) ---
const outstandingJobValue = document.getElementById("outstandingJobValue");
const planTargetValue = document.getElementById("planTargetValue");
const actualTargetValue = document.getElementById("actualTargetValue");
const actualAchievedValue = document.getElementById("actualAchievedValue");
const actualRemainingValue = document.getElementById("actualRemainingValue");

// Team matrix DOM
const mpSugity = document.getElementById("mpSugity");
const mpReguler = document.getElementById("mpReguler");
const planSugity = document.getElementById("planSugity");
const planReguler = document.getElementById("planReguler");
const actualSugity = document.getElementById("actualSugity");
const actualReguler = document.getElementById("actualReguler");
const achievedSugity = document.getElementById("achievedSugity");
const achievedReguler = document.getElementById("achievedReguler");
const remainingSugity = document.getElementById("remainingSugity");
const remainingReguler = document.getElementById("remainingReguler");
const outstandingJobLabel = document.getElementById("outstandingJobLabel");

// Progress bar & label DOM
const progressSugityBar = document.getElementById("progressSugity");
const progressTextSugity = document.getElementById("progressTextSugity");
const progressRegulerBar = document.getElementById("progressReguler");
const progressTextReguler = document.getElementById("progressTextReguler");

// Outbound jobs table
const jobsTableBody = document.querySelector("#jobsTable tbody");

// Team matrix card title
const teamTitleSugity = document.querySelector('.team-matrix-card .team-title'); // biasanya yang pertama (Sugity)
const teamTitleReguler = document.querySelectorAll('.team-matrix-card .team-title')[1]; // yang kedua (Reguler)

// Chart.js chart objects
let donutChart, barChart;

// --- Helper Functions ---
function formatNumber(num) {
  if (isNaN(num)) return "0";
  return Number(num).toLocaleString();
}

function updateOutstandingJobLabel() {
  const shiftType = localStorage.getItem("shiftType") || "Day";
  if (outstandingJobLabel) {
    if (shiftType === "Night") {
      outstandingJobLabel.textContent = "Outstanding Job For Day Shift";
    } else {
      outstandingJobLabel.textContent = "Outstanding Job For Night Shift";
    }
  }
}

// --- Status Label Utility ---
function getStatusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "newjob": return "status-newjob";
    case "downloaded":
    case "picked":
    case "partialdownloaded":
    case "partialpicked": return "status-downloaded";
    case "packed":
    case "loaded": return "status-packed";
    default: return "status-other";
  }
}

// --- Status Sort Order Utility ---
const STATUS_ORDER = [
  "newjob",
  "downloaded",
  "partialdownloaded",
  "partialpicked",
  "packed",
  "loaded",
  "completed"
];
function getStatusSortOrder(status) {
  const idx = STATUS_ORDER.indexOf((status || '').toLowerCase());
  return idx === -1 ? 999 : idx;
}

// --- Main Data Loader ---
async function loadDashboardData() {
  // Ambil shiftType dari localStorage yang diset dari halaman assignment
  const shiftType = localStorage.getItem("shiftType") || "Day";
  const planTargetPath = `PlanTarget/${shiftType} Shift`;
  const manPowerPath = `ManPower/${shiftType} Shift`;

  // Ambil data PlanTarget & ManPower dari path sesuai shift
  const [planTargetSnap, outboundJobsSnap, manPowerSnap] = await Promise.all([
    get(ref(db, planTargetPath)),
    get(ref(db, "PhxOutboundJobs")),
    get(ref(db, manPowerPath)),
  ]);

  // Plan Target
  let planSugityVal = 0, planRegulerVal = 0;
  if (planTargetSnap.exists()) {
    const planTarget = planTargetSnap.val();
    planSugityVal = parseInt(planTarget.Sugity) || 0;
    planRegulerVal = parseInt(planTarget.Reguler) || 0;
  }

  // Outbound Jobs
  const outboundJobs = outboundJobsSnap.exists() ? outboundJobsSnap.val() : {};

  // Data ManPower
  let MP_SUGITY = 0, MP_REGULER = 0;
  if (manPowerSnap.exists()) {
    const manPowerVal = manPowerSnap.val();
    MP_SUGITY = parseFloat(manPowerVal.Sugity) || 0;
    MP_REGULER = parseFloat(manPowerVal.Reguler) || 0;
  }

  // Hitung Outstanding Job For Next Shift
  let outstandingQty = 0;
  for (const jobNo in outboundJobs) {
    const job = outboundJobs[jobNo];
    const qty = parseInt(job.qty) || 0;
    const status = (job.status || '').toLowerCase();
    const team = (job.team || '').trim();
    if (status === "newjob" && (!team || team === "")) {
      outstandingQty += qty;
    }
  }
  if (outstandingJobValue) outstandingJobValue.textContent = formatNumber(outstandingQty) + " kg";

  // Per-team accumulator
  let sumActualSugity = 0,
      sumAchievedSugity = 0,
      sumActualReguler = 0,
      sumAchievedReguler = 0;

  let sugityJobs = [], regulerJobs = [];

  for (const jobNo in outboundJobs) {
    const job = outboundJobs[jobNo];
    const qty = parseInt(job.qty) || 0;
    const team = (job.team || '').toLowerCase();
    const status = (job.status || '').toLowerCase();

    if (team === "sugity") {
      sumActualSugity += qty;
      if (["packed", "loaded", "completed"].includes(status)) {
        sumAchievedSugity += qty;
      }
      sugityJobs.push(job);
    } else if (team === "reguler") {
      sumActualReguler += qty;
      if (["packed", "loaded", "completed"].includes(status)) {
        sumAchievedReguler += qty;
      }
      regulerJobs.push(job);
    }
  }

  // Remaining
  const sumRemainingSugity = sumActualSugity - sumAchievedSugity;
  const sumRemainingReguler = sumActualReguler - sumAchievedReguler;

  // Gabungan
  const totalPlanTarget = planSugityVal + planRegulerVal;
  const totalActual = sumActualSugity + sumActualReguler;
  const totalAchieved = sumAchievedSugity + sumAchievedReguler;
  const totalRemaining = totalActual - totalAchieved;

  // --- Isi Matrix Dashboard ---
  planTargetValue.textContent = formatNumber(totalPlanTarget) + " kg";
  actualTargetValue.textContent = formatNumber(totalActual) + " kg";
  actualAchievedValue.textContent = formatNumber(totalAchieved) + " kg";
  actualRemainingValue.textContent = formatNumber(totalRemaining) + " kg";

  // --- Isi Matrix Team (otomatis) ---
  mpSugity.textContent = MP_SUGITY;
  mpReguler.textContent = MP_REGULER;
  planSugity.textContent = formatNumber(planSugityVal);
  planReguler.textContent = formatNumber(planRegulerVal);
  actualSugity.textContent = formatNumber(sumActualSugity);
  actualReguler.textContent = formatNumber(sumActualReguler);
  achievedSugity.textContent = formatNumber(sumAchievedSugity);
  achievedReguler.textContent = formatNumber(sumAchievedReguler);
  remainingSugity.textContent = formatNumber(sumRemainingSugity);
  remainingReguler.textContent = formatNumber(sumRemainingReguler);

  // --- Mini Donut Chart Sugity ---
  renderMiniDonutSugity(sumAchievedSugity, planSugityVal);

  // --- Mini Donut Chart Reguler ---
  renderMiniDonutReguler(sumAchievedReguler, planRegulerVal);

  // --- Chart Donut (Gabungan) ---
  renderDonutChart(totalAchieved, totalPlanTarget);

  // --- Chart Bar (Team) ---
  renderBarChart(
    [sumAchievedSugity, sumAchievedReguler],
    [planSugityVal, planRegulerVal]
  );

  // --- Tabel Outbound Jobs (sort by status order) ---
  const allJobs = [
    ...sugityJobs.map(j => ({...j, team: "Sugity"})),
    ...regulerJobs.map(j => ({...j, team: "Reguler"}))
  ];
  allJobs.sort((a, b) => {
    const orderA = getStatusSortOrder(a.status);
    const orderB = getStatusSortOrder(b.status);
    if (orderA !== orderB) return orderA - orderB;
    return (a.jobNo || '').localeCompare(b.jobNo || '');
  });
  renderJobsTable(allJobs);

  applyShiftLogicPerTeam();
  updateOutstandingJobLabel();
}

// --- Update Progress bar per Team Otomatis ---
function updateTeamProgress(planSugityVal, achievedSugityVal, planRegulerVal, achievedRegulerVal) {
  // Sugity
  let progressSugity = planSugityVal > 0 ? (achievedSugityVal / planSugityVal * 100) : 0;
  if (progressSugityBar) progressSugityBar.style.width = progressSugity + "%";

  // Reguler
  let progressReguler = planRegulerVal > 0 ? (achievedRegulerVal / planRegulerVal * 100) : 0;
  if (progressRegulerBar) progressRegulerBar.style.width = progressReguler + "%";
}

// --- Shift Logic Title ---
function applyShiftLogicPerTeam() {
  const shiftType = localStorage.getItem("shiftType") || "Day";
  if (shiftType === "Night") {
    if (teamTitleSugity) teamTitleSugity.textContent = "Sugity (Night Shift)";
    if (teamTitleReguler) {
      teamTitleReguler.textContent = "Reguler (Night Shift)";
      document.getElementById("mpReguler").textContent = "";
      document.getElementById("planReguler").textContent = "";
      document.getElementById("actualReguler").textContent = "";
      document.getElementById("achievedReguler").textContent = "";
      document.getElementById("remainingReguler").textContent = "";
      document.getElementById("progressReguler").style.width = "0%";
      document.getElementById("progressTextReguler").textContent = "";
    }
  } else {
    if (teamTitleSugity) teamTitleSugity.textContent = "Sugity (Day Shift)";
    if (teamTitleReguler) teamTitleReguler.textContent = "Reguler (Day Shift)";
  }
}

// --- Chart Plugins ---
const centerLabelPlugin = {
  id: 'centerLabelPlugin',
  afterDraw: function(chart) {
    if (chart.config.type !== 'doughnut') return;
    const {ctx, chartArea: {left, right, top, bottom}} = chart;
    ctx.save();
    const achieved = chart.data.datasets[0].data[0];
    const plan = achieved + chart.data.datasets[0].data[1];
    const percent = plan > 0 ? (achieved / plan * 100) : 0;
    ctx.font = 'bold 18px Inter, Arial, sans-serif';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    ctx.fillText(percent.toFixed(0) + '%', centerX, centerY);
    ctx.restore();
  }
};

// --- Mini Donut Chart Sugity ---
function renderMiniDonutSugity(achieved, planTarget) {
  const ctx = document.getElementById("miniDonutSugity").getContext("2d");
  if (!ctx) return;
  const achievedVal = Number(achieved) || 0;
  const planTargetVal = Number(planTarget) || 0;
  const remaining = Math.max(0, planTargetVal - achievedVal);

  if (miniDonutSugityChart) miniDonutSugityChart.destroy();

  miniDonutSugityChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achievedVal, remaining],
        backgroundColor: ["#2ecc71", "#ecf0f1"],
        borderWidth: 2
      }]
    },
    options: {
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false }
      }
    },
    plugins: [centerLabelPlugin]
  });
}

// --- Mini Donut Chart Reguler ---
function renderMiniDonutReguler(achieved, planTarget) {
  const ctx = document.getElementById("miniDonutReguler").getContext("2d");
  if (!ctx) return;
  const achievedVal = Number(achieved) || 0;
  const planTargetVal = Number(planTarget) || 0;
  const remaining = Math.max(0, planTargetVal - achievedVal);

  if (miniDonutRegulerChart) miniDonutRegulerChart.destroy();

  miniDonutRegulerChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achievedVal, remaining],
        backgroundColor: ["#2ecc71", "#ecf0f1"],
        borderWidth: 2
      }]
    },
    options: {
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false }
      }
    },
    plugins: [centerLabelPlugin]
  });
}

// --- Donut Chart Gabungan ---
function renderDonutChart(totalAchieved, totalPlanTarget) {
  const achievedVal = Number(totalAchieved) || 0;
  const planTargetVal = Number(totalPlanTarget) || 0;
  const remaining = Math.max(0, planTargetVal - achievedVal);
  const ctx = document.getElementById("donutChart").getContext("2d");
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achievedVal, remaining],
        backgroundColor: ["#2ecc71", "#ecf0f1"],
        borderWidth: 2
      }]
    },
    options: {
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.label + ": " + formatNumber(ctx.raw) + " kg";
            }
          }
        }
      }
    }
  });
  const percent = planTargetVal > 0 ? (achievedVal / planTargetVal * 100) : 0;
  document.getElementById("donutCenterText").textContent = percent.toFixed(0) + "%";
}

// --- Bar Chart (Progress Per Team) ---
function renderBarChart(actualArr, planArr) {
  const ctx = document.getElementById("barChart").getContext("2d");
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Sugity", "Reguler"],
      datasets: [
        {
          label: "Actual Target",
          data: actualArr,
          backgroundColor: "#3498db"
        },
        {
          label: "Plan Target",
          data: planArr,
          backgroundColor: "#f39c12"
        }
      ]
    },
    plugins: [ChartDataLabels],
    options: {
      responsive: true,
      layout: { padding: { top: 40 } },
      plugins: {
        legend: { display: true, position: "bottom" },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ": " + formatNumber(ctx.parsed.y) + " kg";
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#111',
          font: { weight: 'bold' },
          formatter: function(value) {
            return formatNumber(value) + " kg";
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Qty (kg)" }
        }
      }
    }
  });
}

// --- Tabel Outbound Jobs Gabungan ---
function renderJobsTable(jobs) {
  jobsTableBody.innerHTML = "";
  jobs.forEach(job => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${job.team}</td>
      <td>${job.jobNo}</td>
      <td>${job.deliveryDate}</td>
      <td>${job.deliveryNote}</td>
      <td>${job.remark}</td>
      <td>
        <span class="status-label ${getStatusClass(job.status)}">${job.status}</span>
      </td>
      <td>${formatNumber(job.qty)}</td>
    `;
    jobsTableBody.appendChild(row);
  });
}

// --- Real-time update refresh when shift or data changes ---
function setupRealtimeListeners() {
  const shiftType = localStorage.getItem("shiftType") || "Day";
  const planTargetPath = `PlanTarget/${shiftType} Shift`;
  const manPowerPath = `ManPower/${shiftType} Shift`;

  onValue(ref(db, "PhxOutboundJobs"), loadDashboardData);
  onValue(ref(db, planTargetPath), loadDashboardData);
  onValue(ref(db, manPowerPath), loadDashboardData);
}

// --- Listen localStorage shiftType changes (multi-tab support) ---
window.addEventListener("storage", function(e) {
  if (e.key === "shiftType") {
    loadDashboardData();
    setupRealtimeListeners();
  }
});

// --- Inisialisasi Dashboard ---
authPromise.then(() => {
  loadDashboardData();
  setupRealtimeListeners();
});