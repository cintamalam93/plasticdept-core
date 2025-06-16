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
function getDateString(date) {
  return date.toISOString().slice(0,10);
}
function prettyDate(date) {
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${hari[date.getDay()]}, ${date.getDate().toString().padStart(2,"0")}-${bulan[date.getMonth()]}-${date.getFullYear()}`;
}

// --- SHIFT AWARE DATA LOADING ---
let globalMpDay = 0;
let globalMpNight = 0;
let globalCapDay = 0;
let globalCapNight = 0;
let globalTotalMP = 0;
let globalTotalCap = 0;

async function loadReportData(db, shiftState = "day") {
  const today = getTodayDateObj();
  const todayStr = getDateString(today);

  // 1. Remaining order day H (jobType: Remainning, today)
  let remainingQty = 0;
  const remainSnap = await get(ref(db, "PhxOutboundJobs"));
  if (remainSnap.exists()) {
    remainSnap.forEach(childSnap => {
      const v = childSnap.val();
      if ((v.jobType === "Remainning") && (v.deliveryDate === todayStr)) {
        remainingQty += Number(v.qty) || 0;
      }
    });
  }
  document.getElementById("remH-actual").textContent = formatNumber(remainingQty);

  // 2. Additional Day H (jobType: Additional, today)
  let additionalQty = 0;
  if (remainSnap.exists()) {
    remainSnap.forEach(childSnap => {
      const v = childSnap.val();
      if ((v.jobType === "Additional") && (v.deliveryDate === todayStr)) {
        additionalQty += Number(v.qty) || 0;
      }
    });
  }
  document.getElementById("addH-actual").textContent = formatNumber(additionalQty);

  // 3. Order H-1 (selain hari ini)
  let orderH1Qty = 0;
  if (remainSnap.exists()) {
    remainSnap.forEach(childSnap => {
      const v = childSnap.val();
      const d = v.deliveryDate;
      if (d && d !== todayStr) {
        orderH1Qty += Number(v.qty) || 0;
      }
    });
  }
  document.getElementById("orderH1-actual").textContent = formatNumber(orderH1Qty);

  // 4. Total Order
  const totalOrder = remainingQty + additionalQty + orderH1Qty;
  document.getElementById("totalOrder-actual").textContent = formatNumber(totalOrder);

  // 5. Ambil dan proses data ManPower
  const mpSnap = await get(ref(db, "ManPower"));
  let mpDay = 0, mpNight = 0;
  if (mpSnap.exists()) {
    const mpVal = mpSnap.val();
    mpDay = (Number(mpVal.Reguler) || 0) + (Number(mpVal.Sugity) || 0);
    // mpNight bisa diisi jika ada struktur shift malam pada node ManPower
    mpNight = (Number(mpVal.NightReguler) || 0) + (Number(mpVal.NightSugity) || 0); // fallback, jika ada
  }

  // 6. Ambil dan proses data Capacity day/night shift
  let capDay = 0, capNight = 0;
  if (remainSnap.exists()) {
    remainSnap.forEach(childSnap => {
      const v = childSnap.val();
      const team = v.team || "";
      const qty = Number(v.qty) || 0;
      const shift = (v.shift || "").toLowerCase();
      if (team === "Reguler" || team === "Sugity") {
        if (shift === "night") {
          capNight += qty;
        } else {
          capDay += qty;
        }
      }
    });
  }

  // Simpan global untuk digunakan ulang saat ganti shift
  globalMpDay = mpDay;
  globalMpNight = mpNight;
  globalCapDay = capDay;
  globalCapNight = capNight;
  globalTotalMP = mpDay + mpNight;
  globalTotalCap = capDay + capNight;

  // Tampilkan sesuai shift yang dipilih
  updateShiftDisplay(shiftState);

  // 11. Remaining order (total order - total capacity)
  document.getElementById("remainingOrder-actual").textContent = formatNumber(totalOrder - (capDay + capNight));
}

function updateShiftDisplay(shiftState = "day") {
  if (shiftState === "day") {
    document.getElementById("mpDay-actual").textContent = formatNumber(globalMpDay);
    document.getElementById("capDay-actual").textContent = formatNumber(globalCapDay);
    document.getElementById("mpNight-actual").textContent = "";
    document.getElementById("capNight-actual").textContent = "";
  } else if (shiftState === "night") {
    document.getElementById("mpDay-actual").textContent = "";
    document.getElementById("capDay-actual").textContent = "";
    document.getElementById("mpNight-actual").textContent = formatNumber(globalMpNight);
    document.getElementById("capNight-actual").textContent = formatNumber(globalCapNight);
  }
  document.getElementById("totalMP-actual").textContent = formatNumber(globalTotalMP);
  document.getElementById("totalCap-actual").textContent = formatNumber(globalTotalCap);
}

function setReportHeaders() {
  const today = getTodayDateObj();
  const pretty = prettyDate(today);
  document.querySelector(".report-date").textContent = pretty;
  document.querySelectorAll(".date-header").forEach(el => el.textContent = pretty);
  // Judul SHIFT tidak otomatis berubah, bisa diubah jika ingin
  let shiftState = localStorage.getItem("outbound_shift") || "day";
  document.querySelectorAll(".shift-header").forEach(el => el.textContent = (shiftState === "night" ? "NIGHT SHIFT" : "DAY SHIFT"));
}

document.addEventListener("DOMContentLoaded", async function() {
  setReportHeaders();
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);

  // Default shiftState
  let shiftState = "day";
  // Simpan di localStorage (optional, untuk konsistensi antar reload)
  localStorage.setItem("outbound_shift", shiftState);

  // Sign-in anonymous, lalu baru load report
  signInAnonymously(auth).then(() => {
    loadReportData(db, shiftState);

    // Event listener untuk toggle radio shift
    const shiftDay = document.getElementById("shiftDay");
    const shiftNight = document.getElementById("shiftNight");
    if (shiftDay && shiftNight) {
      shiftDay.addEventListener("change", function() {
        if (this.checked) {
          shiftState = "day";
          localStorage.setItem("outbound_shift", "day");
          updateShiftDisplay("day");
          document.querySelectorAll(".shift-header").forEach(el => el.textContent = "DAY SHIFT");
        }
      });
      shiftNight.addEventListener("change", function() {
        if (this.checked) {
          shiftState = "night";
          localStorage.setItem("outbound_shift", "night");
          updateShiftDisplay("night");
          document.querySelectorAll(".shift-header").forEach(el => el.textContent = "NIGHT SHIFT");
        }
      });
    }
  }).catch((error) => {
    alert("Gagal sign-in anonymous ke Firebase: " + error.message);
  });
});