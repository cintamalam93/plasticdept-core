import { db, authPromise } from "./config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Helper: Format number, tanggal ke "16-Jun-2025"
function formatNumber(n) {
  n = Number(n);
  if (typeof n !== "number" || isNaN(n)) return "-";
  return n.toLocaleString("en-US");
}
function getTodayDateFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("en-US", { month: "short" }); // "Jun"
  const year = today.getFullYear();
  return `${day}-${month}-${year}`; // "16-Jun-2025"
}
function prettyDate(date) {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${hari[date.getDay()]}, ${date.getDate().toString().padStart(2, "0")}-${bulan[date.getMonth()]}-${date.getFullYear()}`;
}

async function loadReportData() {
  const today = new Date();
  const todayStr = getTodayDateFormatted(); // "16-Jun-2025"
  const shiftToggle = (localStorage.getItem("outbound_shift") || "day").toLowerCase();

  // Ambil semua data
  const [jobsSnap, mpSnap] = await Promise.all([
    get(ref(db, "PhxOutboundJobs")),
    get(ref(db, "ManPower")),
  ]);

  let qtyRemainning = 0;
  let qtyAdditional = 0;
  let qtyOrderH1 = 0;
  let qtyCapDay = 0;
  let qtyCapNight = 0;
  let mpDay = 0;
  let mpNight = 0;

  // --- Process jobs
  if (jobsSnap.exists()) {
    jobsSnap.forEach(childSnap => {
      const v = childSnap.val();
      // Pastikan semua field ada dan format sesuai
      const deliveryDate = (v.deliveryDate || "").trim();
      const jobType = (v.jobType || "").trim().toLowerCase();
      const team = (v.team || "").trim().toLowerCase();
      const qty = Number(v.qty) || 0;

      // 1. Remaining order day H: jobType = "remainning", deliveryDate = today
      if (jobType === "remainning" && deliveryDate === todayStr) {
        qtyRemainning += qty;
      }
      // 2. Additional Day H: jobType = "additional", deliveryDate = today
      if (jobType === "additional" && deliveryDate === todayStr) {
        qtyAdditional += qty;
      }
      // 3. Order H-1: deliveryDate != today
      if (deliveryDate && deliveryDate !== todayStr) {
        qtyOrderH1 += qty;
      }
      // 6 & 8. Capacity by team Reguler/Sugity, deliveryDate = today
      if ((team === "reguler" || team === "sugity") && deliveryDate === todayStr) {
        // Tidak ada field shift, asumsikan semua "day"
        qtyCapDay += qty;
        // Jika nanti ada penambahan shift di node, bisa tambahkan logika di sini
      }
    });
  }
  const totalOrder = qtyRemainning + qtyAdditional + qtyOrderH1;

  // --- Process ManPower
  if (mpSnap.exists()) {
    mpSnap.forEach(childSnap => {
      const shift = ((childSnap.val().shift || "day") + "").toLowerCase();
      if (shift === "day") mpDay++;
      else if (shift === "night") mpNight++;
    });
  }
  const totalMP = mpDay + mpNight;
  const totalCapacity = qtyCapDay + qtyCapNight;
  const sisaOrder = totalOrder - totalCapacity;

  // --- Set ke DOM
  document.getElementById("remH-actual").textContent = formatNumber(qtyRemainning);
  document.getElementById("addH-actual").textContent = formatNumber(qtyAdditional);
  document.getElementById("orderH1-actual").textContent = formatNumber(qtyOrderH1);
  document.getElementById("totalOrder-actual").textContent = formatNumber(totalOrder);
  document.getElementById("mpDay-actual").textContent = (shiftToggle === "day") ? formatNumber(mpDay) : "";
  document.getElementById("capDay-actual").textContent = (shiftToggle === "day") ? formatNumber(qtyCapDay) : "";
  document.getElementById("mpNight-actual").textContent = (shiftToggle === "night") ? formatNumber(mpNight) : "";
  document.getElementById("capNight-actual").textContent = (shiftToggle === "night") ? formatNumber(qtyCapNight) : "";
  document.getElementById("totalMP-actual").textContent = formatNumber(totalMP);
  document.getElementById("totalCap-actual").textContent = formatNumber(totalCapacity);
  document.getElementById("remainingOrder-actual").textContent = formatNumber(sisaOrder);
}

function setReportHeaders() {
  const today = new Date();
  const pretty = prettyDate(today);
  document.querySelector(".report-date").textContent = pretty;
  document.querySelectorAll(".date-header").forEach(el => el.textContent = pretty);
  const shiftToggle = (localStorage.getItem("outbound_shift") || "DAY").toLowerCase();
  document.querySelectorAll(".shift-header").forEach(el => el.textContent = (shiftToggle === "night" ? "NIGHT SHIFT" : "DAY SHIFT"));
}

document.addEventListener("DOMContentLoaded", function () {
  setReportHeaders();
  authPromise.then(() => {
    loadReportData();
  }).catch((error) => {
    alert("Gagal sign-in anonymous ke Firebase: " + error.message);
  });
});