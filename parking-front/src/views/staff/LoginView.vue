<template>
  <div class="login-screen">
    <div class="mfu-crest fixed right-20 top-8" aria-hidden="true">
      <img :src="mfuLogo" alt="Mae Fah Luang University" />
    </div>

    <div class="login-content">
      <div class="app-badge" aria-hidden="true">
        <div class="badge-ring">
          <CarFront class="h-12 w-12 text-[#f3c034]" :stroke-width="1.8" />
          <span>MFU Parking</span>
        </div>
      </div>

      <h1>MFU Parking Management</h1>
      <p class="login-subtitle">Admin & Staff Portal</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <input
          id="username"
          v-model="form.username"
          type="text"
          placeholder="Username"
          class="login-input"
          required
        />

        <input
          id="password"
          v-model="form.password"
          type="password"
          placeholder="Password"
          class="login-input"
          required
        />

        <div v-if="error" class="login-error">
          {{ error }}
        </div>

        <button type="submit" :disabled="isLoading" class="login-button">
          <span v-if="isLoading">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </form>

      <p class="demo-info">
        <strong>Demo Credentials:</strong><br>
        Admin: Admin1 / password123<br>
        Staff: staff1 / password123
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { CarFront } from 'lucide-vue-next'
import mfuLogo from '@/assets/mae-fah-luang-university.png'

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
    // Route based on user role
    if (authStore.user?.role === 'admin') {
      router.push('/admin/dashboard')
    } else {
      router.push('/dashboard')
    }
  } else {
    error.value = authStore.error || 'Login failed'
  }

  isLoading.value = false
}
</script>

<style scoped>
.login-screen {
  min-height: 100vh;
  background: #9f2f30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-content {
  width: min(620px, 92vw);
  margin-top: -44px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-badge {
  width: 132px;
  height: 132px;
  border-radius: 26px;
  background: #8d292b;
  display: grid;
  place-items: center;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.28);
}

.badge-ring {
  width: 116px;
  height: 116px;
  border: 4px solid #d9b43d;
  border-radius: 999px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #f3c034;
  font-size: 13px;
  font-weight: 800;
}

h1 {
  margin: 68px 0 8px;
  color: #ffb400;
  font-size: 46px;
  font-weight: 400;
  line-height: 1;
}

.login-subtitle {
  color: #ffe2e2;
  font-size: 14px;
  margin-bottom: 32px;
}

.login-form {
  width: 292px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 58px;
}

.login-input {
  width: 292px;
  height: 44px;
  border: 0;
  border-radius: 9px;
  background: #dedede;
  padding: 0 16px;
  color: #242424;
  font-size: 19px;
  outline: none;
}

.login-input::placeholder {
  color: #7f7f7f;
}

.login-input:focus {
  box-shadow: 0 0 0 3px rgba(255, 180, 0, 0.34);
}

.login-error {
  width: 292px;
  margin-top: -34px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.16);
  color: #ffe2e2;
  padding: 10px 12px;
  font-size: 13px;
}

.login-button {
  width: 126px;
  height: 50px;
  margin-top: 12px;
  border-radius: 9px;
  background: #dedede;
  color: #171717;
  font-size: 18px;
  transition:
    transform 0.16s ease,
    background 0.16s ease;
}

.login-button:hover {
  background: #eeeeee;
  transform: translateY(-1px);
}

.login-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.mfu-crest {
  width: 114px;
  height: 142px;
  display: grid;
  place-items: center;
}

.mfu-crest img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.2));
}

.demo-info {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  margin-top: 32px;
  text-align: center;
  line-height: 1.6;
}

.demo-info strong {
  color: #ffb400;
  display: block;
  margin-bottom: 8px;
}

@media (max-width: 720px) {
  .mfu-crest {
    right: 24px;
    top: 24px;
    transform: scale(0.78);
    transform-origin: top right;
  }

  h1 {
    font-size: 34px;
    text-align: center;
  }
}
</style>
