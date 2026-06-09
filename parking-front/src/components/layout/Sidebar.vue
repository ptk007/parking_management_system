<template>
  <div class="w-40 bg-mfu-red text-white fixed left-0 top-0 h-screen flex flex-col shadow-lg">
    <!-- Logo -->
    <div class="p-4 border-b border-red-600 flex items-center justify-center">
      <div class="text-center">
        <div class="text-2xl font-bold text-mfu-gold">🅿️</div>
        <p class="text-xs mt-1 text-gray-100">MFU Parking</p>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-4 space-y-2">
      <router-link
        to="/dashboard"
        :class="[
          'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all',
          route.path.startsWith('/dashboard')
            ? 'bg-white text-mfu-red font-semibold'
            : 'text-white hover:bg-red-700',
        ]"
      >
        <i :class="['pi', 'pi-desktop', route.path.startsWith('/dashboard') ? 'text-mfu-red' : 'text-white']"></i>
        <span>Dashboard</span>
      </router-link>

      <router-link
        to="/history"
        :class="[
          'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all',
          route.path === '/history'
            ? 'bg-white text-mfu-red font-semibold'
            : 'text-white hover:bg-red-700',
        ]"
      >
        <i :class="['pi', 'pi-clock', route.path === '/history' ? 'text-mfu-red' : 'text-white']"></i>
        <span>History</span>
      </router-link>
    </nav>

    <!-- Logout Button -->
    <div class="p-4 border-t border-red-600">
      <button
        @click="logout"
        class="w-full flex items-center space-x-2 px-4 py-2 bg-red-700 hover:bg-red-800 rounded-lg transition text-white text-sm"
      >
        <i class="pi pi-sign-out"></i>
        <span>Logout</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped></style>
