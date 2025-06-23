import { db, authPromise } from "./config.js";
import { ref, set, get, update } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// FIELD MAP: mapping nama header di file ke field yang dipakai
const FIELD_MAP = {
  "Product Code": ["Product Code", "ProductCode"],
  "Location": ["Location", "Lokasi"],
  "Inbound Date": ["Inbound Date", "Inbound Da", "InboundDate"],
  "BU": ["BU"],
  "Invoice No": ["Invoice No", "Invoice No.", "InvoiceNo"],
  "LOT No": ["LOT No", "LOT No.", "LOTNo"],
  "Status": ["Status"],
  "Qty": ["Qty"],
  "PID": ["PID"],
};

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

const BATCH_SIZE = 150;

// --- UTILS: Cari index kolom dari header file
function getHeaderIndexes(headerRow) {
  const map = {};
  for (const field in FIELD_MAP) {
    let idx = -1;
    for (const alias of FIELD_MAP[field]) {
      idx = headerRow.findIndex(
        h => h && h.trim().replace(/[\.]/g, "").toLowerCase() === alias.replace(/[\.]/g, "").toLowerCase()
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
    const wsname = workbook.SheetNames[0];
    const ws = workbook.Sheets[wsname];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    if (!rows.length) return callback([]);
    const headerRow = rows[0].map(h => String(h || "").replace(/\r?\n|\r/g, "").trim());
    const headerMap = getHeaderIndexes(headerRow);
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
  const pivot = {};
  dataArr.forEach((row) => {
    const location = row["Location"];
    if (!location) return;
    if (!pivot[location]) pivot[location] = {};

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
    let qty = parseFloat((row["Qty"] || "0").replace(/,/g, "")) || 0;
    pivot[location][key]["Qty"] += qty;
    if (row["PID"]) pivot[location][key]["PIDSet"].add(row["PID"]);
  });

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

// --- SPINNER UTILS ---
function showLoader(msg = "Uploading...", percent = 0) {
  document.getElementById("loader-text").textContent = msg;
  document.getElementById("loader-overlay").style.display = "flex";
  setLoaderBar(percent);
}
function hideLoader() {
  document.getElementById("loader-overlay").style.display = "none";
  setLoaderBar(0);
}
function setProgress(text, percent = 0) {
  document.getElementById("upload-progress").textContent = text;
  setBar(percent);
}
function setBar(percent = 0) {
  // Bar di bawah tombol
  document.getElementById('upload-bar').style.width = percent + '%';
}
function setLoaderBar(percent = 0) {
  // Bar di loader overlay
  let loaderBar = document.querySelector('#loader-overlay #upload-bar');
  if (loaderBar) loaderBar.style.width = percent + '%';
}

// --- UPLOAD BATCH HANDLER ---
let selectedFile = null;
let parsedResult = [];

document.getElementById("file-upload").addEventListener("change", function (e) {
  selectedFile = e.target.files[0];
  parsedResult = [];
  document.getElementById("upload-btn").disabled = true;
  setBar(0);
  if (!selectedFile) {
    setProgress("");
    return;
  }
  const ext = selectedFile.name.split(".").pop().toLowerCase();
  if (["xls", "xlsx", "csv"].includes(ext)) {
    setProgress("Parsing...");
    parseFileToObjects(selectedFile, (result) => {
      if (!result.length) {
        setProgress("Format tidak sesuai/empty file.");
        setBar(0);
        return;
      }
      parsedResult = result;
      setProgress(result.length + " data ready.", 0);
      setBar(0);
      document.getElementById("upload-btn").disabled = false;
    });
  } else {
    setProgress("File must be .xls, .xlsx, .csv");
    setBar(0);
  }
});

// --- UPLOAD BUTTON ---
document.getElementById("upload-btn").addEventListener("click", async function () {
  if (!parsedResult.length) {
    alert("No data to upload!");
    return;
  }
  if (!confirm("Upload " + parsedResult.length + " rows to database?")) return;
  this.disabled = true;
  document.getElementById("file-upload").disabled = true;
  setProgress("");
  setBar(0);
  showLoader("Uploading...", 0);

  // Clear old data before upload (jika ingin replace, hapus baris ini jika ingin append)
  await set(ref(db, "/stock-material"), {});

  let total = parsedResult.length;
  let success = 0, fail = 0;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    let batch = parsedResult.slice(i, i + BATCH_SIZE);
    let updates = {};
    batch.forEach((row, idx) => {
      const rowKey = `row_${Date.now()}_${i + idx}`;
      updates[`/stock-material/${rowKey}`] = row;
    });
    try {
      await update(ref(db), updates);
      success += batch.length;
    } catch (err) {
      fail += batch.length;
      alert("Upload error (batch " + (i / BATCH_SIZE + 1) + "): " + err.message);
    }
    let percent = Math.round(Math.min(i + BATCH_SIZE, total) / total * 100);
    setProgress(`Uploaded ${Math.min(i + BATCH_SIZE, total)} of ${total}`, percent);
    setBar(percent);
    showLoader(`Uploading... (${Math.min(i + BATCH_SIZE, total)}/${total})`, percent);
  }

  hideLoader();
  setBar(100);
  setProgress("Upload finished. Success: " + success + (fail ? ", Failed: " + fail : ""), 100);
  document.getElementById("upload-btn").disabled = true;
  document.getElementById("file-upload").disabled = false;
  fetchAndRenderSummary();
  parsedResult = [];
  selectedFile = null;
  document.getElementById("file-upload").value = "";
});

// --- INIT: Ambil data saat halaman load ---
fetchAndRenderSummary();