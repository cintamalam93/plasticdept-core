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

const BATCH_SIZE = 100; // Kecil agar pasti masuk limit Firebase, batch besar bisa gagal diam-diam

const STATUS_ALLOW = ["Putaway", "Allocated"];
const STATUS_COLOR = {
  Putaway: "#4caf50",
  Allocated: "#ff9800"
};

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

// --- PIVOT & GROUP: Product Code + Location + filter status allowed
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
        "_raw_inbound": row["Inbound Date"] // for sorting
      };
    }
    // Qty
    let qtyRaw = row["Qty"];
    let qty = 0;
    if (qtyRaw !== undefined && qtyRaw !== null && qtyRaw !== "") {
      qty = parseFloat(String(qtyRaw).replace(/,/g, "")) || 0;
    }
    result[key]["Qty"] += qty;
    // PID count (unique)
    if (row["PID"]) result[key]["PIDSet"].add(row["PID"]);
  });
  // Convert to object per Product Code (nested)
  const nested = {};
  Object.values(result).forEach(item => {
    const prod = item["Product Code"];
    if (!nested[prod]) nested[prod] = [];
    nested[prod].push(item);
  });
  return nested;
}

// --- RENDER TABEL (pivoted, sorted by Inbound Date ascending)
function pivotAndRender(dataArr) {
  const nested = pivotData(dataArr);
  let rowsAll = [];
  Object.values(nested).forEach(arr => rowsAll = rowsAll.concat(arr));
  // Sort by Inbound Date ascending (tua ke muda)
  rowsAll.sort((a, b) => {
    let da = parseDate(a["_raw_inbound"]);
    let db = parseDate(b["_raw_inbound"]);
    return da - db;
  });
  renderTableRows(rowsAll);
}

function renderTableRows(rowsAll) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  rowsAll.forEach(item => {
    const status = item["Status"];
    let statusLabel = status;
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
        <td><span style="${style}">${statusLabel}</span></td>
        <td>${item["Qty"]}</td>
        <td>${item["PIDSet"] ? item["PIDSet"].size : (typeof item["PID"] === "number" ? item["PID"] : 0)}</td>
      </tr>
    `;
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
  let rows = Array.from(document.querySelectorAll("#table-body tr"));
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
  // Setelah filter, sort ulang by tanggal
  sortTableByDate();
}

function parseDate(str) {
  if (!str) return new Date(0);
  // Try parse DD-MMM-YYYY
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

function sortTableByDate() {
  const tbody = document.getElementById("table-body");
  let rows = Array.from(tbody.querySelectorAll("tr"));
  rows.sort((a, b) => {
    let adate = a.children[2].textContent;
    let bdate = b.children[2].textContent;
    return parseDate(adate) - parseDate(bdate);
  });
  tbody.innerHTML = "";
  rows.forEach(tr => tbody.appendChild(tr));
}

// --- FETCH DARI DATABASE & RENDER ---
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
        "PIDSet": { size: typeof item.PID === "number" ? item.PID : 0 }
      });
    });
  });
  pivotAndRender(arr);
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
  document.getElementById('upload-bar').style.width = percent + '%';
}
function setLoaderBar(percent = 0) {
  let loaderBar = document.querySelector('#loader-overlay #upload-bar');
  if (loaderBar) loaderBar.style.width = percent + '%';
}

// --- UPLOAD BATCH ROBUST DENGAN RETRY ---
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
  const nested = {};
  parsedResult.forEach(row => {
    const status = (row["Status"] || "").trim();
    if (!STATUS_ALLOW.includes(status)) return;
    const productCode = row["Product Code"] || "";
    const location = row["Location"] || "";
    if (!productCode || !location) return;
    const safeProdCode = sanitizeKey(productCode);
    const safeLocation = sanitizeKey(location);
    if (!nested[safeProdCode]) nested[safeProdCode] = {};
    if (!nested[safeProdCode][safeLocation]) {
      nested[safeProdCode][safeLocation] = {
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
    nested[safeProdCode][safeLocation]["Qty"] += qty;
    if (row["PID"]) nested[safeProdCode][safeLocation]["PIDSet"].add(row["PID"]);
  });
  // Convert Set to count, and remove PIDSet (replace with count)
  Object.keys(nested).forEach(prodCode => {
    Object.keys(nested[prodCode]).forEach(location => {
      const item = nested[prodCode][location];
      item.PID = item.PIDSet.size;
      delete item.PIDSet;
    });
  });

  // Prepare all pairs for batch upload
  const allPairs = [];
  Object.keys(nested).forEach(prodCode => {
    Object.keys(nested[prodCode]).forEach(location => {
      allPairs.push({
        prodCode,
        location,
        data: nested[prodCode][location]
      });
    });
  });

  // Clear old data before upload (replace all)
  await set(ref(db, "/stock-material"), {});

  let total = allPairs.length;
  let success = 0, fail = 0;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    let batchPairs = allPairs.slice(i, i + BATCH_SIZE);
    let updates = {};
    batchPairs.forEach(({ prodCode, location, data }) => {
      updates[`/stock-material/${prodCode}/${location}`] = data;
    });
    let tryCount = 0;
    let uploaded = false;
    while (!uploaded && tryCount < 3) {
      try {
        await update(ref(db), updates);
        uploaded = true;
        success += batchPairs.length;
      } catch (err) {
        tryCount++;
        if (tryCount >= 3) {
          fail += batchPairs.length;
          alert("Upload error (batch " + (i / BATCH_SIZE + 1) + "): " + err.message);
        } else {
          await new Promise(res => setTimeout(res, 1000 * tryCount)); // exponential backoff
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