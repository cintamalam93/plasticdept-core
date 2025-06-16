// File: js/report-data.js
// Mengisi tabel report dengan data dari Firebase Realtime Database, 
// sudah mendukung sign-in anonymous (modular SDK) dan filter data di JS tanpa orderByChild.
// Komentar sudah ditambahkan pada setiap fungsi dan listener.

import { db, authPromise } from "./config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

/**
 * Helper untuk memformat angka dengan pemisah ribuan.
 * @param {number|string} n 
 * @returns {string}
 */
function formatNumber(n) {
  n = Number(n);
  if (typeof n !== "number" || isNaN(n)) return "-";
  return n.toLocaleString("en-US");
}

/**
 * Helper: Mengembalikan tanggal hari ini dalam format "dd-MMM-yyyy" (misal: "16-Jun-2025").
 * @returns {string}
 */
function getTodayDateFormatted() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("en-US", { month: "short" }); // "Jun"
  const year = today.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Helper: Mengembalikan tanggal hari ini sebagai objek Date.
 * @returns {Date}
 */
function getTodayDateObj() {
  const today = new Date();
  today.setHours(0,0,0,0);
  return today;
}

/**
 * Helper: Mengembalikan string tanggal cantik untuk header laporan.
 * @param {Date} date 
 * @returns {string}
 */
function prettyDate(date) {
  const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const bulan = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${hari[date.getDay()]}, ${date.getDate().toString().padStart(2,"0")}-${bulan[date.getMonth()]}-${date.getFullYear()}`;
}

/**
 * Fungsi utama untuk mengambil data dan mengisi tabel laporan.
 * @param {Database} db - Instance database Firebase.
 */
async function loadReportData(db) {
  const todayStr = getTodayDateFormatted(); // contoh: "16-Jun-2025"
  const shiftState = (localStorage.getItem("outbound_shift") || "day").toLowerCase();

  // Ambil semua data PhxOutboundJobs dan ManPower sekaligus
  const [jobsSnap, mpSnap] = await Promise.all([
    get(ref(db, "PhxOutboundJobs")),
    get(ref(db, "ManPower"))
  ]);

  // Inisialisasi variabel penampung data
  let qtyRemainning = 0;
  let qtyAdditional = 0;
  let qtyOrderH1 = 0;
  let qtyCapDay = 0;
  let qtyCapNight = 0;
  let mpDay = 0;
  let mpNight = 0;

  // --------- Ambil data PhxOutboundJobs ---------
  if (jobsSnap.exists()) {
    jobsSnap.forEach(childSnap => {
      const v = childSnap.val();
      // Pastikan field ada dan format sesuai
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
        // Semua dianggap shift day, karena tidak ada field shift di job.
        qtyCapDay += qty;
        // Jika nanti night shift pada job ditambahkan, tambahkan logika di sini.
      }
    });
  }

  // 4. Total Order (Remaining + Additional + Order H-1)
  const totalOrder = qtyRemainning + qtyAdditional + qtyOrderH1;

  // --------- Ambil data ManPower ---------
  // Mp day shift diambil dari penjumlahan ManPower/Reguler + ManPower/Sugity
  if (mpSnap.exists()) {
    const mpVal = mpSnap.val();
    mpDay = (Number(mpVal.Reguler) || 0) + (Number(mpVal.Sugity) || 0);
    // Mp night shift: tambahkan logika jika ada node night shift di database
    mpNight = 0;
  }

  // 9. Total MP (Mp day shift + Mp night shift)
  const totalMP = mpDay + mpNight;
  // 10. Total Capacity (Capacity day shift + night shift)
  const totalCapacity = qtyCapDay + qtyCapNight;
  // 11. Remaining order (Total Order - Total Capacity)
  const sisaOrder = totalOrder - totalCapacity;

  // --------- Isi ke DOM ---------
  document.getElementById("remH-actual").textContent = formatNumber(qtyRemainning);
  document.getElementById("addH-actual").textContent = formatNumber(qtyAdditional);
  document.getElementById("orderH1-actual").textContent = formatNumber(qtyOrderH1);
  document.getElementById("totalOrder-actual").textContent = formatNumber(totalOrder);
  document.getElementById("mpDay-actual").textContent = (shiftState === "day") ? formatNumber(mpDay) : "";
  document.getElementById("capDay-actual").textContent = (shiftState === "day") ? formatNumber(qtyCapDay) : "";
  document.getElementById("mpNight-actual").textContent = (shiftState === "night") ? formatNumber(mpNight) : "";
  document.getElementById("capNight-actual").textContent = (shiftState === "night") ? formatNumber(qtyCapNight) : "";
  document.getElementById("totalMP-actual").textContent = formatNumber(totalMP);
  document.getElementById("totalCap-actual").textContent = formatNumber(totalCapacity);
  document.getElementById("remainingOrder-actual").textContent = formatNumber(sisaOrder);
}

/**
 * Mengisi header tanggal dan shift pada laporan.
 */
function setReportHeaders() {
  const today = getTodayDateObj();
  const pretty = prettyDate(today);
  document.querySelector(".report-date").textContent = pretty;
  document.querySelectorAll(".date-header").forEach(el => el.textContent = pretty);
  const shiftState = (localStorage.getItem("outbound_shift") || "DAY SHIFT").toLowerCase();
  document.querySelectorAll(".shift-header").forEach(el => el.textContent = (shiftState === "night" ? "NIGHT SHIFT" : "DAY SHIFT"));
}

// Listener utama: setelah DOM siap, inisialisasi Firebase, lalu sign-in anonymous dan load data laporan
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