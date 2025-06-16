// File: js/report-data.js
// Mengisi tabel report dengan data dari Firebase TANPA orderByChild (filter di JS saja sesuai logika permintaan user)

import { db, authPromise } from "./config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Helper
function formatNumber(n) {
  if (typeof n !== "number" || isNaN(n)) return "-";
  return n.toLocaleString("en-US");
}
function getTodayDateObj() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
function getDateString(date) {
  return date.toISOString().slice(0, 10);
}
function prettyDate(date) {
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${hari[date.getDay()]}, ${date.getDate().toString().padStart(2, "0")}-${bulan[date.getMonth()]}-${date.getFullYear()}`;
}

async function loadReportData() {
  const today = getTodayDateObj();
  const todayStr = getDateString(today);

  // Ambil shift yang dipilih user di halaman assignment job
  const shiftToggle = (localStorage.getItem("outbound_shift") || "day").toLowerCase();

  // Ambil semua data PhxOutboundJobs dan ManPower sekali saja
  const [jobsSnap, mpSnap] = await Promise.all([
    get(ref(db, "PhxOutboundJobs")),
    get(ref(db, "ManPower"))
  ]);

  // Inisialisasi
  let qtyRemainning = 0;
  let qtyAdditional = 0;
  let qtyOrderH1 = 0;
  let qtyCapDay = 0;
  let qtyCapNight = 0;
  let mpDay = 0;
  let mpNight = 0;

  // --------- 1,2,3,4,6,8 (Outbound jobs) ----------
  if (jobsSnap.exists()) {
    jobsSnap.forEach(childSnap => {
      const v = childSnap.val();
      // 1. Remaining order day H: jobType == Remainning & deliveryDate == today
      if (v.jobType === "Remainning" && v.deliveryDate === todayStr) {
        qtyRemainning += Number(v.qty) || 0;
      }
      // 2. Additional Day H: jobType == Additional & deliveryDate == today
      if (v.jobType === "Additional" && v.deliveryDate === todayStr) {
        qtyAdditional += Number(v.qty) || 0;
      }
      // 3. Order H-1: deliveryDate != today
      if (v.deliveryDate && v.deliveryDate !== todayStr) {
        qtyOrderH1 += Number(v.qty) || 0;
      }
      // 6 & 8. Capacity day/night shift: team Reguler/Sugity, group by shift
      if (["Reguler", "Sugity"].includes(v.team) && v.deliveryDate === todayStr) {
        const shiftVal = (v.shift || "day").toLowerCase();
        if (shiftVal === "day") qtyCapDay += Number(v.qty) || 0;
        if (shiftVal === "night") qtyCapNight += Number(v.qty) || 0;
      }
    });
  }
  // 4. Total Order
  const totalOrder = qtyRemainning + qtyAdditional + qtyOrderH1;

  // --------- 5,7,9 (ManPower) ----------
  if (mpSnap.exists()) {
    mpSnap.forEach(childSnap => {
      const shift = (childSnap.val().shift || "day").toLowerCase();
      if (shift === "day") mpDay++;
      if (shift === "night") mpNight++;
    });
  }
  // 9. Total MP
  const totalMP = mpDay + mpNight;
  // 10. Total Capacity
  const totalCapacity = qtyCapDay + qtyCapNight;
  // 11. Remaining order
  const sisaOrder = totalOrder - totalCapacity;

  // --------- Set ke DOM ---------
  // 1.
  document.getElementById("remH-actual").textContent = formatNumber(qtyRemainning);
  // 2.
  document.getElementById("addH-actual").textContent = formatNumber(qtyAdditional);
  // 3.
  document.getElementById("orderH1-actual").textContent = formatNumber(qtyOrderH1);
  // 4.
  document.getElementById("totalOrder-actual").textContent = formatNumber(totalOrder);
  // 5.
  document.getElementById("mpDay-actual").textContent = (shiftToggle === "day") ? formatNumber(mpDay) : "";
  // 6.
  document.getElementById("capDay-actual").textContent = (shiftToggle === "day") ? formatNumber(qtyCapDay) : "";
  // 7.
  document.getElementById("mpNight-actual").textContent = (shiftToggle === "night") ? formatNumber(mpNight) : "";
  // 8.
  document.getElementById("capNight-actual").textContent = (shiftToggle === "night") ? formatNumber(qtyCapNight) : "";
  // 9.
  document.getElementById("totalMP-actual").textContent = formatNumber(totalMP);
  // 10.
  document.getElementById("totalCap-actual").textContent = formatNumber(totalCapacity);
  // 11.
  document.getElementById("remainingOrder-actual").textContent = formatNumber(sisaOrder);
}

function setReportHeaders() {
  const today = getTodayDateObj();
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