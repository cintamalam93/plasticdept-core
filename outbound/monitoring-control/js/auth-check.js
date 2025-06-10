// Konfigurasi waktu expired (dalam ms)
const maxAge = 2 * 60 * 60 * 1000; // 2 jam

const username = localStorage.getItem("username");
const loginTime = localStorage.getItem("loginTime");

if (!username || !loginTime || (Date.now() - loginTime > maxAge)) {
  localStorage.removeItem("username");
  localStorage.removeItem("loginTime");
  window.location.href = "../index.html";
}