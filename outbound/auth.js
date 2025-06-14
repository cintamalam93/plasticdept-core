// Firebase config langsung di sini
const firebaseConfig = {
  apiKey: "AIzaSyAfIYig9-sv3RfazwAW6X937_5HJfgnYt4",
  authDomain: "outobund.firebaseapp.com",
  databaseURL: "https://outobund-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "outobund",
  storageBucket: "outobund.firebasestorage.app",
  messagingSenderId: "84643346476",
  appId: "1:84643346476:web:beb19c5ea0884fcb083989"
};

// Import Firebase SDK modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let isAuthenticated = false;
// Proses autentikasi anonymous Firebase
let authPromise = signInAnonymously(auth)
  .then(() => { isAuthenticated = true; })
  .catch((error) => {
    const errorMsg = document.getElementById("errorMsg");
    if (errorMsg) {
      errorMsg.textContent = "Gagal login anonymous: " + error.message;
      errorMsg.style.display = "block";
    }
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) loginBtn.disabled = true;
  });

// Ambil elemen DOM yang dibutuhkan
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const shiftInput = document.getElementById("shift");
const positionInput = document.getElementById("position");
const operatorFields = document.getElementById("operatorFields");
const teamInput = document.getElementById("teamInput"); // input team sekarang readonly
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginLoader = document.getElementById("loginLoader");
const errorMsg = document.getElementById("errorMsg");

/**
 * Ketika kolom User ID kehilangan fokus,
 * otomatis isi SHIFT, POSITION, dan TEAM (khusus operator ambil dari node MPPIC).
 */
usernameInput.addEventListener("blur", getUserDataAndFill);

async function getUserDataAndFill() {
  const username = usernameInput.value.trim();
  // Reset field
  shiftInput.value = "";
  positionInput.value = "";
  operatorFields.style.display = "none";
  teamInput.value = "";

  if (!username) return;

  await authPromise;
  // Ambil data user dari node users
  const userSnap = await get(ref(db, `users/${username}`));
  if (!userSnap.exists()) {
    shiftInput.value = "";
    positionInput.value = "";
    operatorFields.style.display = "none";
    teamInput.value = "";
    return;
  }
  const user = userSnap.val();

  shiftInput.value = user.Shift || "";

  // Jika posisi mengandung "operator", tampilkan field team dan cek di node MPPIC
  let dispPosition = user.Position || "";
  if ((dispPosition || "").toLowerCase().includes("operator")) {
    dispPosition = "Operator";
    operatorFields.style.display = "block";
    // Cek keberadaan user di node MPPIC
    const mppicSnap = await get(ref(db, `MPPIC/${username}`));
    if (mppicSnap.exists()) {
      const mppic = mppicSnap.val();
      teamInput.value = mppic.team || "";
    } else {
      teamInput.value = "";
    }
  } else {
    operatorFields.style.display = "none";
    teamInput.value = "";
  }
  positionInput.value = dispPosition;
}

/**
 * Listener untuk proses login ketika form di-submit.
 * - Validasi password.
 * - Untuk operator: validasi userID harus ada di node MPPIC dan ambil team dari sana.
 * - Redirect sesuai role dan team.
 */
document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  if (!isAuthenticated) {
    errorMsg.textContent = "Autentikasi belum siap. Silakan refresh halaman.";
    errorMsg.style.display = "block";
    return;
  }

  loginBtn.disabled = true;
  loginBtnText.style.display = "none";
  loginLoader.style.display = "inline-block";
  errorMsg.style.display = "none";

  try {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    await authPromise;
    // Validasi user di node users
    const userSnap = await get(ref(db, `users/${username}`));
    if (!userSnap.exists()) throw new Error("User ID tidak ditemukan!");

    const user = userSnap.val();
    if (String(user.Password) !== String(password)) throw new Error("Password salah!");

    // Simpan info ke localStorage/sessionStorage
    localStorage.setItem("shift", user.Shift || "");
    localStorage.setItem("position", user.Position || "");
    localStorage.setItem("username", username);
    localStorage.setItem("loginTime", Date.now());
    localStorage.setItem("pic", user.Name || username);
    localStorage.setItem("team", user.Shift || "");
    sessionStorage.setItem("userId", username);

    // Jika Operator
    if ((user.Position || "").toLowerCase().includes("operator")) {
      // Ambil data dari node MPPIC
      const mppicSnap = await get(ref(db, `MPPIC/${username}`));
      if (!mppicSnap.exists()) throw new Error("User ID tidak didaftarkan sebagai MP PIC oleh Team Leader.");
      const mppic = mppicSnap.val();
      const team = mppic.team;
      if (!team) throw new Error("Team tidak ditemukan di database.");

      // Simpan info login operator ke database (opsional, sesuai kebutuhan lama)
      const waktu_login = new Date().toISOString();
      const teamKey = team === "Sugity"
        ? "TeamSugity"
        : team === "Reguler"
        ? "TeamReguler"
        : team;
      await set(
        ref(db, `PICOperator/${teamKey}`),
        {
          userId: username,
          name: user.Name || username,
          waktu_login
        }
      );
      // Redirect sesuai team dari node MPPIC
      if (team === "Sugity") {
        window.location.href = "monitoring-control/team-sugity.html";
      } else if (team === "Reguler") {
        window.location.href = "monitoring-control/team-reguler.html";
      } else {
        throw new Error("Team tidak valid.");
      }
    } else {
      // Non-operator, redirect ke sort-job
      window.location.href = "monitoring-control/sort-job.html";
    }
  } catch (err) {
    errorMsg.textContent = err.message || "Terjadi kesalahan saat login.";
    errorMsg.style.display = "block";
  } finally {
    loginBtn.disabled = false;
    loginBtnText.style.display = "inline";
    loginLoader.style.display = "none";
  }
});

/**
 * Fungsi utilitas untuk setup tombol role di halaman lain.
 * Logout dan back button diatur sesuai role user.
 */
export async function setupRoleButtons() {
  await authPromise;
  const userId = sessionStorage.getItem("userId");
  const backBtn = document.getElementById("backToSortirBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Sembunyikan semua tombol dulu secara default
  if (backBtn) backBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "none";

  if (!userId) return;

  // Ambil posisi user dari database
  const userSnap = await get(ref(db, `users/${userId}`));
  if (!userSnap.exists()) return;

  const userPosition = (userSnap.val().Position || "").toLowerCase();
  const isOperator = userPosition.includes("operator");

  if (isOperator) {
    // Operator: hanya tombol logout yang tampil
    if (logoutBtn) {
      logoutBtn.style.display = "inline-block";
      logoutBtn.onclick = () => {
        sessionStorage.clear();
        window.location.href = "../index.html";
      };
    }
    if (backBtn) backBtn.style.display = "none";
  } else {
    // Non-operator: hanya tombol back yang tampil
    if (backBtn) {
      backBtn.style.display = "inline-block";
      backBtn.onclick = () => window.location.href = "sort-job.html";
    }
    if (logoutBtn) logoutBtn.style.display = "none";
  }
}