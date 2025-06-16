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

  let shiftState = localStorage.getItem("outbound_shift") || "day";

  // Fetch all jobs ONCE
  const allJobsSnap = await get(ref(db, "PhxOutboundJobs"));
  let remainingQty = 0;
  let additionalQty = 0;
  let orderH1Qty = 0;
  let capDay = 0, capNight = 0;

  if (allJobsSnap.exists()) {
    allJobsSnap.forEach(childSnap => {
      const v = childSnap.val();
      if (v.jobType === "Remainning" && v.deliveryDate === todayStr) {
        remainingQty += Number(v.qty) || 0;
      }
      if (v.jobType === "Additional" && v.deliveryDate === todayStr) {
        additionalQty += Number(v.qty) || 0;
      }
      if (v.deliveryDate && v.deliveryDate !== todayStr) {
        orderH1Qty += Number(v.qty) || 0;
      }
      if (v.deliveryDate === todayStr && ["Reguler", "Sugity"].includes(v.team)) {
        if ((v.shift || "day") === "day") capDay += Number(v.qty) || 0;
        if ((v.shift || "day") === "night") capNight += Number(v.qty) || 0;
      }
    });
  }

  document.getElementById("remH-actual").textContent = formatNumber(remainingQty);
  document.getElementById("addH-actual").textContent = formatNumber(additionalQty);
  document.getElementById("orderH1-actual").textContent = formatNumber(orderH1Qty);
  const totalOrder = remainingQty + additionalQty + orderH1Qty;
  document.getElementById("totalOrder-actual").textContent = formatNumber(totalOrder);

  // ManPower
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
  document.getElementById("capDay-actual").textContent = (shiftState === "day") ? formatNumber(capDay) : "";
  document.getElementById("mpNight-actual").textContent = (shiftState === "night") ? formatNumber(mpNight) : "";
  document.getElementById("capNight-actual").textContent = (shiftState === "night") ? formatNumber(capNight) : "";
  document.getElementById("totalMP-actual").textContent = formatNumber(mpDay + mpNight);
  document.getElementById("totalCap-actual").textContent = formatNumber(capDay + capNight);
  document.getElementById("remainingOrder-actual").textContent = formatNumber(totalOrder - (capDay + capNight));
}

function setReportHeaders() {
  const today = getTodayDateObj();
  const pretty = prettyDate(today);
  document.querySelector(".report-date").textContent = pretty;
  document.querySelectorAll(".date-header").forEach(el => el.textContent = pretty);
  const shiftState = localStorage.getItem("outbound_shift") || "DAY SHIFT";
  document.querySelectorAll(".shift-header").forEach(el => el.textContent = (shiftState === "night" ? "NIGHT SHIFT" : "DAY SHIFT"));
}

document.addEventListener("DOMContentLoaded", function () {
  setReportHeaders();
  authPromise.then(() => {
    loadReportData();
  }).catch((error) => {
    alert("Gagal sign-in anonymous ke Firebase: " + error.message);
  });
});