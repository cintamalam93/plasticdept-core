// File: js/report-data.js
// Mengisi tabel report dengan data dari Firebase, sudah mendukung sign-in anonymous (modular SDK)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
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
function getTodayDateStrDDMMMYYYY() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("en-US", { month: "short" });
  const year = today.getFullYear();
  return `${day}-${month}-${year}`;
}
function getDateString(date) {
  return date.toISOString().slice(0,10);
}
function prettyDate(date) {
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${hari[date.getDay()]}, ${date.getDate().toString().padStart(2,"0")}-${bulan[date.getMonth()]}-${date.getFullYear()}`;
}

// Variabel global untuk data agar toggle shift lancar tanpa reload firebase
let globalData = {
  mpDay: 0,
  mpNight: 0,
  capDay: 0,
  capNight: 0,
  totalMP: 0,
  totalCap: 0,
  totalOrder: 0,
  remainingQty: 0,
  additionalQty: 0,
  orderH1Qty: 0,
  remainingOrder: 0
};

async function loadReportData(db, shiftState = "day") {
  const today = getTodayDateObj();
  const todayStr = getTodayDateStrDDMMMYYYY();

  // Ambil semua data PhxOutboundJobs SEKALI SAJA
  const allJobSnap = await get(ref(db, "PhxOutboundJobs"));

  // 1. Remaining order day H (jobType: Remainning, today)
  let remainingQty = 0;
  // 2. Additional Day H (jobType: Additional, today)
  let additionalQty = 0;
  // 3. Order H-1 (selain hari ini)
  let orderH1Qty = 0;
  // 6. Capacity day shift & night shift
  let capDay = 0, capNight = 0;

  if (allJobSnap.exists()) {
    allJobSnap.forEach(childSnap => {
      const v = childSnap.val();
      const jobType = (v.jobType || "");
      const deliveryDate = (v.deliveryDate || "");
      const team = (v.team || "");
      const qty = Number(v.qty) || 0;
      const shift = (v.shift || "").toLowerCase();

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
      // Capacity day shift: hanya filter team Reguler/Sugity SAJA
      if (team === "Reguler" || team === "Sugity") {
        capDay += qty;
      }
      // Capacity night shift: jika ada shift/night field
      if (
        (team === "Reguler" || team === "Sugity") &&
        shift === "night"
      ) {
        capNight += qty;
      }
    });
  }

  // 4. Total Order
  const totalOrder = remainingQty + additionalQty + orderH1Qty;

  // 5. Mp day shift & night shift
  const mpSnap = await get(ref(db, "ManPower"));
  let mpDay = 0, mpNight = 0;
  if (mpSnap.exists()) {
    const mpVal = mpSnap.val();
    mpDay = (Number(mpVal.Reguler) || 0) + (Number(mpVal.Sugity) || 0);
    // Jika ada struktur khusus shift malam, tambahkan logic berikut:
    mpNight = (Number(mpVal.NightReguler) || 0) + (Number(mpVal.NightSugity) || 0);
  }

  // Simpan ke global untuk toggle
  globalData = {
    mpDay,
    mpNight,
    capDay,
    capNight,
    totalMP: mpDay + mpNight,
    totalCap: capDay + capNight,
    totalOrder,
    remainingQty,
    additionalQty,
    orderH1Qty,
    remainingOrder: totalOrder - (capDay + capNight)
  };
  renderReport(shiftState);
}

function renderReport(shiftState = "day") {
  // Data yang selalu tampil
  document.getElementById("remH-actual").textContent = formatNumber(globalData.remainingQty);
  document.getElementById("addH-actual").textContent = formatNumber(globalData.additionalQty);
  document.getElementById("orderH1-actual").textContent = formatNumber(globalData.orderH1Qty);
  document.getElementById("totalOrder-actual").textContent = formatNumber(globalData.totalOrder);
  document.getElementById("totalMP-actual").textContent = formatNumber(globalData.totalMP);
  document.getElementById("totalCap-actual").textContent = formatNumber(globalData.totalCap);
  document.getElementById("remainingOrder-actual").textContent = formatNumber(globalData.remainingOrder);

  // Data shift
  if (shiftState === "day") {
    document.getElementById("mpDay-actual").textContent = formatNumber(globalData.mpDay);
    document.getElementById("capDay-actual").textContent = formatNumber(globalData.capDay);
    document.getElementById("mpNight-actual").textContent = "";
    document.getElementById("capNight-actual").textContent = "";
  } else {
    document.getElementById("mpDay-actual").textContent = "";
    document.getElementById("capDay-actual").textContent = "";
    document.getElementById("mpNight-actual").textContent = formatNumber(globalData.mpNight);
    document.getElementById("capNight-actual").textContent = formatNumber(globalData.capNight);
  }
}

function setReportHeaders(shiftState = "day") {
  const today = getTodayDateObj();
  const pretty = prettyDate(today);
  document.querySelector(".report-date").textContent = pretty;
  document.querySelectorAll(".date-header").forEach(el => el.textContent = pretty);
  document.querySelectorAll(".shift-header").forEach(el => el.textContent = (shiftState === "night" ? "NIGHT SHIFT" : "DAY SHIFT"));
}

document.addEventListener("DOMContentLoaded", async function() {
  // Default shift
  let shiftState = localStorage.getItem("outbound_shift") || "day";
  setReportHeaders(shiftState);

  // Inisialisasi Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  // Sign-in anonymous, lalu baru load report
  signInAnonymously(auth).then(async () => {
    await loadReportData(db, shiftState);

    // Toggle shift radio (harus ada id shiftDay dan shiftNight di html)
    const shiftDay = document.getElementById("shiftDay");
    const shiftNight = document.getElementById("shiftNight");
    if (shiftDay && shiftNight) {
      shiftDay.addEventListener("change", function() {
        if (this.checked) {
          shiftState = "day";
          localStorage.setItem("outbound_shift", "day");
          renderReport("day");
          setReportHeaders("day");
        }
      });
      shiftNight.addEventListener("change", function() {
        if (this.checked) {
          shiftState = "night";
          localStorage.setItem("outbound_shift", "night");
          renderReport("night");
          setReportHeaders("night");
        }
      });
    }
  }).catch((error) => {
    alert("Gagal sign-in anonymous ke Firebase: " + error.message);
  });
});