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

// Elemen
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const shiftInput = document.getElementById("shift");
const positionInput = document.getElementById("position");
const operatorFields = document.getElementById("operatorFields");
const teamSelect = document.getElementById("teamSelect");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginLoader = document.getElementById("loginLoader");
const errorMsg = document.getElementById("errorMsg");

// Otomatis isi shift & position ketika userID diinput
usernameInput.addEventListener("blur", getUserDataAndFill);

async function getUserDataAndFill() {
  const username = usernameInput.value.trim();
  // Reset field
  shiftInput.value = "";
  positionInput.value = "";
  operatorFields.style.display = "none";
  teamSelect.value = "";

  if (!username) return;

  await authPromise;
  const userSnap = await get(ref(db, `users/${username}`));
  if (!userSnap.exists()) {
    shiftInput.value = "";
    positionInput.value = "";
    operatorFields.style.display = "none";
    return;
  }
  const user = userSnap.val();

  shiftInput.value = user.Shift || "";

  // Jika posisi mengandung "operator", selalu tampilkan "Operator" saja
  let dispPosition = user.Position || "";
  if ((dispPosition || "").toLowerCase().includes("operator")) {
    dispPosition = "Operator";
    operatorFields.style.display = "block";
  } else {
    operatorFields.style.display = "none";
    teamSelect.value = "";
  }
  positionInput.value = dispPosition;
}

// Login logic
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
    const userSnap = await get(ref(db, `users/${username}`));
    if (!userSnap.exists()) throw new Error("User ID tidak ditemukan!");

    const user = userSnap.val();
    if (String(user.Password) !== String(password)) throw new Error("Password salah!");

    // Untuk penyimpanan ke storage, gunakan posisi asli dari database
    localStorage.setItem("shift", user.Shift || "");
    localStorage.setItem("position", user.Position || "");
    localStorage.setItem("username", username);
    localStorage.setItem("pic", user.Name || username);
    localStorage.setItem("team", user.Shift || "");
    sessionStorage.setItem("userId", username);

    // Jika Operator, wajib pilih Team
    if ((user.Position || "").toLowerCase().includes("operator")) {
      const team = teamSelect.value;
      if (!team) throw new Error("Pilih Team terlebih dahulu.");
      // Simpan PIC Operator ke Firebase
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
      // Redirect sesuai team
      if (team === "Sugity") {
        window.location.href = "monitoring-control/team-sugity.html";
      } else if (team === "Reguler") {
        window.location.href = "monitoring-control/team-reguler.html";
      } else {
        throw new Error("Team tidak valid.");
      }
    } else {
      // Non-operator, langsung ke sort-job
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

// === SETUP ROLE BUTTONS ===
export async function setupRoleButtons() {
  await authPromise;
  const userId = sessionStorage.getItem("userId");
  const backBtn = document.getElementById("backToSortirBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  // Default: sembunyikan semua tombol dulu
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