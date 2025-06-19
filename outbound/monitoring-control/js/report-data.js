import { db, authPromise } from './config.js';
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Helper: Format angka ribuan
function formatNumber(num) {
    if (typeof num === "number" && !isNaN(num)) {
        return num.toLocaleString('en-US');
    }
    return num;
}

// Helper: dapatkan tanggal esok dalam format "DD-MMM-YYYY"
function getTomorrowDateStr() {
    const besok = new Date();
    besok.setDate(besok.getDate() + 1);
    const day = String(besok.getDate()).padStart(2, "0");
    const month = besok.toLocaleString("en-US", { month: "short" });
    const year = besok.getFullYear();
    return `${day}-${month}-${year}`;
}

function calculateOrderH1Actual(jobs, shiftMode) {
    let total = 0;
    if (!jobs) return total;

    const tomorrowDateStr = getTomorrowDateStr();

    if (shiftMode === "day") {
        // Logika existing: besok & status newjob
        Object.values(jobs).forEach(job => {
            const deliveryDate = job.deliveryDate || "";
            const status = (job.status || "").toLowerCase();
            const qty = parseInt(job.qty, 10) || 0;
            if (deliveryDate === tomorrowDateStr && status === "newjob") {
                total += qty;
            }
        });
    } else if (shiftMode === "night") {
        // Cek apakah ada job dengan tanggal besok & status newjob
        let foundNextDate = false;
        Object.values(jobs).forEach(job => {
            const deliveryDate = job.deliveryDate || "";
            const status = (job.status || "").toLowerCase();
            if (deliveryDate === tomorrowDateStr && status === "newjob") {
                foundNextDate = true;
            }
        });

        Object.values(jobs).forEach(job => {
            const deliveryDate = job.deliveryDate || "";
            const status = (job.status || "").toLowerCase();
            const qty = parseInt(job.qty, 10) || 0;
            if (foundNextDate) {
                if (deliveryDate === tomorrowDateStr && status === "newjob") {
                    total += qty;
                }
            } else {
                if (status === "newjob") {
                    total += qty;
                }
            }
        });
    }
    return total;
}

// Ambil data Mp shift (dari node ManPower)
async function fetchMpShift(shiftLabel) {
    const mpSnap = await get(ref(db, `ManPower/${shiftLabel}`));
    let mpReguler = 0, mpSugity = 0;
    if (mpSnap.exists()) {
        const val = mpSnap.val();
        mpReguler = Number(val.Reguler || 0);
        mpSugity = Number(val.Sugity || 0);
    }
    return mpReguler + mpSugity;
}

// Render shift data ke tabel (toggle show/hide)
function renderShiftData(showDay, mpDayShift, capDayShift, mpNightShift, capNightShift) {
    // Mp day shift & Capacity day shift
    const mpDayCell = document.getElementById('mpDayShift-actual');
    const capDayCell = document.getElementById('capDayShift-actual');
    mpDayCell.textContent = showDay && mpDayShift != null ? formatNumber(mpDayShift) : '';
    capDayCell.textContent = showDay && capDayShift != null ? formatNumber(capDayShift) : '';
    // Mp night shift & Capacity night shift
    const mpNightCell = document.getElementById('mpNightShift-actual');
    const capNightCell = document.getElementById('capNightShift-actual');
    mpNightCell.textContent = !showDay && mpNightShift != null ? formatNumber(mpNightShift) : '';
    capNightCell.textContent = !showDay && capNightShift != null ? formatNumber(capNightShift) : '';
}

authPromise.then(async () => {
    // Ambil referensi elemen toggle dan spinner
    const dayToggle = document.getElementById('day-shift');
    const nightToggle = document.getElementById('night-shift');
    const spinner = document.getElementById('spinner');

    // Disable toggle & tampilkan spinner saat loading
    if (dayToggle) dayToggle.disabled = true;
    if (nightToggle) nightToggle.disabled = true;
    if (spinner) spinner.style.display = '';

    // Fetch data MP shift
    const mpDayShift = await fetchMpShift('Day Shift');
    const mpNightShift = await fetchMpShift('Night Shift');

    // Listener untuk jobs (PhxOutboundJobs)
    const jobsRef = ref(db, 'PhxOutboundJobs');
    onValue(jobsRef, (snapshot) => {
        const jobs = snapshot.val();
        let totalRemaining = 0;
        let totalAdditional = 0;
        let totalOrderH1 = 0;
        let capDayShift = 0;
        let capNightShift = 0;

        const tomorrowDateStr = getTomorrowDateStr();

        if (jobs) {
            Object.values(jobs).forEach(job => {
                const jobType = job.jobType || "";
                const qty = parseInt(job.qty, 10) || 0;
                const deliveryDate = job.deliveryDate || "";
                const status = (job.status || "").toLowerCase();
                const shift = job.shift || "";
                const team = job.team || "";

                // HANYA INI untuk Order H-1
                if (deliveryDate === tomorrowDateStr && status === "newjob") {
                    totalOrderH1 += qty;
                }

                // 1. Remaining order day H
                if (jobType === "Remaining") {
                    totalRemaining += qty;
                }
                // 2. Additional Day H
                if (jobType === "Additional") {
                    totalAdditional += qty;
                }
                // Capacity day shift (filter shift & team)
                if (
                    shift === "Day Shift" &&
                    (team === "Reguler" || team === "Sugity")
                ) {
                    capDayShift += qty;
                }
                // Capacity night shift (filter shift & team)
                if (
                    shift === "Night Shift" &&
                    (team === "Reguler" || team === "Sugity")
                ) {
                    capNightShift += qty;
                }
            });
        }

        // 4. Total Order = Remaining + Additional + Order H-1
        const totalOrder = totalRemaining + totalAdditional + totalOrderH1;
        // 1. Total MP = Mp day shift + Mp night shift
        const totalMP = (mpDayShift || 0) + (mpNightShift || 0);

        // 2. Total Capacity = Capacity day shift + Capacity night shift
        const totalCap = (capDayShift || 0) + (capNightShift || 0);

        // 3. Remaining order = Total Order - Total Capacity
        const remainingOrder = (totalOrder || 0) - (totalCap || 0);

        // 4. Cap 1 MP per hour
        let cap1MPHour = 0;
        if ((mpDayShift + mpNightShift) > 0) {
            cap1MPHour = (capDayShift + capNightShift) / (mpDayShift + mpNightShift) / (450 / 60);
        }

        // Tampilkan ke tabel
        const remOrderDayHCell = document.getElementById('remOrderDayH-actual');
        if (remOrderDayHCell) remOrderDayHCell.textContent = totalRemaining > 0 ? formatNumber(totalRemaining) : "-";

        const addDayHCell = document.getElementById('addDayH-actual');
        if (addDayHCell) addDayHCell.textContent = totalAdditional > 0 ? formatNumber(totalAdditional) : "-";

        const orderH1Cell = document.getElementById('orderH1-actual');
        if (orderH1Cell) orderH1Cell.textContent = totalOrderH1 > 0 ? totalOrderH1.toLocaleString("en-US") : "-";

        const totalOrderCell = document.getElementById('totalOrder-actual');
        if (totalOrderCell) totalOrderCell.textContent = totalOrder > 0 ? formatNumber(totalOrder) : "-";

        const totalMPCell = document.getElementById('totalMP-actual');
        if (totalMPCell) totalMPCell.textContent = totalMP > 0 ? formatNumber(totalMP) : "-";

        const totalCapCell = document.getElementById('totalCap-actual');
        if (totalCapCell) totalCapCell.textContent = totalCap > 0 ? formatNumber(totalCap) : "-";

        const remainingOrderCell = document.getElementById('remOrder-actual');
        if (remainingOrderCell) remainingOrderCell.textContent = !isNaN(remainingOrder) ? formatNumber(remainingOrder) : "-";

        // Tampilkan cap1MPHour ke tabel
        const cap1MPHourCell = document.getElementById('cap1MPHour-actual');
        if (cap1MPHourCell) {
            cap1MPHourCell.textContent = cap1MPHour > 0 ? formatNumber(Math.round(cap1MPHour)) : "-";
        }

        // DATA SUDAH SIAP: enable toggle & hide spinner
        if (dayToggle) dayToggle.disabled = false;
        if (nightToggle) nightToggle.disabled = false;
        if (spinner) spinner.style.display = 'none';

        // Fungsi update tampilan shift (hanya MP & Capacity yang dinamis)
        function updateShiftView() {
            const shiftMode = (dayToggle && dayToggle.checked) ? "day" : "night";

            // Update orderH1-actual sesuai shift (jika ingin orderH1 dinamis)
            const orderH1Val = calculateOrderH1Actual(jobs, shiftMode);
            const orderH1Cell = document.getElementById('orderH1-actual');
            if (orderH1Cell) orderH1Cell.textContent = orderH1Val > 0 ? orderH1Val.toLocaleString("en-US") : "-";

            renderShiftData(
                shiftMode === "day",
                mpDayShift,
                capDayShift,
                mpNightShift,
                capNightShift
            );
        }

        // Inisialisasi awal (default tampil day shift)
        updateShiftView();

        // Event listener toggle supaya shift responsif
        if (dayToggle) dayToggle.addEventListener('change', updateShiftView);
        if (nightToggle) nightToggle.addEventListener('change', updateShiftView);
    });
});