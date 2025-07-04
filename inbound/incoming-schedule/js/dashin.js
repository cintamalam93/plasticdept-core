document.addEventListener("DOMContentLoaded", function () {
  const table = $("#containerTable").DataTable({
    order: [[12, 'asc']] // kolom ke-12 (index ke-11) = "Time In"
  });
  

  // Konfigurasi Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyDDw17I5NwibE9BXl0YoILPQqoPQfCKH4Q",
    authDomain: "inbound-d8267.firebaseapp.com",
    databaseURL: "https://inbound-d8267-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "inbound-d8267",
    storageBucket: "inbound-d8267.firebasestorage.app",
    messagingSenderId: "852665126418",
    appId: "1:852665126418:web:e4f029b83995e29f3052cb"
  };

  // Inisialisasi Firebase
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();

  function getStatusProgress(timeIn, unloadingTime, finish) {
    timeIn = (timeIn || "").trim();
    unloadingTime = (unloadingTime || "").trim();
    finish = (finish || "").trim();
    if ([timeIn, unloadingTime, finish].some(val => val === "0")) return "Reschedule";
    if ([timeIn, unloadingTime, finish].every(val => val === "")) return "Waiting";
    if ([timeIn, unloadingTime, finish].every(val => val === "-")) return "Reschedule";
    if (timeIn && (!unloadingTime || unloadingTime === "-")) return "Outstanding";
    if (timeIn && unloadingTime && (!finish || finish === "-")) return "Processing";
    if (timeIn && unloadingTime && finish) return "Finish";
    return "";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("/");
    if (parts.length !== 3) return dateStr;
  
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
  
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
    const shortYear = year.toString().slice(-2);
    return `${day}-${monthNames[month]}-${shortYear}`;
  }
  
  

  function renderRow(row, index, id) {
    if (!row || !row["FEET"] || !row["PACKAGE"]) return "";

    const feet = row["FEET"].trim().toUpperCase();
    const packageVal = row["PACKAGE"].trim().toUpperCase();
    let np20 = "", np40 = "", p20 = "", p40 = "";
    const isBag = packageVal.includes("BAG");

    if (feet === '1X20' && isBag) np20 = '✔';
    else if (feet === '1X40' && isBag) np40 = '✔';
    else if (feet === '1X20' && !isBag) p20 = '✔';
    else if (feet === '1X40' && !isBag) p40 = '✔';

    const timeIn = row["TIME IN"] === "-" ? "" : (row["TIME IN"] || "");
    const unloadingTime = row["UNLOADING TIME"] === "-" ? "" : (row["UNLOADING TIME"] || "");
    const finish = row["FINISH"] === "-" ? "" : (row["FINISH"] || "");
    const status = getStatusProgress(timeIn, unloadingTime, finish);

    return `
      <tr data-id="${id}">
        <td>${index + 1}</td>
        <td>${row["NO CONTAINER"] || ""}</td>
        <td>${feet}</td>
        <td>${np20}</td>
        <td>${np40}</td>
        <td>${p20}</td>
        <td>${p40}</td>
        <td>${row["INVOICE NO"] || ""}</td>
        <td>${row["PACKAGE"] || ""}</td>
        <td>${formatDate(row["INCOMING PLAN"])}</td>
        <td class="status-progress" data-status="${status}">
          <span class="label label-${status.toLowerCase()}">${status}</span>
        </td>
        <td>${timeIn}</td>
        <td>${unloadingTime}</td>
        <td>${finish}</td>
      </tr>
    `;
  }

  function loadFirebaseData() {
  database.ref("incoming_schedule").on("value", snapshot => {
    const data = snapshot.val() || {};
    table.clear();

    let index = 0;
    for (const id in data) {
      const row = data[id];
      const html = renderRow(row, index++, id);
      if (html) table.row.add($(html));
    }

    table.draw();
    table.on('order.dt search.dt', function () {
      table.column(0, { search: 'applied', order: 'applied' }).nodes().each(function (cell, i) {
        cell.innerHTML = i + 1;
      });
    }).draw();
  }, error => {
    console.error("❌ Gagal ambil data realtime dari Firebase:", error);
  });
}



  // Load data dari Firebase saat halaman siap
  loadFirebaseData();

  // Optional: auto-refresh data setiap 30 detik
  // setInterval(loadFirebaseData, 30000);
});