import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAfIYig9-sv3RfazwAW6X937_5HJfgnYt4",
  authDomain: "outobund.firebaseapp.com",
  databaseURL: "https://outobund-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "outobund",
  storageBucket: "outobund.firebasestorage.app",
  messagingSenderId: "84643346476",
  appId: "1:84643346476:web:beb19c5ea0884fcb083989"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM refs
const dateInput = document.getElementById('dateInput');
const teamSelect = document.getElementById('teamSelect');
const tableBody = document.querySelector('#achievementTable tbody');
const summaryInfo = document.getElementById('summaryInfo');
const matrixJobCount = document.getElementById('matrixJobCount');
const matrixQty = document.getElementById('matrixQty');
const headerDetailBox = document.getElementById('headerDetailBox');

let selectedDate = null;
let currentTeams = [];

// Format date to db path prefix
function getDateDBPath(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  const yKey = 'year' + year;
  const mKey = `${month}_${year.slice(2)}`;
  return `${yKey}/${mKey}/${day}`;
}

// Get all teams available for the selected date (regardless of shift)
async function getTeamsForDate(dateStr) {
  if (!dateStr) return [];
  const path = getDateDBPath(dateStr);
  const dayRef = ref(db, path);
  const snap = await get(dayRef);
  if (!snap.exists()) return [];
  const shifts = snap.val();
  const teamSet = new Set();
  Object.values(shifts).forEach(shiftObj => {
    Object.keys(shiftObj).forEach(team => teamSet.add(team));
  });
  return Array.from(teamSet);
}

// Get all jobs for selected date and team (all shifts)
async function getJobsForDateTeam(dateStr, team) {
  if (!dateStr || !team) return [];
  const path = getDateDBPath(dateStr);
  const dayRef = ref(db, path);
  const snap = await get(dayRef);
  if (!snap.exists()) return [];
  const shifts = snap.val();
  let jobs = [];
  Object.values(shifts).forEach(shiftObj => {
    if (team in shiftObj) {
      jobs = jobs.concat(Object.values(shiftObj[team]));
    }
  });
  return jobs;
}

// Init FLATPICKR (all dates enabled)
let fp = null;
function initDatepicker() {
  fp = flatpickr("#dateInput", {
    dateFormat: "Y-m-d",
    allowInput: false,
    onChange: async function(selectedDates, dateStr, instance) {
      selectedDate = dateStr;
      await populateTeams();
      await renderTable();
    }
  });
}

// Populate teams
async function populateTeams() {
  teamSelect.innerHTML = '<option value="">Team</option>';
  if (!selectedDate) return;
  const teams = await getTeamsForDate(selectedDate);
  currentTeams = teams;
  teams.forEach(t => {
    teamSelect.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

// Render detail di atas tabel (ambil job pertama)
function renderHeaderDetail(job) {
  if (!job) {
    headerDetailBox.style.display = "none";
    headerDetailBox.innerHTML = "";
    return;
  }
  headerDetailBox.style.display = "block";
  headerDetailBox.innerHTML = `
    <div class="detail-row">
      <div class="detail-item"><span class="label">deliveryDate:</span> <span class="value">"${job.deliveryDate || '-'}"</span></div>
      <div class="detail-item"><span class="label">deliveryNote:</span> <span class="value">"${job.deliveryNote || '-'}"</span></div>
      <div class="detail-item"><span class="label">finishAt:</span> <span class="value">"${job.finishAt || '-'}"</span></div>
      <div class="detail-item"><span class="label">jobNo:</span> <span class="value">"${job.jobNo || '-'}"</span></div>
      <div class="detail-item"><span class="label">jobType:</span> <span class="value">"${job.jobType || '-'}"</span></div>
      <div class="detail-item"><span class="label">qty:</span> <span class="value">"${job.qty || '-'}"</span></div>
      <div class="detail-item"><span class="label">remark:</span> <span class="value">"${job.remark || '-'}"</span></div>
      <div class="detail-item"><span class="label">shift:</span> <span class="value">"${job.shift || '-'}"</span></div>
      <div class="detail-item"><span class="label">status:</span> <span class="value">"${job.status || '-'}"</span></div>
      <div class="detail-item"><span class="label">team:</span> <span class="value">"${job.team || '-'}"</span></div>
      <div class="detail-item"><span class="label">teamName:</span> <span class="value">"${job.teamName || '-'}"</span></div>
    </div>
  `;
}

// Render Table & Summary
async function renderTable() {
  const team = teamSelect.value;
  let jobs = [];
  if (selectedDate && team) {
    jobs = await getJobsForDateTeam(selectedDate, team);
  }

  tableBody.innerHTML = '';
  let totalQty = 0;
  jobs.forEach(job => {
    totalQty += parseInt(job.qty) || 0;
    tableBody.innerHTML += `
      <tr>
        <td>${job.deliveryDate || '-'}</td>
        <td>${job.deliveryNote || '-'}</td>
        <td>${job.finishAt || '-'}</td>
        <td>${job.jobNo || '-'}</td>
        <td>${job.jobType || '-'}</td>
        <td>${job.qty || '-'}</td>
        <td>${job.remark || '-'}</td>
        <td>${job.shift || '-'}</td>
        <td>
          <span class="badge ${
            job.status === "Completed" ? "badge-completed" :
            job.status === "In Progress" ? "badge-inprogress" : "badge-other"
          }">${job.status || '-'}</span>
        </td>
        <td>${job.team || '-'}</td>
        <td>${job.teamName || '-'}</td>
        <td>
          <button class="btn btn-detail" onclick="showDetail('${job.jobNo}')">Detail</button>
        </td>
      </tr>
      <tr class="detail-row" style="display:none;" id="detail-${job.jobNo}">
        <td colspan="12">
          <b>Delivery Note:</b> ${job.deliveryNote || '-'}<br>
          <b>Remark:</b> ${job.remark || '-'}
        </td>
      </tr>
    `;
  });

  matrixJobCount.textContent = jobs.length;
  matrixQty.textContent = totalQty;

  if (!selectedDate || !team) {
    summaryInfo.textContent = 'Pilih tanggal dan filter di atas';
    renderHeaderDetail(null);
  } else if (jobs.length === 0) {
    summaryInfo.textContent = `Tanggal: ${selectedDate} | Team: ${team} - Tidak ada data.`;
    renderHeaderDetail(null);
  } else {
    summaryInfo.textContent = `Tanggal: ${selectedDate} | Team: ${team}`;
    renderHeaderDetail(jobs[0]);
  }
}

// Detail row toggle
window.showDetail = function(jobNo) {
  const row = document.getElementById('detail-'+jobNo);
  if (row) row.style.display = (row.style.display === 'none' ? 'table-row' : 'none');
};

document.getElementById('exportBtn').onclick = function() {
  alert('Export Excel: fitur dummy. Integrasikan dengan SheetJS/Excel sesuai kebutuhan.');
}

document.getElementById('refreshBtn').onclick = function() {
  dateInput.value = '';
  selectedDate = null;
  teamSelect.innerHTML = '<option value="">Team</option>';
  summaryInfo.textContent = 'Pilih tanggal dan filter di atas';
  matrixJobCount.textContent = '-';
  matrixQty.textContent = '-';
  tableBody.innerHTML = '';
  headerDetailBox.style.display = "none";
  headerDetailBox.innerHTML = "";
  if (fp) fp.clear();
};

teamSelect.addEventListener('change', async () => {
  await renderTable();
});

// INIT
(async function() {
  const auth = getAuth(app);
  await signInAnonymously(auth);
  initDatepicker();
})();