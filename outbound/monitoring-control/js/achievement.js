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
const shiftSelect = document.getElementById('shiftSelect');
const teamSelect = document.getElementById('teamSelect');
const matrixJobCount = document.getElementById('matrixJobCount');
const matrixQty = document.getElementById('matrixQty');
const notifBox = document.getElementById('notifBox');
let selectedDate = null;
let dataTable = null;

// Helper: format tanggal ke path
function getDateDBPath(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  const yKey = 'year' + year;
  const mKey = `${month}_${year.slice(2)}`;
  return `${yKey}/${mKey}/${day}`;
}

// Show notification
function showNotif({type, message}) {
  notifBox.innerHTML = `<div class="notif-${type}">${message}</div>`;
  setTimeout(() => notifBox.innerHTML = '', 3000);
}

// Populate shift selector (cek shift apa yang ada pada tanggal)
async function populateShifts() {
  shiftSelect.value = "";
  shiftSelect.disabled = true;
  teamSelect.innerHTML = '<option value="">Team</option>';
  teamSelect.disabled = true;
  if (!selectedDate) return;
  try {
    const path = `outJobAchievment/${getDateDBPath(selectedDate)}`;
    const dayRef = ref(db, path);
    const snap = await get(dayRef);
    if (!snap.exists()) {
      showNotif({type: "error", message: "Data tidak ditemukan untuk tanggal ini."});
      return;
    }
    const shifts = Object.keys(snap.val());
    shiftSelect.innerHTML = `<option value="">Pilih shift</option>`;
    shifts.forEach(shift => {
      shiftSelect.innerHTML += `<option value="${shift}">${shift.replace(/Shift$/,' Shift')}</option>`;
    });
    shiftSelect.disabled = false;
    showNotif({type:"success", message:"Shift ditemukan!"});
  } catch (err) {
    showNotif({type: "error", message: "Gagal mengambil shift: " + err.message});
  }
}

// Populate team selector
async function populateTeams() {
  teamSelect.innerHTML = '<option value="">Team</option>';
  teamSelect.disabled = true;
  if (!selectedDate || !shiftSelect.value) return;
  try {
    const path = `outJobAchievment/${getDateDBPath(selectedDate)}/${shiftSelect.value}`;
    const shiftRef = ref(db, path);
    const snap = await get(shiftRef);
    if (!snap.exists()) {
      showNotif({type: "error", message: "Tidak ada team untuk shift ini."});
      return;
    }
    const teams = Object.keys(snap.val());
    teams.forEach(t => {
      teamSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
    teamSelect.disabled = false;
    showNotif({type:"success", message:"Team ditemukan!"});
  } catch (err) {
    showNotif({type: "error", message: "Gagal mengambil team: " + err.message});
  }
}

// Render DataTable & Summary
async function renderTable() {
  const team = teamSelect.value;
  const shift = shiftSelect.value;
  let jobs = [];
  if (selectedDate && shift && team) {
    try {
      const path = `outJobAchievment/${getDateDBPath(selectedDate)}/${shift}/${team}`;
      const teamRef = ref(db, path);
      const snap = await get(teamRef);
      if (!snap.exists()) {
        showNotif({type:"error", message: "Tidak ada job untuk team ini."});
        matrixJobCount.textContent = '0';
        matrixQty.textContent = '0';
        if (dataTable) dataTable.clear().draw();
        else $('#achievementTable').DataTable().clear().draw();
        return;
      }
      jobs = Object.values(snap.val());
      showNotif({type:"success", message:"Data berhasil di-load!"});
    } catch (err) {
      showNotif({type: "error", message: "Gagal load data: " + err.message});
      jobs = [];
    }
  }
  const rowData = jobs.map(job => [
    job.jobNo || '-',
    job.deliveryDate || '-',
    job.deliveryNote || '-',
    job.remark || '-',
    job.finishAt || '-',
    job.jobType || '-',
    job.shift || '-',
    job.team || '-',
    job.teamName || '-',
    (job.qty !== undefined && job.qty !== null && job.qty !== "") ? Number(job.qty).toLocaleString('en-US') : '-'
  ]);
  // DataTables logic
  if (dataTable) {
    dataTable.clear();
    dataTable.rows.add(rowData);
    dataTable.draw();
  } else {
    dataTable = $('#achievementTable').DataTable({
      data: rowData,
      pageLength: 40,
      destroy: true,
      columns: [
        { title: "Job No" },
        { title: "Delivery Date" },
        { title: "Delivery Note" },
        { title: "Remark" },
        { title: "Finish At" },
        { title: "Job Type" },
        { title: "Shift" },
        { title: "Team" },
        { title: "Team Name" },
        { title: "Qty" }
      ],
      dom: 'Bfrtip',
      buttons: [
        {
          extend: 'excelHtml5',
          text: '⬇ Export Excel',
          className: 'btn btn-export',
          exportOptions: { columns: ':visible' }
        }
      ],
      language: {
        emptyTable: "Data tidak tersedia."
      }
    });
  }
  matrixJobCount.textContent = jobs.length;
  matrixQty.textContent = jobs.reduce((acc, job) => acc + (parseInt(job.qty)||0), 0).toLocaleString('en-US');
}

// Export tombol DataTables, jadi tidak perlu tombol custom

document.getElementById('refreshBtn').onclick = function() {
  dateInput.value = '';
  selectedDate = null;
  shiftSelect.innerHTML = `<option value="">Pilih shift</option>`;
  shiftSelect.disabled = true;
  teamSelect.innerHTML = '<option value="">Team</option>';
  teamSelect.disabled = true;
  matrixJobCount.textContent = '-';
  matrixQty.textContent = '-';
  notifBox.innerHTML = '';
  if (dataTable) dataTable.clear().draw();
  if (fp) fp.clear();
};

// Event binding
let fp = null;
function initDatepicker() {
  fp = flatpickr("#dateInput", {
    dateFormat: "Y-m-d",
    allowInput: false,
    onChange: async function(selectedDates, dateStr, instance) {
      selectedDate = dateStr;
      await populateShifts();
      teamSelect.innerHTML = '<option value="">Team</option>';
      teamSelect.disabled = true;
      matrixJobCount.textContent = '-';
      matrixQty.textContent = '-';
      if (dataTable) dataTable.clear().draw();
    }
  });
}
shiftSelect.addEventListener('change', async () => {
  await populateTeams();
  matrixJobCount.textContent = '-';
  matrixQty.textContent = '-';
  if (dataTable) dataTable.clear().draw();
});
teamSelect.addEventListener('change', async () => {
  await renderTable();
});

// INIT
(async function() {
  const auth = getAuth(app);
  await signInAnonymously(auth);
  initDatepicker();
})();