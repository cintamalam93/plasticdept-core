import { db, authPromise } from './config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Fungsi untuk format angka ribuan
function formatNumber(num) {
    if (typeof num === "number" && !isNaN(num)) {
        return num.toLocaleString('en-US');
    }
    return num;
}

// Setelah login anonymous
authPromise.then(() => {
    // Referensi ke node PhxOutboundJobs
    const jobsRef = ref(db, 'PhxOutboundJobs');

    onValue(jobsRef, (snapshot) => {
        const jobs = snapshot.val();
        let totalQty = 0;

        if (jobs) {
            // Loop seluruh job, filter jobType === "Remaining"
            Object.values(jobs).forEach(job => {
                if (job.jobType === "Remaining" && job.qty) {
                    // qty diasumsikan string, convert ke integer
                    totalQty += parseInt(job.qty, 10);
                }
            });
        }

        // Set hasilnya ke kolom Actual untuk Remaining order day H
        const actualCell = document.getElementById('remOrderDayH-actual');
        if (actualCell) {
            actualCell.textContent = totalQty > 0 ? formatNumber(totalQty) : "-";
        }
    });
});