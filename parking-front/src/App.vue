<template>
  <div class="min-h-screen bg-[#d9d9d9]">
    <router-view v-if="isLoginRoute" />

    <div v-else class="min-h-screen">
      <Sidebar />
      <TopBar />

      <main>
        <router-view />
      </main>

      <div v-if="authStore.isAuthenticated" class="help-actions">
        <ChatWidget v-if="!authStore.isGuest && authStore.user?.role !== 'admin'" />
        <UserGuide
          v-if="guideRole && authStore.user"
          :key="`${guideRole}:${authStore.user._id}`"
          :role="guideRole"
          :account-id="authStore.user._id"
          :open-on-sign-in="authStore.signedInThisSession"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from './components/layout/Sidebar.vue'
import TopBar from './components/layout/TopBar.vue'
import ChatWidget from './components/chat/ChatWidget.vue'
import UserGuide from './components/guide/UserGuide.vue'
import type { GuideRole } from './components/guide/guideContent'
import { useAuthStore } from '@/stores/auth'
import { computed, onMounted, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { language } from '@/i18n'

const authStore = useAuthStore()
const router = useRouter()
const isLoginRoute = computed(() => router.currentRoute.value.path === '/login')
const guideRole = computed<GuideRole | null>(() => {
  if (authStore.isGuest) return 'guest'
  if (authStore.isAdmin) return 'admin'
  if (authStore.canManageParking) return 'staff'
  if (authStore.user?.role === 'public') return 'public'
  if (authStore.user?.role === 'user') return 'student'
  return null
})
watchEffect(() => {
  document.documentElement.lang = language.value
})

onMounted(async () => {
  authStore.initFromStorage()

  // Redirect to login if not authenticated
  if (!authStore.isAuthenticated && router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
})
</script>

<style scoped>
.help-actions {
  position: fixed;
  left: 0;
  bottom: 78px;
  z-index: 60;
  width: 138px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
</style>
