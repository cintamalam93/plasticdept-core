import { db, authPromise } from "./config.js";
import { ref, set, get, update } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

const FIELD_MAP = {
  "Product Code": ["Product Code 1", "Product Code1", "Product Code"],
  "Location": ["Location", "Lokasi"],
  "Inbound Date": ["Inbound Date", "Inbound Da", "InboundDate"],
  "BU": ["BU"],
  "Invoice No": ["Invoice No", "Invoice No.", "InvoiceNo"],
  "LOT No": ["LOT No", "LOT No.", "LOTNo"],
  "Status": ["Status"],
  "Qty": ["Qty"],
  "PID": ["PID"],
};

const BATCH_SIZE = 100;
const STATUS_ALLOW = ["Putaway", "Allocated"];
const STATUS_COLOR = {
  Putaway: "#4caf50",
  Allocated: "#ff9800"
};
const ROWS_PER_PAGE = 50;

let currentPage = 1;
let lastRenderedRows = [];
let totalPages = 1;

// --- Utility Functions ---
function sanitizeKey(str) {
  return String(str)
    .replace(/[.#$/\[\]]/g, "_")
    .replace(/\s+/g, "_");
}

function formatDateDMY(dateStr) {
  if (!dateStr) return "";
  let d = new Date(dateStr);
  if (isNaN(d)) {
    const parts = String(dateStr).split(/[\/\-]/);
    if (parts.length === 3 && parts[2].length === 4) {
      let yyyy, mm, dd;
      if (+parts[0] > 12) {
        dd = parts[0]; mm = parts[1]; yyyy = parts[2];
      } else {
        mm = parts[0]; dd = parts[1]; yyyy = parts[2];
      }
      d = new Date(`${yyyy}-${mm}-${dd}`);
    }
  }
  if (isNaN(d)) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = d.toLocaleString('en-US', { month: 'short' });
  const yyyy = d.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
}

function parseDate(str) {
  if (!str) return new Date(0);
  let m = str.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dd = +m[1], mm = months.indexOf(m[2]);
    return new Date(m[3], mm, dd);
  }
  let d = new Date(str);
  if (!isNaN(d)) return d;
  return new Date(0);
}

// --- File Parse ---
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
        obj[field] = idx !== -1 && row[idx] !== undefined ? String(row[idx]).trim() : "";
        if (obj[field]) valid = true;
      }
      if (valid) result.push(obj);
    }
    callback(result);
  };
  reader.readAsArrayBuffer(file);
}

// --- Pivot data for rendering & upload ---
function pivotData(dataArr) {
  const result = {};
  dataArr.forEach(row => {
    const status = (row["Status"] || "").trim();
    if (!STATUS_ALLOW.includes(status)) return;
    const productCode = row["Product Code"] || "";
    const location = row["Location"] || "";
    if (!productCode || !location) return;
    const key = `${productCode}|${location}`;
    if (!result[key]) {
      result[key] = {
        "Product Code": productCode,
        "Location": location,
        "Inbound Date": formatDateDMY(row["Inbound Date"]),
        "BU": row["BU"] || "",
        "Invoice No": row["Invoice No"] || "",
        "LOT No": row["LOT No"] || "",
        "Status": status,
        "Qty": 0,
        "PIDSet": new Set(),
        "_raw_inbound": row["Inbound Date"]
      };
    }
    let qtyRaw = row["Qty"];
    let qty = 0;
    if (qtyRaw !== undefined && qtyRaw !== null && qtyRaw !== "") {
      qty = parseFloat(String(qtyRaw).replace(/,/g, "")) || 0;
    }
    result[key]["Qty"] += qty;
    if (row["PID"]) result[key]["PIDSet"].add(row["PID"]);
  });
  // Convert to array & sort by date ascending
  let arr = Object.values(result);
  arr.forEach(item => item["PID"] = item["PIDSet"].size);
  arr.sort((a, b) => parseDate(a["_raw_inbound"]) - parseDate(b["_raw_inbound"]));
  return arr;
}

// --- Pagination & Table Render ---
function renderTableRows(arr, page = 1) {
  lastRenderedRows = arr;
  currentPage = page;
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  totalPages = Math.ceil(arr.length / ROWS_PER_PAGE);

  let start = (page - 1) * ROWS_PER_PAGE;
  let end = Math.min(start + ROWS_PER_PAGE, arr.length);

  for (let i = start; i < end; i++) {
    const item = arr[i];
    const status = item["Status"];
    let style = "";
    if (status === "Putaway") style = `background:#eafbe8;color:#388e3c;padding:3px 12px;border-radius:6px;font-weight:600;display:inline-block;`;
    else if (status === "Allocated") style = `background:#fff3e0;color:#ef6c00;padding:3px 12px;border-radius:6px;font-weight:600;display:inline-block;`;
    else style = "";
    tbody.innerHTML += `
      <tr>
        <td>${item["Location"]}</td>
        <td>${item["Product Code"]}</td>
        <td>${item["Inbound Date"]}</td>
        <td>${item["BU"]}</td>
        <td>${item["Invoice No"]}</td>
        <td>${item["LOT No"]}</td>
        <td><span style="${style}">${status}</span></td>
        <td>${item["Qty"]}</td>
        <td>${item["PID"]}</td>
      </tr>
    `;
  }
  renderPagination();
}

function renderPagination() {
  let pagDiv = document.getElementById("pagination");
  if (!pagDiv) {
    pagDiv = document.createElement("div");
    pagDiv.id = "pagination";
    pagDiv.style.textAlign = "right";
    pagDiv.style.margin = "10px 0";
    document.querySelector(".table-wrapper").after(pagDiv);
  }
  let html = "";
  if (totalPages > 1) {
    html += `<button ${currentPage === 1 ? "disabled" : ""} onclick="gotoPage(${currentPage-1})">Prev</button>`;
    html += ` Page <b>${currentPage}</b> of <b>${totalPages}</b> `;
    html += `<button ${currentPage === totalPages ? "disabled" : ""} onclick="gotoPage(${currentPage+1})">Next</button>`;
  }
  pagDiv.innerHTML = html;
}
window.gotoPage = function(page) {
  renderTableRows(lastRenderedRows, page);
  applyFilters(false);
};

// --- Filter (pagination aware) ---
const filterInputs = document.querySelectorAll(".column-filter");
filterInputs.forEach((input) => {
  input.addEventListener("input", () => applyFilters(true));
});
function applyFilters(shouldPaginate = true) {
  const filters = Array.from(filterInputs).map((f) =>
    f.value.toLowerCase()
  );
  let arr = lastRenderedRows.filter(item => {
    const vals = [
      item["Location"], item["Product Code"], item["Inbound Date"], item["BU"], item["Invoice No"],
      item["LOT No"], item["Status"], item["Qty"], item["PID"]
    ].map(String);
    for (let i = 0; i < filters.length; i++) {
      if (filters[i] && !vals[i].toLowerCase().includes(filters[i])) return false;
    }
    return true;
  });
  // Sort by date ascending
  arr.sort((a, b) => parseDate(a["Inbound Date"]) - parseDate(b["Inbound Date"]));
  if (shouldPaginate) renderTableRows(arr, 1);
}

// --- Loader/Progress ---
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
  document.getElementById('upload-bar').style.width = percent + '%';
}
function setLoaderBar(percent = 0) {
  let loaderBar = document.querySelector('#loader-overlay #upload-bar');
  if (loaderBar) loaderBar.style.width = percent + '%';
}

// --- Fetch from DB & render ---
async function fetchAndRenderSummary() {
  await authPromise;
  const snapshot = await get(ref(db, "/stock-material"));
  const dataObj = snapshot.exists() ? snapshot.val() : {};
  // Flatten for render (array of item)
  const arr = [];
  Object.keys(dataObj).forEach(prodCode => {
    const locations = dataObj[prodCode];
    Object.keys(locations).forEach(location => {
      const item = locations[location];
      arr.push({
        ...item,
        "Product Code": prodCode,
        "Location": location,
        "PID": typeof item.PID === "number" ? item.PID : 0
      });
    });
  });
  let pivoted = arr.filter(i=>STATUS_ALLOW.includes(i.Status)).map(i=>{
    i._raw_inbound = i["Inbound Date"];
    return i;
  });
  pivoted.sort((a, b) => parseDate(a["Inbound Date"]) - parseDate(b["Inbound Date"]));
  renderTableRows(pivoted, 1);
}

// --- UPLOAD with robust batching & retry ---
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

  await authPromise;

  // GROUP, PIVOT, FILTER STATUS
  const result = {};
  parsedResult.forEach(row => {
    const status = (row["Status"] || "").trim();
    if (!STATUS_ALLOW.includes(status)) return;
    const productCode = row["Product Code"] || "";
    const location = row["Location"] || "";
    if (!productCode || !location) return;
    const safeProdCode = sanitizeKey(productCode);
    const safeLocation = sanitizeKey(location);
    const key = `${safeProdCode}|${safeLocation}`;
    if (!result[key]) {
      result[key] = {
        "Product Code": productCode,
        "Location": location,
        "Inbound Date": formatDateDMY(row["Inbound Date"]),
        "BU": row["BU"] || "",
        "Invoice No": row["Invoice No"] || "",
        "LOT No": row["LOT No"] || "",
        "Status": status,
        "Qty": 0,
        "PIDSet": new Set(),
        "_raw_inbound": row["Inbound Date"]
      };
    }
    let qtyRaw = row["Qty"];
    let qty = 0;
    if (qtyRaw !== undefined && qtyRaw !== null && qtyRaw !== "") {
      qty = parseFloat(String(qtyRaw).replace(/,/g, "")) || 0;
    }
    result[key]["Qty"] += qty;
    if (row["PID"]) result[key]["PIDSet"].add(row["PID"]);
  });
  Object.values(result).forEach(item => {
    item.PID = item.PIDSet.size;
    delete item.PIDSet;
  });
  let allPairs = Object.values(result);

  // Clear old data before upload (replace all)
  await set(ref(db, "/stock-material"), {});

  let total = allPairs.length;
  let success = 0, fail = 0;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    let batchArr = allPairs.slice(i, i + BATCH_SIZE);
    let updates = {};
    batchArr.forEach(item => {
      const safeProdCode = sanitizeKey(item["Product Code"]);
      const safeLocation = sanitizeKey(item["Location"]);
      updates[`/stock-material/${safeProdCode}/${safeLocation}`] = item;
    });
    let tryCount = 0;
    let uploaded = false;
    while (!uploaded && tryCount < 3) {
      try {
        await update(ref(db), updates);
        uploaded = true;
        success += batchArr.length;
      } catch (err) {
        tryCount++;
        if (tryCount >= 3) {
          fail += batchArr.length;
          alert("Upload error (batch " + (i / BATCH_SIZE + 1) + "): " + err.message);
        } else {
          await new Promise(res => setTimeout(res, 1000 * tryCount));
        }
      }
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