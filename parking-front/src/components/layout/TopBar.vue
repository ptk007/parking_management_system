<template>
  <div class="ml-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex items-center justify-between">
    <!-- Left Section -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">MFU Parking Management</h1>
      <p class="text-sm text-gray-600">{{ userFullName }}</p>
    </div>

    <!-- Right Section -->
    <div class="flex items-center space-x-6">
      <!-- Online Status -->
      <div class="flex items-center space-x-2">
        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
        <span class="text-sm text-gray-700">Online</span>
      </div>

      <!-- Notifications -->
      <button class="relative text-gray-600 hover:text-gray-900 transition">
        <i class="pi pi-bell text-xl"></i>
        <span v-if="unreadNotifications > 0" class="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {{ unreadNotifications }}
        </span>
      </button>

      <!-- Avatar -->
      <div class="w-10 h-10 bg-mfu-red text-white rounded-full flex items-center justify-center font-semibold cursor-pointer hover:bg-red-700 transition">
        {{ userInitials }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const authStore = useAuthStore()
const chatStore = useChatStore()

const userFullName = computed(() => authStore.user?.fullName || 'Staff')
const userInitials = computed(() => {
  const name = authStore.user?.fullName || ''
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
})

const unreadNotifications = computed(() => chatStore.unreadCount)
</script>

<style scoped></style>
