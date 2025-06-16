// File: js/report-data.js
// Mengisi tabel report dengan data dari Firebase, sudah mendukung sign-in anonymous (modular SDK)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { firebaseConfig } from "./config.js"; // pastikan file ini berisi export firebaseConfig

// Helper: Format numbers with thousands separator
function formatNumber(n) {
  if (typeof n !== "number" || isNaN(n)) return "-";
  return n.toLocaleString("en-US");
}

// Helper: Date functions
function getTodayDateObj() {
  const today = new Date();
  today.setHours(0,0,0,0);
  return today;
}
function getDateString(date) {
  return date.toISOString().slice(0,10);
}
function prettyDate(date) {
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${hari[date.getDay()]}, ${date.getDate().toString().padStart(2,"0")}-${bulan[date.getMonth()]}-${date.getFullYear()}`;
}

/**
 * Mengisi kolom actual untuk row Capacity day shift.
 * Data diambil dari node 'PhxOutboundJobs', difilter dengan team "Reguler" atau "Sugity"
 * dan hanya untuk deliveryDate hari ini (format: "dd-MMM-yyyy").
 * Hasil penjumlahan qty akan ditampilkan di elemen dengan id 'capDay-actual'.
 * @param {Database} db - instance Firebase Database
 */
async function updateCapacityDayShiftActual(db) {
  // Format tanggal hari ini: "dd-MMM-yyyy"
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("en-US", { month: "short" });
  const year = today.getFullYear();
  const todayStr = `${day}-${month}-${year}`;

  // Ambil semua data PhxOutboundJobs
  const jobsSnap = await get(ref(db, "PhxOutboundJobs"));
  let totalQty = 0;

  if (jobsSnap.exists()) {
    jobsSnap.forEach(childSnap => {
      const job = childSnap.val();
      const team = (job.team || "").trim();
      const deliveryDate = (job.deliveryDate || "").trim();
      if (
        (team === "Reguler" || team === "Sugity") &&
        deliveryDate === todayStr
      ) {
        totalQty += Number(job.qty) || 0;
      }
    });
  }

  // Tampilkan hasil pada elemen #capDay-actual
  document.getElementById("capDay-actual").textContent = totalQty.toLocaleString("en-US");
}

async function loadReportData(db) {
  const today = getTodayDateObj();
  const todayStr = getDateString(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = getDateString(tomorrow);

  // Ambil shift dari localStorage, default day
  let shiftState = localStorage.getItem("outbound_shift");
  if (!shiftState) shiftState = "day";

  // 1. Remaining order day H (jobType: Remainning, today)
  let remainingQty = 0;
  const remainSnap = await get(query(ref(db, "PhxOutboundJobs"), orderByChild("jobType"), equalTo("Remainning")));
  if (remainSnap.exists()) {
    remainSnap.forEach(childSnap => {
      if (childSnap.val().deliveryDate === todayStr) {
        remainingQty += Number(childSnap.val().qty) || 0;
      }
    });
  }
  document.getElementById("remH-actual").textContent = formatNumber(remainingQty);

  // 2. Additional Day H (jobType: Additional, today)
  let additionalQty = 0;
  const addSnap = await get(query(ref(db, "PhxOutboundJobs"), orderByChild("jobType"), equalTo("Additional")));
  if (addSnap.exists()) {
    addSnap.forEach(childSnap => {
      if (childSnap.val().deliveryDate === todayStr) {
        additionalQty += Number(childSnap.val().qty) || 0;
      }
    });
  }
  document.getElementById("addH-actual").textContent = formatNumber(additionalQty);

  // 3. Order H-1 (selain hari ini)
  const allJobSnap = await get(ref(db, "PhxOutboundJobs"));
  let orderH1Qty = 0;
  if (allJobSnap.exists()) {
    allJobSnap.forEach(childSnap => {
      const d = childSnap.val().deliveryDate;
      if (d && d !== todayStr) {
        orderH1Qty += Number(childSnap.val().qty) || 0;
      }
    });
  }
  document.getElementById("orderH1-actual").textContent = formatNumber(orderH1Qty);

  // 4. Total Order
  const totalOrder = remainingQty + additionalQty + orderH1Qty;
  document.getElementById("totalOrder-actual").textContent = formatNumber(totalOrder);

  // 5. Mp day shift
  const mpSnap = await get(ref(db, "ManPower"));
  let mpDay = 0, mpNight = 0;
  if (mpSnap.exists()) {
    mpSnap.forEach(childSnap => {
      const s = (childSnap.val().shift || "").toLowerCase();
      if (s === "day") mpDay += 1;
      else if (s === "night") mpNight += 1;
    });
  }
  document.getElementById("mpDay-actual").textContent = (shiftState === "day") ? formatNumber(mpDay) : "";

  // 6. Capacity day shift & night shift
  let capDay = 0, capNight = 0;
  if (allJobSnap.exists()) {
    allJobSnap.forEach(childSnap => {
      const v = childSnap.val();
      if (v.deliveryDate === todayStr && ["Reguler","Sugity"].includes(v.team)) {
        if ((v.shift || "day") === "day") capDay += Number(v.qty) || 0;
        if ((v.shift || "day") === "night") capNight += Number(v.qty) || 0;
      }
    });
  }
  document.getElementById("capDay-actual").textContent = (shiftState === "day") ? formatNumber(capDay) : "";
  document.getElementById("mpNight-actual").textContent = (shiftState === "night") ? formatNumber(mpNight) : "";
  document.getElementById("capNight-actual").textContent = (shiftState === "night") ? formatNumber(capNight) : "";

  // 9. Total MP
  document.getElementById("totalMP-actual").textContent = formatNumber(mpDay + mpNight);

  // 10. Total Capacity
  document.getElementById("totalCap-actual").textContent = formatNumber(capDay + capNight);

  // 11. Remaining order
  document.getElementById("remainingOrder-actual").textContent = formatNumber(totalOrder - (capDay + capNight));

  // Panggil fungsi updateCapacityDayShiftActual untuk mengisi kolom actual Capacity day shift (override/khusus sesuai permintaan user)
  await updateCapacityDayShiftActual(db);
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