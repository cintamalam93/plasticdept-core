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

// Team matrix card title
const teamTitleSugity = document.querySelector('.team-matrix-card .team-title'); // biasanya yang pertama (Sugity)
const teamTitleReguler = document.querySelectorAll('.team-matrix-card .team-title')[1]; // yang kedua (Reguler)

// Chart.js chart objects
let donutChart, barChart;

// --- Helper Functions ---
/**
 * Format angka dengan ribuan
 * @param {number|string} num
 * @returns {string}
 */
function formatNumber(num) {
  if (isNaN(num)) return "0";
  return Number(num).toLocaleString();
}

/**
 * Update label outstanding job sesuai shift
 */
async function updateOutstandingJobLabel() {
  const snapshot = await get(ref(db, "ManPower"));
  if (outstandingJobLabel) {
    if (snapshot.exists()) {
      const shifts = Object.keys(snapshot.val() || {});
      if (shifts.length === 1) {
        if (shifts[0] === "Day Shift") {
          outstandingJobLabel.textContent = "Outstanding Job For Night Shift";
        } else if (shifts[0] === "Night Shift") {
          outstandingJobLabel.textContent = "Outstanding Job For Day Shift";
        } else {
          outstandingJobLabel.textContent = "Outstanding Job For Next Shift";
        }
      } else if (shifts.includes("Day Shift") && !shifts.includes("Night Shift")) {
        outstandingJobLabel.textContent = "Outstanding Job For Night Shift";
      } else if (shifts.includes("Night Shift") && !shifts.includes("Day Shift")) {
        outstandingJobLabel.textContent = "Outstanding Job For Day Shift";
      } else {
        outstandingJobLabel.textContent = "Outstanding Job For Next Shift";
      }
    } else {
      outstandingJobLabel.textContent = "Outstanding Job For Next Shift";
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
/**
 * Muat data utama dashboard, isi matrix dan render semua chart
 */
async function loadDashboardData() {
  // Ambil shiftType dari localStorage yang diset dari halaman assignment
  const shiftType = localStorage.getItem("shiftType") || "Day";
  const planTargetPath = `PlanTarget/${shiftType} Shift`;
  const manPowerPath = `ManPower/${shiftType} Shift`;

  // Ambil data PlanTarget, OutboundJobs, dan ManPower
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

  // Setelah inisialisasi MP_SUGITY dan MP_REGULER
  const manPowerTotal = +(MP_SUGITY + MP_REGULER).toFixed(2);

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
  if (planTargetValue) planTargetValue.textContent = formatNumber(totalPlanTarget) + " kg";
  if (actualTargetValue) actualTargetValue.textContent = formatNumber(totalActual) + " kg";
  if (actualAchievedValue) actualAchievedValue.textContent = formatNumber(totalAchieved) + " kg";
  if (actualRemainingValue) actualRemainingValue.textContent = formatNumber(totalRemaining) + " kg";

  // --- Isi Matrix Team (otomatis) ---
  if (mpSugity) mpSugity.textContent = MP_SUGITY;
  if (mpReguler) mpReguler.textContent = MP_REGULER;
  if (planSugity) planSugity.textContent = formatNumber(planSugityVal);
  if (planReguler) planReguler.textContent = formatNumber(planRegulerVal);
  if (actualSugity) actualSugity.textContent = formatNumber(sumActualSugity);
  if (actualReguler) actualReguler.textContent = formatNumber(sumActualReguler);
  if (achievedSugity) achievedSugity.textContent = formatNumber(sumAchievedSugity);
  if (achievedReguler) achievedReguler.textContent = formatNumber(sumAchievedReguler);
  if (remainingSugity) remainingSugity.textContent = formatNumber(sumRemainingSugity);
  if (remainingReguler) remainingReguler.textContent = formatNumber(sumRemainingReguler);

  // --- Render Chart ---
  renderMiniDonutSugity(sumAchievedSugity, planSugityVal);
  renderMiniDonutReguler(sumAchievedReguler, planRegulerVal);
  renderDonutChart(totalAchieved, totalPlanTarget);
  renderBarChart([sumAchievedSugity, sumAchievedReguler], [planSugityVal, planRegulerVal]);

  // --- Outbound Jobs Table sudah dihapus ---

  // --- Render Line Chart Outbound (NEW) ---
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

  renderLineChartOutbound(allJobs, shiftType, manPowerTotal);

  applyShiftLogicPerTeam();
  await updateOutstandingJobLabel();
}

// --- Shift Logic Title ---
/**
 * Update judul dan data matrix per team sesuai shift
 */
function applyShiftLogicPerTeam() {
  const shiftType = localStorage.getItem("shiftType") || "Day";
  if (shiftType === "Night") {
    if (teamTitleSugity) teamTitleSugity.textContent = "Sugity (Night Shift)";
    if (teamTitleReguler) teamTitleReguler.textContent = "Reguler (Night Shift)";
    // Kosongkan data Reguler saat shift malam
    if (mpReguler) mpReguler.textContent = "";
    if (planReguler) planReguler.textContent = "";
    if (actualReguler) actualReguler.textContent = "";
    if (achievedReguler) achievedReguler.textContent = "";
    if (remainingReguler) remainingReguler.textContent = "";
  } else {
    if (teamTitleSugity) teamTitleSugity.textContent = "Sugity (Day Shift)";
    if (teamTitleReguler) teamTitleReguler.textContent = "Reguler (Day Shift)";
  }
}

// --- Plugin untuk label tengah donut ---
const centerLabelPlugin = {
  id: 'centerLabelPlugin',
  afterDraw: function(chart) {
    if (chart.config.type !== 'doughnut') return;
    const {ctx, chartArea: {left, right, top, bottom}} = chart;
    ctx.save();
    const achieved = chart.data.datasets[0].data[0];
    let planTarget =
      chart.options.plugins &&
      chart.options.plugins.customPercentTarget &&
      typeof chart.options.plugins.customPercentTarget.planTarget === 'number'
        ? chart.options.plugins.customPercentTarget.planTarget
        : achieved + chart.data.datasets[0].data[1];
    const percent = planTarget > 0 ? (achieved / planTarget * 100) : 0;
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
/**
 * Render mini donut chart untuk Sugity
 */
function renderMiniDonutSugity(achieved, planTarget) {
  const canvas = document.getElementById("miniDonutSugity");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
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
        datalabels: { display: false },
        customPercentTarget: {
          planTarget: planTargetVal
        }
      }
    },
  });
  // Animated counter
  const donutCenterText = document.getElementById("miniDonutSugityCenter");
  if (donutCenterText) {
    const percent = planTargetVal > 0 ? (achievedVal / planTargetVal * 100) : 0;
    animateCountUp(donutCenterText, Math.round(percent));
  }
}

// --- Mini Donut Chart Reguler ---
/**
 * Render mini donut chart untuk Reguler
 */
function renderMiniDonutReguler(achieved, planTarget) {
  const canvas = document.getElementById("miniDonutReguler");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
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
        datalabels: { display: false },
        customPercentTarget: {
          planTarget: planTargetVal
        }
      }
    },
  });
  // Animated counter
  const donutCenterText = document.getElementById("miniDonutRegulerCenter");
  if (donutCenterText) {
    const percent = planTargetVal > 0 ? (achievedVal / planTargetVal * 100) : 0;
    animateCountUp(donutCenterText, Math.round(percent));
  }
}

// --- Donut Chart Gabungan ---
/**
 * Render donut chart total gabungan
 */
function renderDonutChart(totalAchieved, totalPlanTarget) {
  const canvas = document.getElementById("donutChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const achievedVal = Number(totalAchieved) || 0;
  const planTargetVal = Number(totalPlanTarget) || 0;
  const remaining = Math.max(0, planTargetVal - achievedVal);

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

  const donutCenterText = document.getElementById("donutCenterText");
  if (donutCenterText) {
    const percent = planTargetVal > 0 ? (achievedVal / planTargetVal * 100) : 0;
    animateCountUp(donutCenterText, Math.round(percent));
  }
}

// --- Bar Chart (Progress Per Team) ---
/**
 * Render bar chart untuk progres per team
 */
function renderBarChart(actualArr, planArr) {
  const canvas = document.getElementById("barChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Sugity", "Reguler"],
      datasets: [
        {
          label: "Actual Target",
          data: actualArr,
          backgroundColor: 'rgba(23, 78, 166, 0.85)',
          borderRadius: 7,
          barPercentage: 0.85,
          categoryPercentage: 0.7
        },
        {
          label: "Plan Target",
          data: planArr,
          backgroundColor: 'rgba(14, 189, 154, 0.65)',
          borderRadius: 7,
          barPercentage: 0.85,
          categoryPercentage: 0.7
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
        },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#174ea6',
          font: { weight: 'bold' },
          formatter: function(value) {
            return formatNumber(value) + " kg";
          }
        }
      },
      layout: { padding: { top: 12 } },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Qty (kg)", color: "#174ea6", font: { size: 14, weight: "bold" } },
          ticks: { color: "#174ea6", font: { size: 13 } },
          grid: { color: "#e5e7eb" }
        },
        x: {
          ticks: { color: "#174ea6", font: { size: 13 } },
          grid: { display: false }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ===================== LINE CHART OUTBOUND (NEW) =====================
let lineChartOutbound;

// Map plan target berdasarkan shift & total man power
const PLAN_TARGET_TABLE = {
  "Day": {
    "3": [
      { time: "8:00", target: null },
      { time: "9:00", target: 3528 },
      { time: "10:00", target: 10584 },
      { time: "11:00", target: 17640 },
      { time: "12:00", target: 24696 },
      { time: "13:00", target: 0 },
      { time: "14:00", target: 31752 },
      { time: "15:00", target: 38808 },
      { time: "16:00", target: 45864 },
      { time: "17:00", target: 52920 }
    ],
    "2.5": [
      { time: "8:00", target: null },
      { time: "9:00", target: 2940 },
      { time: "10:00", target: 8820 },
      { time: "11:00", target: 14700 },
      { time: "12:00", target: 20580 },
      { time: "13:00", target: 0 },
      { time: "14:00", target: 26460 },
      { time: "15:00", target: 32340 },
      { time: "16:00", target: 38220 },
      { time: "17:00", target: 44100 }
    ],
    "2": [
      { time: "8:00", target: null },
      { time: "9:00", target: 2352 },
      { time: "10:00", target: 7056 },
      { time: "11:00", target: 11760 },
      { time: "12:00", target: 16464 },
      { time: "13:00", target: 0 },
      { time: "14:00", target: 21168 },
      { time: "15:00", target: 25872 },
      { time: "16:00", target: 30576 },
      { time: "17:00", target: 35280 }
    ]
  },
  "Night": {
    "2": [
      { time: "20:00", target: null },
      { time: "21:00", target: 2352 },
      { time: "22:00", target: 7056 },
      { time: "23:00", target: 11760 },
      { time: "0:00", target: 16464 },
      { time: "1:00", target: 0 },
      { time: "2:00", target: 21168 },
      { time: "3:00", target: 25872 },
      { time: "4:00", target: 30576 },
      { time: "5:00", target: 35280 }
    ]
  }
};

// --- Helper: Range jam untuk per shift
function getHourRange(shiftType) {
  if (shiftType === "Day") {
    // 8:00 - 17:00
    return [
      { label: "8:00", start: 8, end: 9 },
      { label: "9:00", start: 9, end: 10 },
      { label: "10:00", start: 10, end: 11 },
      { label: "11:00", start: 11, end: 12 },
      { label: "12:00", start: 12, end: 13 },
      { label: "13:00", start: 13, end: 14 },
      { label: "14:00", start: 14, end: 15 },
      { label: "15:00", start: 15, end: 16 },
      { label: "16:00", start: 16, end: 17 },
      { label: "17:00", start: 17, end: 18 }
    ];
  } else {
    // Night: 20:00 - 5:00
    return [
      { label: "20:00", start: 20, end: 21 },
      { label: "21:00", start: 21, end: 22 },
      { label: "22:00", start: 22, end: 23 },
      { label: "23:00", start: 23, end: 24 },
      { label: "0:00", start: 0, end: 1 },
      { label: "1:00", start: 1, end: 2 },
      { label: "2:00", start: 2, end: 3 },
      { label: "3:00", start: 3, end: 4 },
      { label: "4:00", start: 4, end: 5 },
      { label: "5:00", start: 5, end: 6 }
    ];
  }
}

// --- Fungsi utama render Line Chart Outbound ---
function renderLineChartOutbound(jobs, shiftType, manPowerTotal) {
  // --- Plan Target Array ---
  let planTargetArr = [];
  const mpKey = String(manPowerTotal);
  if (PLAN_TARGET_TABLE[shiftType] && PLAN_TARGET_TABLE[shiftType][mpKey]) {
    planTargetArr = PLAN_TARGET_TABLE[shiftType][mpKey];
  } else {
    planTargetArr = (shiftType === "Day") ? [] : [];
  }

  // --- Visible Plan Chart Array ---
  let visiblePlanChartArr = planTargetArr.map((row, idx) => {
    if (idx === 0) return 0;
    if (row.target === 0) return 0;
    if (row.target === null || typeof row.target === "undefined") return null;
    return row.target;
  });

  // --- Helper: Jam Range updated ---
  const hourRange = getHourRange(shiftType);
  const finishedStatus = ["packed", "loaded", "completed"];
  let shiftLabel = shiftType === "Day" ? "Day Shift" : "Night Shift";

  // === LOG OUTBOUND PER JAM ===
(function logOutboundPerHour() {
  let jobsPerHour = {};
  const hourRanges = getHourRange(shiftType);

  for (let i = 0; i < hourRanges.length; i++) {
    const range = hourRanges[i];
    jobsPerHour[range.label] = [];
  }

  jobs.forEach(job => {
    if ((job.shift || "") !== shiftLabel) return;
    if (!job.finishAt) return;
    const status = (job.status || '').toLowerCase();
    if (!finishedStatus.includes(status)) return;
    // Parse finishAt
    const fin = parseFinishAt(job.finishAt);
    if (!fin) return;
    let jamFin = fin.hour;
    if (shiftType === "Night" && jamFin < 6) jamFin += 24;
    hourRanges.forEach((range) => {
      let start = range.start;
      let end = range.end;
      if (shiftType === "Night" && start < 6) start += 24;
      if (shiftType === "Night" && end < 6) end += 24;
      if (
        (jamFin >= start && jamFin < end) ||
        (jamFin === start && fin.minute > 0)
      ) {
        jobsPerHour[range.label].push({
          jobNo: job.jobNo || job.no || "-",
          qty: job.qty,
          finishAt: job.finishAt
        });
      }
    });
  });

  // Print log
  Object.keys(jobsPerHour).forEach(jamLabel => {
    if (jobsPerHour[jamLabel].length > 0) {
      console.log(`Jam ${jamLabel}`);
      jobsPerHour[jamLabel].forEach(j =>
        console.log(`${j.jobNo}: ${j.qty} finish at ${j.finishAt}`)
      );
      console.log(""); // spasi antar jam
    }
  });
})();

  function parseFinishAt(str) {
    const m = String(str).match(/(\d{1,2}):(\d{2})/);
    if (m) return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
    const iso = String(str).match(/T(\d{1,2}):(\d{2})/);
    if (iso) return { hour: parseInt(iso[1], 10), minute: parseInt(iso[2], 10) };
    return null;
  }

  // --- Qty Per Jam (bukan akumulasi) ---
  let actualPerJamArr = Array(hourRange.length).fill(0);
  for (let i = 1; i < hourRange.length; i++) {
    const prev = hourRange[i - 1];
    const curr = hourRange[i];
    jobs.forEach(job => {
      if ((job.shift || "") !== shiftLabel) return;
      if (!job.finishAt) return;
      const status = (job.status || '').toLowerCase();
      if (!finishedStatus.includes(status)) return;
      const fin = parseFinishAt(job.finishAt);
      if (!fin) return;
      let jamFin = fin.hour;
      if (shiftType === "Night" && jamFin < 6) jamFin += 24;
      let prevStart = prev.start;
      let currStart = curr.start;
      if (shiftType === "Night" && prevStart < 6) prevStart += 24;
      if (shiftType === "Night" && currStart < 6) currStart += 24;
      if (
        (jamFin > prevStart && jamFin < currStart) ||
        (jamFin === prevStart && fin.minute > 0) ||
        (jamFin === currStart && fin.minute === 0)
      ) {
        actualPerJamArr[i] += parseInt(job.qty) || 0;
      }
    });
  }

  // --- Akumulasi (untuk line grafik dan datalabel) ---
  let actualCumulative = [];
  let sum = 0;
  let lastSumBeforeBreak = 0; // Tambah variable untuk menyimpan akumulasi sebelum istirahat

  for (let i = 0; i < actualPerJamArr.length; i++) {
    if (planTargetArr[i].target === 0) { // Jam istirahat (13:00)
      lastSumBeforeBreak = sum; // Simpan akumulasi sebelum istirahat
      actualCumulative.push(0); // Push 0 untuk jam istirahat
    } else if (planTargetArr[i].target === null) { // Jam pertama (8:00)
      actualCumulative.push(0);
      sum = 0;
    } else {
      // Untuk jam setelah istirahat (14:00 dst), tambahkan lastSumBeforeBreak
      if (i > 0 && planTargetArr[i-1].target === 0) {
        sum = lastSumBeforeBreak + actualPerJamArr[i];
      } else {
        sum += actualPerJamArr[i];
      }
      actualCumulative.push(sum);
    }
  }

  // --- Datalabel per jam (tampilkan akumulasi, hanya di jam yang sudah lewat, jam istirahat = 0, jam berikutnya = null) ---
  const now = new Date();
  let currentHour = now.getHours();
  let chartHour = currentHour;
  if (shiftType === "Night" && currentHour < 6) chartHour += 24;

  let jamArr = planTargetArr.map((row, idx) => {
    let jam = parseInt(row.time);
    if (shiftType === "Night" && jam < 6) jam += 24;
    return {idx, jam};
  });
  let nowIdx = jamArr.findIndex(j => chartHour < j.jam);
  if (nowIdx === -1) nowIdx = planTargetArr.length;

  // Datalabel actual: isi dengan akumulasi di semua jam yang SUDAH LEWAT (jam ke-0/awal tetap null), istirahat = 0, jam berikutnya null
  let datalabelActualArr = [];
  for (let i = 0; i < actualCumulative.length; i++) {
    if (planTargetArr[i].target === null) {
      datalabelActualArr.push(0); // jam istirahat, label 0
    } else if (i > 0 && i < nowIdx && actualCumulative[i] !== null) {
      datalabelActualArr.push(actualCumulative[i]); // akumulasi, hanya jam yang sudah lewat
    } else {
      datalabelActualArr.push(null); // jam yang belum lewat atau jam ke-0
    }
  }

  // === LOG DEBUG (letakkan di sini) ===
  console.log('actualCumulative:', actualCumulative);
  console.log('datalabelActualArr:', datalabelActualArr);
  console.log('nowIdx:', nowIdx);
  console.log('chartHour:', chartHour);
  console.log('jamArr:', jamArr);
  console.log('planTargetArr:', planTargetArr);
  // === END LOG DEBUG ===

  // Sembunyikan data actualCumulative setelah jam saat ini (agar line putus di titik berikutnya)
  for (let i = nowIdx; i < actualCumulative.length; i++) {
    actualCumulative[i] = null;
  }

  const labels = planTargetArr.map(row => row.time);

  // --- Render Chart.js ---
  const canvas = document.getElementById("lineChartOutbound");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (window.lineChartOutbound && typeof window.lineChartOutbound.destroy === "function") {
    window.lineChartOutbound.destroy();
  }

  window.lineChartOutbound = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Actual Target",
          data: actualCumulative,
          borderColor: "#FF9900",
          backgroundColor: "rgba(255,153,0,0.10)",
          borderWidth: 3,
          pointBackgroundColor: "#FF9900",
          pointBorderColor: "#fff",
          pointRadius: 6,
          fill: false,
          tension: 0.2,
          datalabels: {
            display: function(context) {
              return datalabelActualArr[context.dataIndex] !== null;
            },
            backgroundColor: "#FF9900",
            borderColor: "#fff",
            borderWidth: 2,
            color: "#222",
            borderRadius: 4,
            padding: 6,
            font: { weight: "bold", size: 12 },
            anchor: 'end',
            align: 'top',
            offset: 16,
            clamp: true,
            formatter: function(value, ctx) {
              return datalabelActualArr[ctx.dataIndex] !== null
                ? datalabelActualArr[ctx.dataIndex].toLocaleString()
                : "";
            }
          }
        },
        {
          label: "Plan Target",
          data: visiblePlanChartArr,
          borderColor: "#2577F6",
          backgroundColor: "rgba(37,119,246,0.10)",
          borderWidth: 3,
          pointBackgroundColor: "#2577F6",
          pointBorderColor: "#fff",
          pointRadius: 6,
          fill: false,
          tension: 0.2,
          spanGaps: true,
          datalabels: {
            display: function(context) {
              return context.dataset.data[context.dataIndex] !== null && context.dataset.data[context.dataIndex] !== 0;
            },
            backgroundColor: "#2577F6",
            borderColor: "#fff",
            borderWidth: 2,
            color: "#fff",
            borderRadius: 4,
            padding: 6,
            font: { weight: "bold", size: 12 },
            anchor: 'start',
            align: 'bottom',
            offset: 16,
            clamp: true,
            formatter: (value) => value !== null && value !== 0 ? value.toLocaleString() : ""
          }
        }
      ],
    },
    options: {
      responsive: true,
      animation: {
        y: {
          type: 'number',
          easing: 'linear',
          duration: 800,
          delay: function(context) {
            // Hanya dataset actual (biasanya index 0)
            if (context.type !== 'data' || context.datasetIndex !== 0) return 0;
            return context.dataIndex * 75; // 120ms per titik, bisa diubah sesuai selera
          }
        }
      },
      plugins: {
        legend: { display: true, position: "bottom" },
        tooltip: { mode: "index", intersect: false },
        datalabels: {}
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Qty (kg)", font: { size: 14, weight: "bold" } }
        },
        x: {
          title: { display: true, text: "Jam" }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// --- Real-time update refresh when shift or data changes ---
/**
 * Setup realtime listener firebase untuk data utama
 */
function setupRealtimeListeners() {
  const shiftType = localStorage.getItem("shiftType") || "Day";
  const planTargetPath = `PlanTarget/${shiftType} Shift`;
  const manPowerPath = `ManPower/${shiftType} Shift`;

  onValue(ref(db, "PhxOutboundJobs"), loadDashboardData);
  onValue(ref(db, planTargetPath), loadDashboardData);
  onValue(ref(db, manPowerPath), loadDashboardData);
  onValue(ref(db, "ManPower"), updateOutstandingJobLabel);
}

// --- Listen localStorage shiftType changes (multi-tab support) ---
window.addEventListener("storage", function(e) {
  if (e.key === "shiftType") {
    loadDashboardData();
    setupRealtimeListeners();
  }
});

/**
 * Schedule refresh dashboard pada awal jam berikutnya, lalu tiap 1 jam
 */
function scheduleHourlyUpdate() {
  const now = new Date();
  const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
  setTimeout(() => {
    loadDashboardData();
    setInterval(loadDashboardData, 60 * 60 * 1000);
  }, msToNextHour);
}

// Setelah auth dan setup listener
authPromise.then(() => {
  loadDashboardData();
  setupRealtimeListeners();
  scheduleHourlyUpdate();
});

/**
 * Animasi naik angka persen pada donut chart
 * @param {HTMLElement} element
 * @param {number} targetValue
 * @param {number} duration
 */
function animateCountUp(element, targetValue, duration = 800) {
  if (!element) return;
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