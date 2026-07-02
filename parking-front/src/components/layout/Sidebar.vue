<template>
  <aside class="staff-sidebar">
    <router-link to="/dashboard" class="sidebar-crest" aria-label="Go to dashboard">
      <img :src="mfuLogo" alt="Mae Fah Luang University" />
    </router-link>

    <nav class="sidebar-nav">
      <router-link
        to="/dashboard"
        :class="['nav-card', route.path.startsWith('/dashboard') ? 'is-active' : '']"
      >
        <Monitor class="nav-icon" :stroke-width="2.6" />
        <span>Dashboard</span>
      </router-link>

      <router-link to="/history" :class="['nav-card', route.path === '/history' ? 'is-active' : '']">
        <Clock3 class="nav-icon" :stroke-width="3" />
        <span>History</span>
      </router-link>
    </nav>

    <button class="logout-button" @click="logout" aria-label="Logout">
      <LogOut class="h-5 w-5" :stroke-width="2.4" />
    </button>
  </aside>
</template>

<script setup lang="ts">
import { Clock3, LogOut, Monitor } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import mfuLogo from '@/assets/mae-fah-luang-university.png'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.staff-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  width: 122px;
  background: #cf4647;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar-crest {
  width: 96px;
  height: 116px;
  margin-top: 24px;
  display: grid;
  place-items: center;
}

.sidebar-crest img {
  width: 76px;
  height: 100px;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.18));
}

.sidebar-nav {
  width: 100%;
  margin-top: 18px;
  display: grid;
  gap: 10px;
  padding: 0 4px;
}

.nav-card {
  height: 78px;
  border-radius: 5px;
  background: #fff;
  color: #a7a7a7;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  font-size: 12px;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.nav-card:hover {
  transform: translateX(2px);
}

.nav-card.is-active {
  background: #fdeceb;
  color: #9e2d25;
  font-weight: 700;
}

.nav-icon {
  width: 31px;
  height: 31px;
  color: #232323;
  flex: 0 0 auto;
}

.logout-button {
  margin-top: auto;
  margin-bottom: 18px;
  width: 48px;
  height: 42px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.86);
  display: grid;
  place-items: center;
  opacity: 0.75;
}

.logout-button:hover {
  background: rgba(255, 255, 255, 0.12);
  opacity: 1;
}
</style>
