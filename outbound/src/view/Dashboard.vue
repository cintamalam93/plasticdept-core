<template>
  <div class="dashboard">
    <h2>Monitoring Outbound - Dashboard</h2>
    <div v-if="user">
      <p>Halo, <b>{{ user.username }}</b> (Role: <i>{{ user.role }}</i>)</p>
      <div class="menu">
        <router-link v-if="isLeaderOrSpv" to="/input-job">Input/Manage Assignment</router-link>
        <router-link v-if="isOperator" to="/operator-jobs">Lihat Job Assignment</router-link>
        <router-link v-if="isManagerOrAsmenOrSpvOrLeader" to="/progress">Progress & Rekap</router-link>
        <button @click="logout" style="margin-top:20px">Logout</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const user = ref(null)

onMounted(() => {
  // Ambil user dari localStorage
  const d = localStorage.getItem('user')
  if (!d) {
    router.push('/')
    return
  }
  user.value = JSON.parse(d)
})

const isLeaderOrSpv = computed(() => 
  user.value && (user.value.role === 'team_leader' || user.value.role === 'spv')
)
const isOperator = computed(() => 
  user.value && user.value.role === 'operator'
)
const isManagerOrAsmenOrSpvOrLeader = computed(() =>
  user.value &&
    (user.value.role === 'manager' ||
     user.value.role === 'asstman' ||
     user.value.role === 'spv' ||
     user.value.role === 'team_leader')
)

function logout() {
  localStorage.removeItem('user')
  window.location.href = '/'
}
</script>

<style scoped>
.dashboard {
  max-width: 500px;
  margin: 40px auto;
  padding: 32px 24px;
  border-radius: 8px;
  background: #f6f7fa;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.menu {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.menu a {
  font-weight: bold;
  color: #2080fa;
  text-decoration: none;
}
.menu a:hover {
  text-decoration: underline;
}
</style>
