// File: js/report-data.js
// Mengisi tabel report dengan data dari Firebase, sudah mendukung sign-in anonymous (modular SDK)
// Versi ini: SEMUA QUERY/FILTER dijalankan di sisi JavaScript (bukan query Firebase),
// sehingga TIDAK membutuhkan .indexOn di rules Firebase!

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from "./config.js"; // pastikan file ini berisi export firebaseConfig

// Helper: Format numbers with thousands separator
function formatNumber(n) {
  n = Number(n);
  if (typeof n !== "number" || isNaN(n)) return "-";
  return n.toLocaleString("en-US");
}

// Helper: Date functions
function getTodayDateObj() {
  const today = new Date();
  today.setHours(0,0,0,0);
  return today;
}
// Format tanggal hari ini menjadi "dd-MMM-yyyy" (agar sama dengan field deliveryDate di database)
function getTodayDateFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("en-US", { month: "short" });
  const year = today.getFullYear();
  return `${day}-${month}-${year}`;
}
// Untuk header pretty date
function prettyDate(date) {
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${hari[date.getDay()]}, ${date.getDate().toString().padStart(2,"0")}-${bulan[date.getMonth()]}-${date.getFullYear()}`;
}

async function loadReportData(db) {
  const todayStr = getTodayDateFormatted(); // e.g. "16-Jun-2025"
  let shiftState = localStorage.getItem("outbound_shift");
  if (!shiftState) shiftState = "day";

  // Ambil SEMUA data PhxOutboundJobs SEKALI SAJA
  const allJobSnap = await get(ref(db, "PhxOutboundJobs"));

  // --- 1. Remaining order day H (jobType: Remainning, today)
  let remainingQty = 0;
  // --- 2. Additional Day H (jobType: Additional, today)
  let additionalQty = 0;
  // --- 3. Order H-1 (selain hari ini)
  let orderH1Qty = 0;
  // --- 6. Capacity day shift & night shift
  let capDay = 0, capNight = 0;

  if (allJobSnap.exists()) {
    allJobSnap.forEach(childSnap => {
      const v = childSnap.val();
      const jobType = (v.jobType || "").trim();
      const deliveryDate = (v.deliveryDate || "").trim();
      const team = (v.team || "").trim();
      const qty = Number(v.qty) || 0;
      // Remaining order day H
      if (jobType === "Remainning" && deliveryDate === todayStr) {
        remainingQty += qty;
      }
      // Additional Day H
      if (jobType === "Additional" && deliveryDate === todayStr) {
        additionalQty += qty;
      }
      // Order H-1 (selain hari ini)
      if (deliveryDate && deliveryDate !== todayStr) {
        orderH1Qty += qty;
      }
      // Capacity day shift: team Reguler/Sugity, hari ini, shift assumed "day"
      if (
        (team === "Reguler" || team === "Sugity") &&
        deliveryDate === todayStr
      ) {
        capDay += qty;
      }
      // Capacity night shift: jika nanti ada shift/night, tambahkan logika sesuai data
      if (
        (team === "Reguler" || team === "Sugity") &&
        deliveryDate === todayStr &&
        (v.shift || "").toLowerCase() === "night"
      ) {
        capNight += qty;
      }
    });
  }

  // --- 4. Total Order
  const totalOrder = remainingQty + additionalQty + orderH1Qty;

  // --- 5. Mp day shift & night shift
  // Ambil dari node ManPower, format: Reguler: n, Sugity: n
  const mpSnap = await get(ref(db, "ManPower"));
  let mpDay = 0, mpNight = 0;
  if (mpSnap.exists()) {
    const mpVal = mpSnap.val();
    mpDay = (Number(mpVal.Reguler) || 0) + (Number(mpVal.Sugity) || 0);
    // mpNight: tambahkan logika jika ada node night shift
    mpNight = 0;
  }

  // --- 9. Total MP
  const totalMP = mpDay + mpNight;
  // --- 10. Total Capacity
  const totalCapacity = capDay + capNight;
  // --- 11. Remaining order
  const sisaOrder = totalOrder - totalCapacity;

  // --- ISI KE DOM ---
  document.getElementById("remH-actual").textContent = formatNumber(remainingQty);
  document.getElementById("addH-actual").textContent = formatNumber(additionalQty);
  document.getElementById("orderH1-actual").textContent = formatNumber(orderH1Qty);
  document.getElementById("totalOrder-actual").textContent = formatNumber(totalOrder);
  document.getElementById("mpDay-actual").textContent = (shiftState === "day") ? formatNumber(mpDay) : "";
  document.getElementById("capDay-actual").textContent = (shiftState === "day") ? formatNumber(capDay) : "";
  document.getElementById("mpNight-actual").textContent = (shiftState === "night") ? formatNumber(mpNight) : "";
  document.getElementById("capNight-actual").textContent = (shiftState === "night") ? formatNumber(capNight) : "";
  document.getElementById("totalMP-actual").textContent = formatNumber(totalMP);
  document.getElementById("totalCap-actual").textContent = formatNumber(totalCapacity);
  document.getElementById("remainingOrder-actual").textContent = formatNumber(sisaOrder);
}

function setReportHeaders() {
  const today = getTodayDateObj();
  const pretty = prettyDate(today);
  document.querySelector(".report-date").textContent = pretty;
  document.querySelectorAll(".date-header").forEach(el => el.textContent = pretty);
  const shiftState = localStorage.getItem("outbound_shift") || "DAY SHIFT";
  document.querySelectorAll(".shift-header").forEach(el => el.textContent = (shiftState === "night" ? "NIGHT SHIFT" : "DAY SHIFT"));
}

document.addEventListener("DOMContentLoaded", async function() {
  setReportHeaders();
  // Inisialisasi Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  // Sign-in anonymous, lalu baru load report
  signInAnonymously(auth).then(() => {
    loadReportData(db);
  }).catch((error) => {
    alert("Gagal sign-in anonymous ke Firebase: " + error.message);
  });
});