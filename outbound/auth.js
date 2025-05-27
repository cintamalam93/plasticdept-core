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
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// UI Elements
const positionSelect = document.getElementById("position");
const operatorFields = document.getElementById("operatorFields");
const usernameContainer = document.getElementById("usernameContainer");
const usernameInput = document.getElementById("username");

const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginLoader = document.getElementById("loginLoader");
const errorMsg = document.getElementById("errorMsg");

// Posisi change logic
positionSelect.addEventListener("change", () => {
  if (positionSelect.value === "Operator") {
    operatorFields.style.display = "block";
    usernameContainer.style.display = "none";
    usernameInput.required = false;
  } else {
    operatorFields.style.display = "none";
    usernameContainer.style.display = "block";
    usernameInput.required = true;
  }
});

// Pastikan anonymous login sebelum proses apapun
let isAuthenticated = false;
signInAnonymously(auth)
  .then(() => {
    isAuthenticated = true;
  })
  .catch((error) => {
    errorMsg.textContent = "Gagal login anonymous: " + error.message;
    errorMsg.style.display = "block";
    loginBtn.disabled = true;
  });

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
    const shift = document.getElementById("shift").value;
    const position = document.getElementById("position").value;
    const username =
      position === "Operator"
        ? document.getElementById("picInput").value.trim()
        : document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    let userFound = null;

    // Ambil data user dari ROOT, bukan dalam PhxOutboundJobs
    const usersRef = ref(db, "users");
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      throw new Error("Database user tidak ditemukan!");
    }
    const users = snapshot.val();

    // Cari user yang cocok
    for (const userId in users) {
      const user = users[userId];
      if (
        userId.trim().toLowerCase() === username.trim().toLowerCase() &&
        user.Password === password &&
        (
          user.Position.trim().toLowerCase() === position.trim().toLowerCase() ||
          (position.trim().toLowerCase() === "operator" && user.Position.trim().toLowerCase().includes("operator"))
        )
      ) {
        userFound = { ...user, userId };
        break;
      }
    }

    if (!userFound) {
      throw new Error("User ID, password, atau posisi tidak cocok!");
    }

    // Simpan session ke localStorage
    localStorage.setItem("shift", shift);
    localStorage.setItem("position", userFound.Position);
    localStorage.setItem("username", userFound.userId);
    localStorage.setItem("pic", userFound.Name || userFound.userId);
    localStorage.setItem("team", userFound.Shift || "");

    // Redirect sesuai role
    if (position === "Operator") {
      const team = document.getElementById("teamSelect").value;
      if (!team || !userFound.Shift) {
        throw new Error("Lengkapi pilihan Team dan User ID (PIC) terlebih dahulu.");
      }
      if (team === "Sugity") {
        window.location.href = "monitoring-control/team-sugity.html";
      } else if (team === "Reguler") {
        window.location.href = "monitoring-control/team-reguler.html";
      } else {
        throw new Error("Team tidak valid.");
      }
    } else {
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