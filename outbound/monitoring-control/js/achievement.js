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
const matrixQtyOvertime = document.getElementById('matrixQtyOvertime');
const matrixQtyAdditional = document.getElementById('matrixQtyAdditional');
const matrixQtyRemaining = document.getElementById('matrixQtyRemaining');
const matrixQtyH1 = document.getElementById('matrixQtyH1');
const notifBox = document.getElementById('notifBox');
let selectedDate = null;
let dataTable = null;
let fp = null;

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
      shiftSelect.innerHTML += `<option value="${shift}">${shift.replace(/Shift$/, ' Shift')}</option>`;
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
        matrixQtyRemaining.textContent = '0';
        matrixQtyAdditional.textContent = '0';
        matrixQtyH1.textContent = '0';
        matrixQtyOvertime.textContent = '0';
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

  // Hitung summary card (qty per tipe job)
  let qtyRemaining = 0, qtyAdditional = 0, qtyH1 = 0, qtyOvertime = 0;
  jobs.forEach(job => {
    if (!job.qty) return;
    if (job.jobType && typeof job.jobType === 'string') {
      const type = job.jobType.toLowerCase();
      if (type.includes('remaining')) {
        qtyRemaining += parseInt(job.qty) || 0;
      } else if (type.includes('add')) {
        qtyAdditional += parseInt(job.qty) || 0;
      } else if (type.includes('h-1')) {
        qtyH1 += parseInt(job.qty) || 0;
      } else if (type.includes('ot')) {
        qtyOvertime += parseInt(job.qty) || 0;
      }
    }
  });

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
      dom: 'Bft',
      language: {
        emptyTable: "Data tidak tersedia."
      }
    });

    setTimeout(() => {
      const $filter = $('#achievementTable_filter');
      const $buttons = $('.dt-buttons');
      $filter.css({
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'flex-end',
        gap: '10px'
      });
      $buttons.appendTo($filter).css({'margin': '0', 'float': 'none'});
    }, 0);

    $(document).on('draw.dt', function() {
      $('.custom-excel-btn')
        .css({
          'background': 'linear-gradient(90deg, #1e579c 75%, #4288e6)',
          'color': '#fff',
          'border': 'none',
          'border-radius': '7px',
          'padding': '0 18px',
          'height': '36px',
          'font-size': '1em',
          'font-weight': '500',
          'cursor': 'pointer',
          'box-shadow': '0 1px 4px #b4c8e635',
          'transition': 'background 0.2s, filter 0.2s',
          'display': 'inline-flex',
          'align-items': 'center',
          'gap': '7px',
          'margin-right': '10px'
        })
        .hover(
          function() { $(this).css('filter', 'brightness(1.08)'); },
          function() { $(this).css('filter', 'none'); }
        );
    });
  }
  matrixJobCount.textContent = jobs.length;
  matrixQty.textContent = jobs.reduce((acc, job) => acc + (parseInt(job.qty) || 0), 0).toLocaleString('en-US');
  matrixQtyRemaining.textContent = qtyRemaining.toLocaleString('en-US');
  matrixQtyAdditional.textContent = qtyAdditional.toLocaleString('en-US');
  matrixQtyH1.textContent = qtyH1.toLocaleString('en-US');
  matrixQtyOvertime.textContent = qtyOvertime.toLocaleString('en-US');
}

// Jangan lupa di bagian reset juga!
document.getElementById('refreshBtn').onclick = function() {
  dateInput.value = '';
  selectedDate = null;
  shiftSelect.innerHTML = `<option value="">Pilih shift</option>`;
  shiftSelect.disabled = true;
  teamSelect.innerHTML = '<option value="">Team</option>';
  teamSelect.disabled = true;
  matrixJobCount.textContent = '-';
  matrixQty.textContent = '-';
  matrixQtyRemaining.textContent = '-';
  matrixQtyAdditional.textContent = '-';
  matrixQtyH1.textContent = '-';
  matrixQtyOvertime.textContent = '-';
  notifBox.innerHTML = '';
  if (dataTable) dataTable.clear().draw();
  if (fp) fp.clear();
};
// Event binding
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
      matrixQtyOvertime.textContent = '-';
      matrixQtyAdditional.textContent = '-';
      matrixQtyRemaining.textContent = '-';
      if (dataTable) dataTable.clear().draw();
    }
  });
}
shiftSelect.addEventListener('change', async () => {
  await populateTeams();
  matrixJobCount.textContent = '-';
  matrixQty.textContent = '-';
  matrixQtyOvertime.textContent = '-';
  matrixQtyAdditional.textContent = '-';
  matrixQtyRemaining.textContent = '-';
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

document.getElementById('customExportBtn').onclick = function() {
  // Ambil nilai summary card
  const summary = [
    ['Total Job', ':', matrixJobCount.textContent],
    ['Total Qty', ':', matrixQty.textContent],
    ['Qty Remaining', ':', matrixQtyRemaining.textContent],
    ['Qty Additional', ':', matrixQtyAdditional.textContent],
    ['Qty H-1', ':', matrixQtyH1.textContent],
    ['Qty Overtime', ':', matrixQtyOvertime.textContent]
  ];

  // Title row (merge nanti)
  const title = [['', '', '', 'Outbound Achievement Report']];

  // Table header (samakan dengan DataTables)
  const tableHeaders = [
    ['Job No', 'Delivery Date', 'Delivery Note', 'Remark', 'Finish At', 'Job Type', 'Shift', 'Team', 'Team Name', 'Qty']
  ];

  // Table data (ambil dari DataTables saja supaya pasti urut dan sesuai filter)
  const tableData = dataTable.rows({search: 'applied'}).data().toArray();

  // Gabungkan semua
  const wsData = [
    ...summary,
    [],
    ...title,
    [],
    ...tableHeaders,
    ...tableData
  ];

  // Buat worksheet & workbook
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merge judul
  ws['!merges'] = [
    {s: {r: 7, c: 3}, e: {r: 7, c: 8}} // merge Outbound Achievement Report (baris ke-8, kolom D sampai I)
  ];

  // Buat workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Outbound Report");

  // Export
  XLSX.writeFile(wb, `Outbound_Achievement_Report.xlsx`);
};