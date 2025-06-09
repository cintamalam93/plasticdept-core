// Dashboard Progress Outbound - Gabungan Team Sugity & Reguler

// --- Ganti dengan import config.js dan Firebase SDK jika perlu ---
import { db, authPromise } from "./config.js";
import { ref, set, get, update } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Dashboard Progress Outbound - Gabungan Team Sugity & Reguler

// --- Konstanta Man Power Per Team ---
const MP_SUGITY = 2;
const MP_REGULER = 1;

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

// --- Helper Functions ---
function formatNumber(num) {
  if (isNaN(num)) return "0";
  return Number(num).toLocaleString();
}

// --- Status Label Utility ---
function getStatusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "newjob": return "status-newjob";
    case "downloaded":
    case "picked":
    case "partialpicked": return "status-downloaded";
    case "packed":
    case "loaded": return "status-packed";
    default: return "status-other";
  }
}

// --- Main Data Loader ---
function loadDashboardData() {
  const db = firebase.database();
  // Ambil Plan Target dari Firebase
  Promise.all([
    db.ref("PlanTarget/Sugity").get(),
    db.ref("PlanTarget/Reguler").get(),
    db.ref("PhxOutboundJobs").get(),
  ]).then(([planSugitySnap, planRegulerSnap, outboundJobsSnap]) => {

    // Plan Target
    const planSugityVal = parseInt(planSugitySnap.exists() ? planSugitySnap.val() : 0) || 0;
    const planRegulerVal = parseInt(planRegulerSnap.exists() ? planRegulerSnap.val() : 0) || 0;

    // Outbound Jobs
    const outboundJobs = outboundJobsSnap.exists() ? outboundJobsSnap.val() : {};

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
    const totalManPower = MP_SUGITY + MP_REGULER;
    const totalPlanTarget = planSugityVal + planRegulerVal;
    const totalActual = sumActualSugity + sumActualReguler;
    const totalAchieved = sumAchievedSugity + sumAchievedReguler;
    const totalRemaining = totalActual - totalAchieved;

    // --- Isi Matrix Dashboard ---
    manpowerValue.textContent = totalManPower;
    planTargetValue.textContent = formatNumber(totalPlanTarget) + " kg";
    actualTargetValue.textContent = formatNumber(totalActual) + " kg";
    actualAchievedValue.textContent = formatNumber(totalAchieved) + " kg";
    actualRemainingValue.textContent = formatNumber(totalRemaining) + " kg";

    // --- Isi Matrix Team ---
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

    // --- Chart Donut (Gabungan) ---
    renderDonutChart(totalAchieved, totalRemaining);

    // --- Chart Bar (Team) ---
    renderBarChart(
      [sumActualSugity, sumActualReguler],
      [planSugityVal, planRegulerVal]
    );

    // --- Tabel Outbound Jobs ---
    renderJobsTable([...sugityJobs.map(j => ({...j, team: "Sugity"})),
                    ...regulerJobs.map(j => ({...j, team: "Reguler"}))]);
  });
}

// --- Donut Chart ---
function renderDonutChart(achieved, remaining) {
  const ctx = document.getElementById("donutChart").getContext("2d");
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Achieved", "Remaining"],
      datasets: [{
        data: [achieved, remaining],
        backgroundColor: ["#2ecc71", "#ecf0f1"],
        borderWidth: 2
      }]
    },
    options: {
      cutout: "70%",
      plugins: {
        legend: { display: true, position: "bottom" },
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
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: "bottom" },
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
          title: {
            display: true, text: "Qty (kg)"
          }
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

// --- Realtime Listener (Firebase v8/v9 compat style) ---
function startRealtimeListener() {
  const db = firebase.database();
  db.ref("PhxOutboundJobs").on('value', loadDashboardData);
  db.ref("PlanTarget/Sugity").on('value', loadDashboardData);
  db.ref("PlanTarget/Reguler").on('value', loadDashboardData);
}

// --- Auth Anonymous then start listener ---
window.addEventListener("DOMContentLoaded", function() {
  firebase.auth().signInAnonymously()
    .then(() => {
      startRealtimeListener();
      // Initial load
      loadDashboardData();
    })
    .catch(function(error) {
      alert("Failed to authenticate anonymously: " + error.message);
    });
});