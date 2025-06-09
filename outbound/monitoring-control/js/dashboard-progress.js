import { db, authPromise } from "./config.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import ChartDataLabels from "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js";

// --- Konstanta Man Power & Plan Target per Team ---
const MP_SUGITY = 2;
const MP_REGULER = 1;
const PLAN_SUGITY = 35280;
const PLAN_REGULER = 17640;

// --- DOM Elements (dashboard matrix) ---
const manpowerValue = document.getElementById("manpowerValue");
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

// Outbound jobs table
const jobsTableBody = document.querySelector("#jobsTable tbody");

// Chart.js chart objects
let donutChart, barChart;

// --- Status Order for Table Sorting ---
const STATUS_ORDER = [
  "newjob", "downloaded", "partialdownloaded", "partialpicked", "picked", "packed", "loaded", "completed"
];

// --- Helper Functions ---
function formatNumber(num) {
  if (isNaN(num)) return "0";
  return Number(num).toLocaleString();
}
function getStatusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "newjob": return "status-newjob";
    case "downloaded": return "status-downloaded";
    case "partialdownloaded": return "status-partialdownloaded";
    case "picked":
    case "partialpicked": return "status-picked";
    case "packed": return "status-packed";
    case "loaded": return "status-loaded";
    case "completed": return "status-completed";
    default: return "status-other";
  }
}
function getStatusOrder(status) {
  const idx = STATUS_ORDER.indexOf((status || "").toLowerCase());
  return idx === -1 ? 999 : idx;
}

// --- Main Data Loader ---
async function loadDashboardData() {
  // Ambil data dari Firebase
  const [outboundJobsSnap] = await Promise.all([
    get(ref(db, "PhxOutboundJobs")),
  ]);

  // Outbound Jobs
  const outboundJobs = outboundJobsSnap.exists() ? outboundJobsSnap.val() : {};

  // Per-team accumulator
  let sumActualSugity = 0, sumAchievedSugity = 0,
      sumActualReguler = 0, sumAchievedReguler = 0;
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
  const totalManPower = MP_SUGITY + MP_REGULER;
  const totalPlanTarget = PLAN_SUGITY + PLAN_REGULER;
  const totalActual = sumActualSugity + sumActualReguler;
  const totalAchieved = sumAchievedSugity + sumAchievedReguler;
  const totalRemaining = totalActual - totalAchieved;

  // --- Isi Matrix Dashboard ---
  manpowerValue.textContent = totalManPower;
  planTargetValue.textContent = formatNumber(totalPlanTarget) + " kg";
  actualTargetValue.textContent = formatNumber(totalActual) + " kg";
  actualAchievedValue.textContent = formatNumber(totalAchieved) + " kg";
  actualRemainingValue.textContent = formatNumber(totalRemaining) + " kg";

  // --- Isi Matrix Team (dengan kg & rata kanan) ---
  mpSugity.textContent = MP_SUGITY;
  planSugity.textContent = formatNumber(PLAN_SUGITY) + " kg";
  actualSugity.textContent = formatNumber(sumActualSugity) + " kg";
  achievedSugity.textContent = formatNumber(sumAchievedSugity) + " kg";
  remainingSugity.textContent = formatNumber(sumRemainingSugity) + " kg";

  mpReguler.textContent = MP_REGULER;
  planReguler.textContent = formatNumber(PLAN_REGULER) + " kg";
  actualReguler.textContent = formatNumber(sumActualReguler) + " kg";
  achievedReguler.textContent = formatNumber(sumAchievedReguler) + " kg";
  remainingReguler.textContent = formatNumber(sumRemainingReguler) + " kg";

  // --- Chart Donut ---
  renderDonutChart(totalAchieved, totalRemaining, totalActual);

  // --- Chart Bar (Team) ---
  renderBarChart(
    [sumActualSugity, sumActualReguler],
    [PLAN_SUGITY, PLAN_REGULER]
  );

  // --- Tabel Outbound Jobs (urutkan sesuai status order) ---
  const jobs = [
    ...sugityJobs.map(j => ({...j, team: "Sugity"})),
    ...regulerJobs.map(j => ({...j, team: "Reguler"}))
  ];
  jobs.sort((a, b) => {
    const orderA = getStatusOrder(a.status);
    const orderB = getStatusOrder(b.status);
    if (orderA === orderB) {
      // Jika status sama, urutkan descending qty
      return (parseInt(b.qty)||0) - (parseInt(a.qty)||0);
    }
    return orderA - orderB;
  });
  renderJobsTable(jobs);
}

// --- Donut Chart (legend achieved+remaining) ---
function renderDonutChart(achieved, remaining, totalActual) {
  const ctx = document.getElementById("donutChart").getContext("2d");
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achieved, remaining],
        backgroundColor: ["#43a047", "#e0e0e0"],
        borderWidth: 2
      }]
    },
    options: {
      cutout: "76%",
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
  // Center Text (percent)
  const percent = totalActual ? Math.round((achieved / totalActual) * 100) : 0;
  const center = document.getElementById("donutCenterText");
  center.textContent = percent + "%";
}

// --- Bar Chart (with DataLabels) ---
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
          backgroundColor: "#3498db",
          datalabels: {
            anchor: 'end',
            align: 'end',
            formatter: v => v ? v.toLocaleString() + ' kg' : '0 kg',
            font: { weight: 'bold' },
            color: "#1976d2"
          }
        },
        {
          label: "Plan Target",
          data: planArr,
          backgroundColor: "#ff9800",
          datalabels: {
            anchor: 'end',
            align: 'end',
            formatter: v => v ? v.toLocaleString() + ' kg' : '0 kg',
            font: { weight: 'bold' },
            color: "#ff9800"
          }
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: "bottom" },
        datalabels: {
          display: true,
          clamp: true,
          clip: false,
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ": " + formatNumber(ctx.parsed.y) + " kg";
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Qty (kg)" }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// --- Tabel Outbound Jobs Gabungan ---
function renderJobsTable(jobs) {
  jobsTableBody.innerHTML = "";
  jobs.forEach(job => {
    const statusClass = getStatusClass(job.status);
    const statusLabel = (job.status||"").replace(/^\w/, c => c.toUpperCase());
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${job.team}</td>
      <td>${job.jobNo}</td>
      <td>${job.deliveryDate}</td>
      <td>${job.deliveryNote}</td>
      <td>${job.remark}</td>
      <td>
        <span class="status-label ${statusClass}">${statusLabel}</span>
      </td>
      <td>${formatNumber(job.qty)}</td>
    `;
    jobsTableBody.appendChild(row);
  });
}

// --- Real-time update (modular Firebase) ---
authPromise.then(() => {
  onValue(ref(db, "PhxOutboundJobs"), loadDashboardData);
  // Initial load
  loadDashboardData();
}).catch((err) => {
  alert("Failed to authenticate anonymously: " + err.message);
});