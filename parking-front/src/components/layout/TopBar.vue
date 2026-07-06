<template>
  <header class="app-topbar">
    <div>
      <h1>MFU Parking Management</h1>
      <p>{{ userSubtitle }}</p>
    </div>

    <div class="topbar-actions">
      <div class="online-status">
        <span></span>
        <strong>Online</strong>
      </div>

      <button class="bell-button" aria-label="Notifications">
        <Bell class="h-8 w-8" :stroke-width="1.8" />
        <span v-if="unreadNotifications > 0" class="notification-dot"></span>
      </button>

      <div class="avatar">{{ userInitials }}</div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bell } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

const authStore = useAuthStore()
const chatStore = useChatStore()
const route = useRoute()

const roleLabel = computed(() => {
  return authStore.user?.role === 'admin' || route.path.startsWith('/admin') ? 'Admin' : 'Staff'
})

const userFullName = computed(() => {
  if (authStore.user?.fullName) return authStore.user.fullName
  return roleLabel.value === 'Admin' ? 'Thanawit Boonphom' : 'Thanatip P.'
})

const userSubtitle = computed(() => `${userFullName.value} - ${roleLabel.value}`)

const userInitials = computed(() => {
  if (authStore.user?.avatar) return authStore.user.avatar

  const name = userFullName.value
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
})

const unreadNotifications = computed(() => chatStore.unreadCount || 3)
</script>

<style scoped>
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  height: 78px;
  margin-left: 138px;
  background: #fff;
  border-bottom: 1px solid #d2d2d2;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 18px;
}

h1 {
  color: #111;
  font-size: 25px;
  font-weight: 400;
  line-height: 1.08;
}

p {
  color: #9a9a9a;
  font-size: 15px;
  line-height: 1.2;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 22px;
}

.online-status {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #19d348;
  font-size: 15px;
}

.online-status span {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #19d348;
}

.online-status strong {
  color: #19d348;
  font-weight: 400;
}

.bell-button {
  position: relative;
  width: 36px;
  height: 40px;
  display: grid;
  place-items: center;
  color: #111;
}

.notification-dot {
  position: absolute;
  top: 8px;
  right: 4px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ff0d0d;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 999px;
  background: #fdeceb;
  color: #9e2d25;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 800;
}
</style>
