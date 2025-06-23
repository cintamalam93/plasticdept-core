import { db, authPromise } from "./config.js";
import { ref, set, get, child } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// FIELD MAP: mapping nama header di file ke field yang dipakai
const FIELD_MAP = {
  "Product Code": ["Product Code", "Product Code", "ProductCode"],
  "Location": ["Location", "Location", "Lokasi"],
  "Inbound Date": ["Inbound Date", "Inbound Da", "InboundDate", "Inbound Date"],
  "BU": ["BU", "BU"],
  "Invoice No": ["Invoice No", "Invoice No.", "InvoiceNo"],
  "LOT No": ["LOT No", "LOT No.", "LOTNo"],
  "Status": ["Status", "Status"],
  "Qty": ["Qty", "Qty"],
  "PID": ["PID", "PID"],
};

// Kolom pivot dan urutan render
const TABLE_COLUMNS = [
  "Location",
  "Product Code",
  "Inbound Date",
  "BU",
  "Invoice No",
  "LOT No",
  "Status",
  "Qty",
  "PID"
];

// --- UTILS: Cari index kolom dari header file
function getHeaderIndexes(headerRow) {
  const map = {};
  for (const field in FIELD_MAP) {
    let idx = -1;
    for (const alias of FIELD_MAP[field]) {
      idx = headerRow.findIndex(
        h =>
          h &&
          h.trim().replace(/[\.]/g, "").toLowerCase() ===
            alias.replace(/[\.]/g, "").toLowerCase()
      );
      if (idx !== -1) break;
    }
    map[field] = idx;
  }
  return map;
}

// --- PARSE EXCEL/CSV: return array of object sesuai FIELD_MAP
function parseFileToObjects(file, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    // Hanya sheet pertama
    const wsname = workbook.SheetNames[0];
    const ws = workbook.Sheets[wsname];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

    if (!rows.length) return callback([]);
    // header row: cari mapping kolom
    const headerRow = rows[0].map(h =>
      String(h || "").replace(/\r?\n|\r/g, "").trim()
    );
    const headerMap = getHeaderIndexes(headerRow);

    // Ambil data dan mapping kolom
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const obj = {};
      let valid = false;
      for (const field in FIELD_MAP) {
        const idx = headerMap[field];
        obj[field] = idx !== -1 && row[idx] !== undefined ? row[idx].toString().trim() : "";
        if (obj[field]) valid = true;
      }
      if (valid) result.push(obj);
    }
    callback(result);
  };
  reader.readAsArrayBuffer(file);
}

// --- PIVOT DAN RENDER
function pivotAndRender(dataArr) {
  // Pivot per lokasi
  const pivot = {};
  dataArr.forEach((row) => {
    const location = row["Location"];
    if (!location) return;
    if (!pivot[location]) pivot[location] = {};

    // Key unik kombinasi (kecuali Qty, PID, Location)
    const key = [
      row["Product Code"],
      row["Inbound Date"],
      row["BU"],
      row["Invoice No"],
      row["LOT No"],
      row["Status"],
    ].join("|");

    if (!pivot[location][key]) {
      pivot[location][key] = {
        "Product Code": row["Product Code"] || "",
        "Inbound Date": row["Inbound Date"] || "",
        "BU": row["BU"] || "",
        "Invoice No": row["Invoice No"] || "",
        "LOT No": row["LOT No"] || "",
        "Status": row["Status"] || "",
        "Qty": 0,
        "PIDSet": new Set(),
      };
    }
    // Sum Qty
    let qty = parseFloat((row["Qty"] || "0").replace(/,/g, "")) || 0;
    pivot[location][key]["Qty"] += qty;
    // Unique PID
    if (row["PID"]) pivot[location][key]["PIDSet"].add(row["PID"]);
  });

  // Render ke tabel
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  Object.keys(pivot).forEach((location) => {
    Object.values(pivot[location]).forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${location}</td>
        <td>${item["Product Code"]}</td>
        <td>${item["Inbound Date"]}</td>
        <td>${item["BU"]}</td>
        <td>${item["Invoice No"]}</td>
        <td>${item["LOT No"]}</td>
        <td>${item["Status"]}</td>
        <td>${item["Qty"]}</td>
        <td>${item["PIDSet"].size}</td>
      `;
      tbody.appendChild(tr);
    });
  });
  applyFilters();
}

// --- FILTER PER KOLOM ---
const filterInputs = document.querySelectorAll(".column-filter");
filterInputs.forEach((input) => {
  input.addEventListener("input", applyFilters);
});
function applyFilters() {
  const filters = Array.from(filterInputs).map((f) =>
    f.value.toLowerCase()
  );
  const rows = document.querySelectorAll("#table-body tr");
  rows.forEach((row) => {
    const cells = Array.from(row.children);
    let show = true;
    for (let i = 0; i < filters.length; i++) {
      if (
        filters[i] &&
        !String(cells[i].textContent).toLowerCase().includes(filters[i])
      ) {
        show = false;
        break;
      }
    }
    row.style.display = show ? "" : "none";
  });
}

// --- FETCH DARI DATABASE DAN RENDER ---
async function fetchAndRenderSummary() {
  await authPromise;
  const snapshot = await get(ref(db, "/stock-material"));
  const dataArr = snapshot.exists() ? Object.values(snapshot.val()).filter(Boolean) : [];
  pivotAndRender(dataArr);
}

// --- UPLOAD HANDLER ---
document.getElementById("file-upload").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  if (["xls", "xlsx", "csv"].includes(ext)) {
    parseFileToObjects(file, (result) => {
      if (!result.length) return alert("Data kosong atau format tidak sesuai.");
      // Simpan ke database
      set(ref(db, "/stock-material"), result)
        .then(() => {
          alert("Upload sukses, data diupdate!");
          fetchAndRenderSummary();
        })
        .catch((err) => alert("Upload gagal: " + err.message));
    });
  } else {
    alert("Hanya mendukung file Excel (.xls, .xlsx) atau CSV.");
  }
});

// --- INIT: Ambil data saat halaman load ---
fetchAndRenderSummary();