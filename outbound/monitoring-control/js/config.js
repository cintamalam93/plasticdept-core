// config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAfIYig9-sv3RfazwAW6X937_5HJfgnYt4",
  authDomain: "outobund.firebaseapp.com",
  databaseURL: "https://outobund-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "outobund",
  storageBucket: "outobund.firebasestorage.app",
  messagingSenderId: "84643346476",
  appId: "1:84643346476:web:beb19c5ea0884fcb083989"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
