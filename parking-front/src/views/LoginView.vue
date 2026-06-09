<template>
  <div class="min-h-screen bg-gradient-to-br from-mfu-red to-red-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white rounded-lg shadow-2xl p-8">
      <!-- App Icon -->
      <div class="text-center mb-8">
        <div class="text-6xl font-bold text-mfu-gold mb-2">🅿️</div>
        <h1 class="text-3xl font-bold text-gray-900 mb-2">MFU Parking</h1>
        <p class="text-sm text-gray-600">Management System</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="space-y-6">
        <!-- Username -->
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            placeholder="Enter your username"
            class="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mfu-red transition"
            required
          />
        </div>

        <!-- Password -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="Enter your password"
            class="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mfu-red transition"
            required
          />
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {{ error }}
        </div>

        <!-- Login Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-mfu-red hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <i v-if="!isLoading" class="pi pi-sign-in"></i>
          <span v-if="isLoading">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})

const isLoading = ref(false)
const error = ref('')

const handleLogin = async () => {
  isLoading.value = true
  error.value = ''

  const success = await authStore.login(form.username, form.password)

  if (success) {
    router.push('/dashboard')
  } else {
    error.value = authStore.error
  }

  isLoading.value = false
}
</script>

<style scoped></style>
