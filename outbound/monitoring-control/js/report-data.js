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

    // Ambil hari ini dan kemarin dalam format yang sama dengan job.deliveryDate
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    function formatDate(date) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = date.toLocaleString("en-US", { month: "short" });
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);

    // Ambil semua job newjob yang tanggal != hari ini && tanggal != kemarin
    const filtered = Object.values(jobs).filter(job => {
        const deliveryDate = job.deliveryDate || "";
        const status = (job.status || "").toLowerCase();
        return (
            status === "newjob" &&
            deliveryDate !== todayStr &&
            deliveryDate !== yesterdayStr
        );
    });

    if (shiftMode === "day") {
        // Day shift: jumlahkan semua job newjob selain hari ini dan kemarin
        filtered.forEach(job => {
            total += parseInt(job.qty, 10) || 0;
        });
    } else if (shiftMode === "night") {
        if (filtered.length > 0) {
            // Jika ada: jumlahkan hanya yang tanggal selain hari ini dan kemarin
            filtered.forEach(job => {
                total += parseInt(job.qty, 10) || 0;
            });
        } else {
            // Jika tidak ada: jumlahkan semua job newjob tanpa filter tanggal
            Object.values(jobs).forEach(job => {
                const status = (job.status || "").toLowerCase();
                if (status === "newjob") {
                    total += parseInt(job.qty, 10) || 0;
                }
            });
        }
    }
    return total;
}

// Hitung total qty OT pada shift tertentu dari node PhxOutboundJobs
function calculateCapShiftOT(jobs, shiftLabel) {
    let total = 0;
    if (!jobs) return total;

    Object.values(jobs).forEach(job => {
        const jobType = (job.jobType || "").toUpperCase();
        const shift = (job.shift || "");
        const qty = parseInt(job.qty, 10) || 0;
        if (jobType === "OT" && shift === shiftLabel) {
            total += qty;
        }
    });
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

// Ambil ManPowerOvertime/Night Shift (cek apakah ada node)
async function fetchMpOvertimeQty(shiftLabel) {
    const mpOtSnap = await get(ref(db, `ManPowerOvertime/${shiftLabel}`));
    return mpOtSnap.exists();
}

// Ambil data MP Overtime shift (dari node ManPowerOvertime)
async function fetchMpOvertime(shiftLabel) {
    const mpOtSnap = await get(ref(db, `ManPowerOvertime/${shiftLabel}`));
    if (mpOtSnap.exists()) {
        return Number(mpOtSnap.val()) || 0;
    }
    return 0;
}

// Render shift data ke tabel (toggle show/hide)
function renderShiftData(showDay, mpDayShift, capDayShift, mpNightShift, capNightShift, cap1MPHour) {
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

    // GAP cell
    const mpDayGapCell = document.getElementById('mpDayShift-gap');
    const capDayGapCell = document.getElementById('capDayShift-gap');
    const mpNightGapCell = document.getElementById('mpNightShift-gap');
    const capNightGapCell = document.getElementById('capNightShift-gap');
    const cap1MPHourGapCell = document.getElementById('cap1MPHour-gap');

    // Standar value
    const STD_MP_DAY = 3;
    const STD_MP_NIGHT = 2;
    const STD_CAP_DAY = 52920;
    const STD_CAP_NIGHT = 35280;
    const STD_CAP_1MP_HOUR = 2352;

    // GAP Day
    mpDayGapCell.textContent = showDay && mpDayShift != null ? formatNumber(mpDayShift - STD_MP_DAY) : '';
    capDayGapCell.textContent = showDay && capDayShift != null ? formatNumber(capDayShift - STD_CAP_DAY) : '';

    // GAP Night
    mpNightGapCell.textContent = !showDay && mpNightShift != null ? formatNumber(mpNightShift - STD_MP_NIGHT) : '';
    capNightGapCell.textContent = !showDay && capNightShift != null ? formatNumber(capNightShift - STD_CAP_NIGHT) : '';

    // GAP Capacity 1 MP/hour (selalu tampil, tidak tergantung toggle)
    cap1MPHourGapCell.textContent = cap1MPHour > 0 ? formatNumber(Math.round(cap1MPHour - STD_CAP_1MP_HOUR)) : "-";
}

// Update tampilan nilai mpNightShift-ot atau mpDayShift-ot sesuai shift
async function updateMpOvertimeView(shiftMode) {
    // shiftMode: 'day' atau 'night'
    const shiftLabel = shiftMode === "day" ? "Day Shift" : "Night Shift";
    const mpOt = await fetchMpOvertime(shiftLabel);
    const otCell = document.getElementById('mpNightShift-ot'); // Pastikan id sesuai di HTML
    if (otCell) otCell.textContent = mpOt > 0 ? formatNumber(mpOt) : "-";
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

                // PATCH: Setiap job hanya masuk ke satu kategori saja (prioritas: Remaining > Additional > Order H-1)
                if (jobType === "Remaining") {
                    totalRemaining += qty;
                } else if (jobType === "Additional") {
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

        // PATCH: Gunakan logika konsisten untuk totalOrderH1 (Order H-1)
        const totalOrderH1 = calculateOrderH1Actual(jobs, "day");

        // 4. Total Order = Remaining + Additional + Order H-1
        const totalOrder = totalRemaining + totalAdditional + totalOrderH1;

        // Tambahkan log detail sumber nilai totalOrder-actual
        console.log(`[TRACE] totalRemaining: ${totalRemaining} (jobType: "Remaining")`);
        console.log(`[TRACE] totalAdditional: ${totalAdditional} (jobType: "Additional")`);
        console.log(`[TRACE] totalOrderH1: ${totalOrderH1} (Order H-1, dari calculateOrderH1Actual(jobs, "day"))`);
        console.log(`[TRACE] totalOrder-actual = totalRemaining + totalAdditional + totalOrderH1`);
        console.log(`[TRACE] totalOrder-actual = ${totalRemaining} + ${totalAdditional} + ${totalOrderH1} = ${totalOrder}`);

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
        if (totalOrderCell) {
            console.log(`[DISPLAY] totalOrder-actual yang akan ditampilkan ke tabel: ${totalOrder > 0 ? formatNumber(totalOrder) : "-"}`);
            totalOrderCell.textContent = totalOrder > 0 ? formatNumber(totalOrder) : "-";
        }

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
        async function updateShiftView() {
            const shiftMode = (dayToggle && dayToggle.checked) ? "day" : "night";
            const orderH1Val = calculateOrderH1Actual(jobs, shiftMode);
            const orderH1Cell = document.getElementById('orderH1-actual');
            if (orderH1Cell) orderH1Cell.textContent = orderH1Val > 0 ? orderH1Val.toLocaleString("en-US") : "-";

            // Sisa order
            const remainingOrderCell = document.getElementById('remOrder-actual');
            if (remainingOrderCell) {
                if (shiftMode === "night") {
                    remainingOrderCell.textContent = orderH1Val > 0 ? formatNumber(orderH1Val) : "-";
                } else {
                    const remainingOrder = (totalOrder || 0) - (totalCap || 0);
                    remainingOrderCell.textContent = !isNaN(remainingOrder) ? formatNumber(remainingOrder) : "-";
                }
            }

            // --- Perhitungan capNightShiftActual ---
            // capNightShift sudah didapat dari proses sebelumnya (global di listener onValue)
            // capNightShiftOt adalah jumlah qty jobType OT shift Night Shift
            const capNightShiftOt = calculateCapShiftOT(jobs, "Night Shift");
            // Cek apakah ada node ManPowerOvertime/Night Shift
            const hasManPowerOvertime = await fetchMpOvertimeQty("Night Shift");
            // Hitung capNightShiftActual
            let capNightShiftActual = capNightShift;
            if (hasManPowerOvertime) {
                capNightShiftActual = capNightShift - capNightShiftOt;
            }

            // --- Render data utama ke table ---
            renderShiftData(
                shiftMode === "day",
                mpDayShift,
                capDayShift,
                mpNightShift,
                capNightShiftActual,
                cap1MPHour
            );

            // --- Update tampilan nilai MP Overtime pada tabel ---
            await updateMpOvertimeView(shiftMode);

            // --- Update nilai capNightShift-ot dan capDayShift-ot pada tabel ---
            const capNightShiftOtCell = document.getElementById('capNightShift-ot');
            const capDayShiftOtCell = document.getElementById('capDayShift-ot');
            if (shiftMode === "night") {
                if (capNightShiftOtCell) capNightShiftOtCell.textContent = capNightShiftOt > 0 ? formatNumber(capNightShiftOt) : "-";
                if (capDayShiftOtCell) capDayShiftOtCell.textContent = "";
            } else {
                const capDayOT = calculateCapShiftOT(jobs, "Day Shift");
                if (capDayShiftOtCell) capDayShiftOtCell.textContent = capDayOT > 0 ? formatNumber(capDayOT) : "-";
                if (capNightShiftOtCell) capNightShiftOtCell.textContent = "";
            }

            // ===================== ACHIEVEMENT LOGIC =====================
            // Ambil nilai actual
            const mpDayShiftActual = Number((document.getElementById("mpDayShift-actual")?.textContent || "").replace(/,/g, "")) || 0;
            const capDayShiftActual = Number((document.getElementById("capDayShift-actual")?.textContent || "").replace(/,/g, "")) || 0;
            const cap1MPHourAchievement = Number((document.getElementById("cap1MPHour-achievement")?.textContent || "").replace(/,/g, "")) || 0;

            if (shiftMode === "day") {
                let mpDayAchv = (mpDayShiftActual !== 0) ? capDayShiftActual / mpDayShiftActual : 0;
                document.getElementById("mpDayShift-achievement").textContent =
                    (mpDayShiftActual > 0 && capDayShiftActual > 0)
                        ? Math.round(mpDayAchv).toLocaleString('en-US')
                        : "-";

                let capDayAchv = mpDayAchv - cap1MPHourAchievement;
                document.getElementById("capDayShift-achievement").textContent =
                    (mpDayShiftActual > 0 && capDayShiftActual > 0 && cap1MPHourAchievement > 0)
                        ? Math.round(capDayAchv).toLocaleString('en-US')
                        : "-";
            } else {
                document.getElementById("mpDayShift-achievement").textContent = "";
                document.getElementById("capDayShift-achievement").textContent = "";
            }
            // ============================================================

            // ===================== PERCENTAGE LOGIC =====================
            // Helper: Persentase, dibulatkan ke integer
            function percentRound(val) {
                return Math.round(val * 100);
            }

            // cap1MPHour-percentage harus dihitung dari cap1MPHour-achievement/mpDayShift-achievement (atau mpNightShift-achievement)
            let cap1MPHourPercentage = 0;
            if (shiftMode === "day") {
                // cap1MPHour-percentage = cap1MPHour-achievement / mpDayShift-achievement
                const mpDayShiftAchievement = Number((document.getElementById("mpDayShift-achievement")?.textContent || "").replace(/,/g, "")) || 0;
                if (mpDayShiftAchievement !== 0) {
                    cap1MPHourPercentage = cap1MPHourAchievement / mpDayShiftAchievement;
                }
            } else {
                // cap1MPHour-percentage = cap1MPHour-achievement / mpNightShift-achievement
                const mpNightShiftAchievement = Number((document.getElementById("mpNightShift-achievement")?.textContent || "").replace(/,/g, "")) || 0;
                if (mpNightShiftAchievement !== 0) {
                    cap1MPHourPercentage = cap1MPHourAchievement / mpNightShiftAchievement;
                }
            }

            // capDayShift-percentage
            let capDayShiftPercent = 1 - cap1MPHourPercentage;
            document.getElementById("capDayShift-percentage").textContent = percentRound(capDayShiftPercent) + "%";

            // capNightShift-percentage: clear jika tidak dipakai
            if (shiftMode === "day") {
                document.getElementById("capNightShift-percentage").textContent = "";
            } else {
                document.getElementById("capNightShift-percentage").textContent = "";
            }

            // totalCap-percentage
            const totalCapActual = Number((document.getElementById("totalCap-actual")?.textContent || "").replace(/,/g, "")) || 0;
            let totalCapPercent = (totalCapActual !== 0)
                ? 1 - (88200 / totalCapActual)
                : 0;
            document.getElementById("totalCap-percentage").textContent = percentRound(totalCapPercent) + "%";
            // ============================================================
        }

        // Inisialisasi awal (default tampil day shift)
        updateShiftView();

        // Event listener toggle supaya shift responsif
        if (dayToggle) dayToggle.addEventListener('change', () => updateShiftView());
        if (nightToggle) nightToggle.addEventListener('change', () => updateShiftView());
    });

});
