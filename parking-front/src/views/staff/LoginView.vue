<template>
  <div class="login-screen">
    <div class="mfu-crest fixed right-20 top-8" aria-hidden="true">
      <img :src="mfuLogo" alt="Mae Fah Luang University" />
    </div>

    <aside class="demo-credentials" aria-label="Demo login credentials">
      <p>Demo Login</p>
      <div>
        <strong>Staff</strong>
        <span>Username: staff1</span>
        <span>Password: password123</span>
      </div>
      <div>
        <strong>Admin</strong>
        <span>Username: Admin1</span>
        <span>Password: password123</span>
      </div>
    </aside>

    <div class="login-content">
      <div class="app-badge" aria-hidden="true">
        <div class="badge-ring">
          <CarFront class="h-12 w-12 text-[#f3c034]" :stroke-width="1.8" />
          <span>MFU Parking</span>
        </div>
      </div>

      <h1>MFU Parking Management</h1>

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
  margin: 68px 0 56px;
  color: #ffb400;
  font-size: 46px;
  font-weight: 400;
  line-height: 1;
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

.demo-credentials {
  position: fixed;
  left: 28px;
  bottom: 26px;
  width: 238px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ffe8e8;
  padding: 14px 16px;
  display: grid;
  gap: 11px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(4px);
}

.demo-credentials p {
  color: #ffcf4d;
  font-size: 14px;
  font-weight: 800;
}

.demo-credentials div {
  display: grid;
  gap: 3px;
}

.demo-credentials strong {
  color: #fff;
  font-size: 13px;
}

.demo-credentials span {
  color: #ffe8e8;
  font-size: 12px;
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

  .demo-credentials {
    position: static;
    width: min(292px, 90vw);
    margin: 16px auto 0;
    order: 2;
  }
}
</style>
