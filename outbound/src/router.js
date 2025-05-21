import { createRouter, createWebHashHistory } from 'vue-router';
import Dashboard from './views/Dashboard.vue';
// Tambahkan rute lain di sini sesuai kebutuhan

const routes = [
  { path: '/', component: Dashboard },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Middleware: Cek jika belum login, redirect ke halaman login utama
router.beforeEach((to, from, next) => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) {
    window.location.href = '/'; // root login
  } else {
    next();
  }
});

export default router;
