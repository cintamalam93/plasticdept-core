// Dummy data for demo (replace with actual DB calls)
const dummyDB = {
  year2025: {
    "07_25": {
      "02": {
        DayShift: {
          "Blue Team": {
            OUT2025070001E: {
              deliveryDate: "30-Jun-2025",
              deliveryNote: "900/PL_SCRAP/IDP1/VI/2025",
              finishAt: "09:43",
              jobNo: "OUT2025070001E",
              jobType: "Remaining",
              qty: "25",
              remark: "SCRAP NON MSIG TGL 30/6/25",
              shift: "Day Shift",
              status: "Completed",
              team: "Reguler",
              teamName: "Blue Team"
            },
            OUT20250700021: {
              deliveryDate: "30-Jun-2025",
              deliveryNote: "892/PL_SCRAP/IDP1/VI/2025",
              finishAt: "10:15",
              jobNo: "OUT20250700021",
              jobType: "Remaining",
              qty: "50",
              remark: "SCRAP NON MSIG TGL 30/6/25",
              shift: "Day Shift",
              status: "Completed",
              team: "Reguler",
              teamName: "Blue Team"
            }
          }
        }
      }
    }
  }
};

// Parse dummyDB to get all available dates (for enable in datepicker)
function getAvailableDates() {
  const result = [];
  for (const y of Object.keys(dummyDB)) {
    const yearNum = y.replace("year", "");
    for (const m of Object.keys(dummyDB[y])) {
      const [_month, _yearShort] = m.split("_");
      for (const d of Object.keys(dummyDB[y][m])) {
        // Format date: yyyy-mm-dd
        const dateStr = `${yearNum}-${_month.padStart(2, '0')}-${d.padStart(2, '0')}`;
        result.push(dateStr);
      }
    }
  }
  return result;
}

// Helper: get available teams for the selected date/shift
function getTeamsForDate(dateStr, shift) {
  if (!dateStr) return [];
  const [year, month, day] = dateStr.split('-');
  const yKey = 'year' + year;
  let mKey = null;
  for (const m of Object.keys(dummyDB[yKey] || {})) {
    if (m.startsWith(month)) mKey = m;
  }
  if (!mKey) return [];
  const dayObj = dummyDB[yKey]?.[mKey]?.[day];
  if (!dayObj) return [];
  const shiftObj = dayObj[shift];
  if (!shiftObj) return [];
  return Object.keys(shiftObj);
}

// Helper: get jobs for the selected date/shift/team
function getJobsForDate(dateStr, shift, team) {
  if (!dateStr || !shift || !team) return [];
  const [year, month, day] = dateStr.split('-');
  const yKey = 'year' + year;
  let mKey = null;
  for (const m of Object.keys(dummyDB[yKey] || {})) {
    if (m.startsWith(month)) mKey = m;
  }
  if (!mKey) return [];
  const jobsObj = dummyDB[yKey]?.[mKey]?.[day]?.[shift]?.[team];
  if (!jobsObj) return [];
  return Object.values(jobsObj);
}

// DOM refs
const dateInput = document.getElementById('dateInput');
const shiftSelect = document.getElementById('shiftSelect');
const teamSelect = document.getElementById('teamSelect');
const tableBody = document.querySelector('#achievementTable tbody');
const summaryInfo = document.getElementById('summaryInfo');
const summaryJobCount = document.getElementById('summaryJobCount');
const summaryQty = document.getElementById('summaryQty');
const headerDetailBox = document.getElementById('headerDetailBox');

// Init Air Datepicker
let selectedDate = null;
const availableDates = getAvailableDates();
const dp = new AirDatepicker('#dateInput', {
  autoClose: true,
  dateFormat: 'yyyy-MM-dd',
  minDate: availableDates.length > 0 ? availableDates[0] : null,
  maxDate: availableDates.length > 0 ? availableDates[availableDates.length-1] : null,
  onRenderCell({date, cellType}) {
    // Enable only available dates
    if (cellType === 'day') {
      const y = date.getFullYear();
      const m = (date.getMonth()+1).toString().padStart(2,'0');
      const d = date.getDate().toString().padStart(2,'0');
      const key = `${y}-${m}-${d}`;
      if (!availableDates.includes(key)) {
        return { disabled: true };
      }
    }
  },
  onSelect({date, formattedDate}) {
    selectedDate = formattedDate;
    populateTeams();
    renderTable();
  }
});

// Populate teams
function populateTeams() {
  teamSelect.innerHTML = '<option value="">Team</option>';
  const shift = shiftSelect.value;
  const teams = getTeamsForDate(selectedDate, shift);
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
function renderTable() {
  const shift = shiftSelect.value;
  const team = teamSelect.value;
  const jobs = getJobsForDate(selectedDate, shift, team);

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

  // Update summary & detail header
  if (!selectedDate || !shift || !team) {
    summaryInfo.textContent = 'Pilih tanggal dan filter di atas';
    summaryJobCount.textContent = '';
    summaryQty.textContent = '';
    renderHeaderDetail(null);
  } else if (jobs.length === 0) {
    summaryInfo.textContent = `Tanggal: ${selectedDate} | Shift: ${shift} | Team: ${team}`;
    summaryJobCount.textContent = 'Tidak ada data achievement pada tanggal ini.';
    summaryQty.textContent = '';
    renderHeaderDetail(null);
  } else {
    summaryInfo.textContent = `Tanggal: ${selectedDate} | Shift: ${shift} | Team: ${team}`;
    summaryJobCount.textContent = `Total Job: ${jobs.length}`;
    summaryQty.textContent = `Total Qty: ${totalQty}`;
    renderHeaderDetail(jobs[0]);
  }
}

// Detail row toggle
window.showDetail = function(jobNo) {
  const row = document.getElementById('detail-'+jobNo);
  if (row) row.style.display = (row.style.display === 'none' ? 'table-row' : 'none');
};

// Export dummy
document.getElementById('exportBtn').onclick = function() {
  alert('Export Excel: fitur dummy. Integrasikan dengan SheetJS/Excel sesuai kebutuhan.');
}

// Refresh
document.getElementById('refreshBtn').onclick = function() {
  // Reset date, shift, team
  dateInput.value = '';
  selectedDate = null;
  shiftSelect.value = 'DayShift';
  teamSelect.innerHTML = '<option value="">Team</option>';
  summaryInfo.textContent = 'Pilih tanggal dan filter di atas';
  summaryJobCount.textContent = '';
  summaryQty.textContent = '';
  tableBody.innerHTML = '';
  headerDetailBox.style.display = "none";
  headerDetailBox.innerHTML = "";
  dp.clear();
};

// Dropdown change logic
shiftSelect.addEventListener('change', () => {
  populateTeams();
  renderTable();
});
teamSelect.addEventListener('change', () => {
  renderTable();
});

// Init view
// (Let user pick date first)