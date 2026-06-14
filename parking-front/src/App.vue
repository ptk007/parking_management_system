<template>
  <div class="min-h-screen bg-[#d9d9d9]">
    <router-view v-if="isLoginRoute" />

    <div v-else class="min-h-screen">
      <Sidebar />
      <TopBar />

      <main>
        <router-view />
      </main>

      <ChatWidget />
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from './components/layout/Sidebar.vue'
import TopBar from './components/layout/TopBar.vue'
import ChatWidget from './components/chat/ChatWidget.vue'
import { useAuthStore } from '@/stores/auth'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const isLoginRoute = computed(() => router.currentRoute.value.path === '/login')

onMounted(async () => {
  authStore.initFromStorage()

  // Redirect to login if not authenticated
  if (!authStore.isAuthenticated && router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
})
</script>

<style scoped></style>
