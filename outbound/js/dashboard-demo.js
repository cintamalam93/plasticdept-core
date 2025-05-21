// DEMO DATA GENERATOR & DASHBOARD LOGIC

// Simple random data for demo
function randomInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function getRandomStatus() {
  const arr = ['New', 'Packed', 'Loaded'];
  return arr[randomInt(0, arr.length - 1)];
}
function getRandomTeam() {
  const arr = ['Reguler', 'Sugity'];
  return arr[randomInt(0, arr.length - 1)];
}
function pad2(n) { return n < 10 ? '0' + n : n; }

function generateJobs(count = 20) {
  const today = new Date();
  let jobs = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = randomInt(0, 6);
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    const job = {
      jobNo: 'JOB' + randomInt(10000, 99999),
      deliveryDate: `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`,
      status: getRandomStatus(),
      qty: randomInt(1, 30) * 50,
      team: getRandomTeam(),
    };
    jobs.push(job);
  }
  return jobs;
}

// Global state
let allJobs = generateJobs(30);
let planTarget = 25000;
let planRealisasi = allJobs.reduce((acc, job) => acc + (job.status !== 'New' ? job.qty : 0), 0);

// Chart.js objects
let statusPieChart, dailyBarChart;

function updateDashboard() {
  // Summary cards
  document.getElementById('totalJobs').textContent = allJobs.length;
  document.getElementById('newJobs').textContent = allJobs.filter(j => j.status === 'New').length;
  document.getElementById('packedJobs').textContent = allJobs.filter(j => j.status === 'Packed').length;
  document.getElementById('loadedJobs').textContent = allJobs.filter(j => j.status === 'Loaded').length;

  // Plan progress
  planRealisasi = allJobs.reduce((acc, job) => acc + (job.status === 'Loaded' ? job.qty : 0), 0);
  document.getElementById('planVsReal').textContent = `${planRealisasi.toLocaleString()} / ${planTarget.toLocaleString()}`;
  let percent = Math.min(100, Math.floor(100 * planRealisasi / planTarget));
  document.getElementById('planFill').style.width = percent + '%';

  // Pie chart
  const pieData = {
    labels: ['New', 'Packed', 'Loaded'],
    datasets: [{
      data: [
        allJobs.filter(j => j.status === 'New').length,
        allJobs.filter(j => j.status === 'Packed').length,
        allJobs.filter(j => j.status === 'Loaded').length
      ],
      backgroundColor: [
        '#2176ae', '#ffb347', '#2ecc71'
      ],
      borderWidth: 0
    }]
  };
  if (!statusPieChart) {
    statusPieChart = new Chart(document.getElementById('statusPieChart'), {
      type: 'doughnut',
      data: pieData,
      options: {
        plugins: {
          legend: { display: true, position: 'bottom' },
        }
      }
    });
  } else {
    statusPieChart.data = pieData;
    statusPieChart.update();
  }

  // Bar chart (Jobs per Day)
  let days = [];
  let counts = [];
  for (let i = 6; i >= 0; i--) {
    let d = new Date();
    d.setDate(d.getDate() - i);
    let key = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    days.push(`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}`);
    counts.push(allJobs.filter(j => j.deliveryDate === key).length);
  }
  const barData = {
    labels: days,
    datasets: [{
      label: 'Jobs',
      data: counts,
      backgroundColor: '#2176ae'
    }]
  };
  if (!dailyBarChart) {
    dailyBarChart = new Chart(document.getElementById('dailyBarChart'), {
      type: 'bar',
      data: barData,
      options: {
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  } else {
    dailyBarChart.data = barData;
    dailyBarChart.update();
  }

  // Table
  renderTable(allJobs);
  // Last update
  const now = new Date();
  document.getElementById('lastUpdate').textContent =
    `Last updated: ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

// Table render
function renderTable(jobs) {
  const tBody = document.getElementById('recentJobsTable');
  tBody.innerHTML = '';
  jobs
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
    .slice(0, 12)
    .forEach(job => {
      const tr = document.createElement('tr');
      // Highlight if status = New (warning) or qty > 1000 (critical, demo)
      if (job.status === 'New') tr.classList.add('highlight');
      if (job.qty > 1000) tr.classList.add('critical');
      tr.innerHTML = `
        <td><b>${job.jobNo}</b></td>
        <td>${job.deliveryDate}</td>
        <td>${job.status}</td>
        <td>${job.qty.toLocaleString()}</td>
        <td>${job.team}</td>
      `;
      tBody.appendChild(tr);
    });
}

// Filter
function applyFilters() {
  let status = document.getElementById('filterStatus').value;
  let date = document.getElementById('filterDate').value;
  let team = document.getElementById('filterTeam').value;
  let filtered = allJobs.filter(job =>
    (status === 'all' || job.status === status) &&
    (date === '' || job.deliveryDate === date) &&
    (team === 'all' || job.team === team)
  );
  renderTable(filtered);
}

// Reset filters
document.getElementById('resetFilters').onclick = function() {
  document.getElementById('filterStatus').value = 'all';
  document.getElementById('filterDate').value = '';
  document.getElementById('filterTeam').value = 'all';
  updateDashboard();
};

// Filter listeners
document.getElementById('filterStatus').onchange = applyFilters;
document.getElementById('filterDate').onchange = applyFilters;
document.getElementById('filterTeam').onchange = applyFilters;

// Fullscreen
document.getElementById('fullscreenBtn').onclick = function() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
};

// Simulasi status koneksi
function setStatus(online = true) {
  const el = document.getElementById('statusIndicator');
  el.innerHTML = `<span class="dot ${online ? 'online' : 'offline'}"></span> Realtime ${online ? 'Connected' : 'Disconnected'}`;
}

// Demo: update data setiap 10 detik
setInterval(() => {
  // Untuk demo, regenerate jobs
  allJobs = generateJobs(30);
  updateDashboard();
  setStatus(true);
}, 10000);

// Initial
updateDashboard();
setStatus(true);