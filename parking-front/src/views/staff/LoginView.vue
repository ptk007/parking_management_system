<template>
  <div class="min-h-screen bg-gradient-to-br from-mfu-red to-red-800 flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white rounded-lg shadow-2xl p-8">
      <!-- MFU Logo -->
      <div class="text-center mb-8">
        <div class="flex justify-center mb-4">
          <div class="text-6xl">👑</div>
        </div>
        <h1 class="text-4xl font-bold text-mfu-gold mb-2">MFU Parking</h1>
        <p class="text-xl text-mfu-gold font-semibold">Management System</p>
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
            placeholder="Username"
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
            placeholder="Password"
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
          class="w-full bg-mfu-red hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isLoading">Logging in...</span>
          <span v-else>Login</span>
        </button>

        <!-- Demo Credentials Hint -->
        <div class="bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg text-xs text-blue-700">
          <p class="font-semibold mb-1">Demo Credentials:</p>
          <p>Username: <span class="font-mono">staff1</span></p>
          <p>Password: <span class="font-mono">password123</span></p>
        </div>
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
    error.value = authStore.error || 'Login failed'
  }

  isLoading.value = false
}
</script>

<style scoped></style>
