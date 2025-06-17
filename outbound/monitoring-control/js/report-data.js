import { db, authPromise } from './config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Helper: Format angka ribuan
function formatNumber(num) {
    if (typeof num === "number" && !isNaN(num)) {
        return num.toLocaleString('en-US');
    }
    return num;
}

// Helper: dapatkan tanggal esok dalam format "DD-MMM-YYYY" (harus sesuai dengan format di database)
function getTomorrowDateStr() {
    const besok = new Date();
    besok.setDate(besok.getDate() + 1);
    const day = String(besok.getDate()).padStart(2, "0");
    const month = besok.toLocaleString("en-US", { month: "short" });
    const year = besok.getFullYear();
    return `${day}-${month}-${year}`;
}

authPromise.then(() => {
    const jobsRef = ref(db, 'PhxOutboundJobs');
    onValue(jobsRef, (snapshot) => {
        const jobs = snapshot.val();
        let totalRemaining = 0;
        let totalAdditional = 0;
        let totalOrderH1 = 0;

        const tomorrowDateStr = getTomorrowDateStr();

        if (jobs) {
            Object.values(jobs).forEach(job => {
                // Pastikan ada field yang dibutuhkan
                const jobType = job.jobType || "";
                const qty = parseInt(job.qty, 10) || 0;
                const deliveryDate = job.deliveryDate || "";

                // 1. Remaining order day H
                if (jobType === "Remaining") {
                    totalRemaining += qty;
                }
                // 2. Additional Day H
                if (jobType === "Additional") {
                    totalAdditional += qty;
                }
                // 3. Order H-1 (besok)
                if (deliveryDate === tomorrowDateStr) {
                    totalOrderH1 += qty;
                }
            });
        }

        // 4. Total Order = Remaining + Additional + Order H-1
        const totalOrder = totalRemaining + totalAdditional + totalOrderH1;

        // Tampilkan ke tabel
        const remOrderDayHCell = document.getElementById('remOrderDayH-actual');
        if (remOrderDayHCell) remOrderDayHCell.textContent = totalRemaining > 0 ? formatNumber(totalRemaining) : "-";

        const addDayHCell = document.getElementById('addDayH-actual');
        if (addDayHCell) addDayHCell.textContent = totalAdditional > 0 ? formatNumber(totalAdditional) : "-";

        const orderH1Cell = document.getElementById('orderH1-actual');
        if (orderH1Cell) orderH1Cell.textContent = totalOrderH1 > 0 ? formatNumber(totalOrderH1) : "-";

        const totalOrderCell = document.getElementById('totalOrder-actual');
        if (totalOrderCell) totalOrderCell.textContent = totalOrder > 0 ? formatNumber(totalOrder) : "-";
    });
});