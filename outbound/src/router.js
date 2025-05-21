import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
// Tambahkan import lain jika sudah ada

const routes = [
  { path: '/', component: Dashboard },
  // ...rute lain nanti
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
