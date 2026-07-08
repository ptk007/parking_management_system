<template>
  <div class="login-screen" :style="loginScreenStyle">
    <aside class="demo-credentials" aria-label="Demo login credentials">
      <p>Demo Login</p>
      <button
        v-for="account in demoAccounts"
        :key="account.username"
        class="demo-account"
        type="button"
        @click="fillDemo(account)"
      >
        <ShieldCheck class="demo-icon" :stroke-width="2.2" />
        <span>
          <strong>{{ account.label }}</strong>
          <small>{{ account.username }} / {{ account.password }}</small>
        </span>
      </button>
    </aside>

    <div class="login-content">
      <div class="app-badge" aria-hidden="true">
        <img class="badge-crest" :src="mfuLogo" alt="" />
      </div>

      <h1>MFU Parking Management</h1>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label for="username" class="sr-only">Username</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            name="username"
            autocomplete="username"
            placeholder="Username"
            class="login-input"
            :aria-invalid="Boolean(error)"
            required
          />
        </div>

        <div class="field">
          <label for="password" class="sr-only">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Password"
            class="login-input"
            :aria-invalid="Boolean(error)"
            required
          />
        </div>

        <div v-if="error" class="login-error">
          {{ error }}
        </div>

        <button type="submit" :disabled="isLoading" class="login-button">
          <LogIn v-if="!isLoading" class="login-icon" :stroke-width="2.4" />
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
import { LogIn, ShieldCheck } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import loginBackground from '@/assets/mba-mfu.jpg'
import mfuLogo from '@/assets/mae-fah-luang-university.png'

interface DemoAccount {
  label: string
  username: string
  password: string
}

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})

const isLoading = ref(false)
const error = ref('')

const demoAccounts: DemoAccount[] = [
  { label: 'Staff', username: 'staff1', password: 'password123' },
  { label: 'Admin', username: 'Admin1', password: 'password123' },
]

const loginScreenStyle = {
  '--login-bg-image': `url(${loginBackground})`,
}

const fillDemo = (account: DemoAccount) => {
  form.username = account.username
  form.password = account.password
  error.value = ''
}

const routeAfterLogin = () => {
  return authStore.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'
}

const handleLogin = async () => {
  isLoading.value = true
  error.value = ''

  try {
    const username = form.username.trim()
    const password = form.password

    if (!username || !password) {
      error.value = 'Please enter username and password'
      return
    }

    const success = await authStore.login(username, password)

    if (success) {
      await router.push(routeAfterLogin())
      return
    }

    error.value = authStore.error || 'Login failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-screen {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: var(--login-bg-image), #9f2f30;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-content {
  position: relative;
  z-index: 1;
  width: min(640px, 92vw);
  margin-top: -28px;
  border: 1px solid rgba(255, 214, 96, 0.18);
  border-radius: 8px;
  background: rgba(111, 27, 30, 0.86);
  padding: 30px 24px 34px;
  box-shadow: 0 22px 70px rgba(66, 11, 12, 0.22);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-badge {
  width: 124px;
  height: 124px;
  border-radius: 8px;
  background: #8d292b;
  display: grid;
  place-items: center;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.28);
}

.badge-crest {
  width: 102px;
  height: 112px;
  object-fit: contain;
  filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.24));
}

h1 {
  margin: 46px 0 34px;
  color: #ffb400;
  font-size: 44px;
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: 0;
  text-align: center;
  white-space: nowrap;
}

.login-form {
  width: min(328px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.field {
  width: 100%;
}

.login-input {
  width: 100%;
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 8px;
  background: #f1f1f1;
  padding: 0 15px;
  color: #202020;
  font-size: 17px;
  outline: none;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.login-input::placeholder {
  color: #777;
}

.login-input:focus {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(255, 180, 0, 0.34);
}

.login-input[aria-invalid='true'] {
  border-color: rgba(255, 202, 202, 0.82);
}

.login-error {
  width: 100%;
  border: 1px solid rgba(255, 205, 205, 0.28);
  border-radius: 8px;
  background: rgba(74, 8, 10, 0.34);
  color: #ffe7e7;
  padding: 10px 12px;
  font-size: 13px;
}

.login-button {
  width: 156px;
  height: 48px;
  margin-top: 4px;
  border-radius: 8px;
  background: #ffbf24;
  color: #251205;
  font-size: 17px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    box-shadow 0.16s ease;
}

.login-button:hover {
  background: #ffd463;
  box-shadow: 0 8px 20px rgba(73, 23, 5, 0.2);
  transform: translateY(-1px);
}

.login-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
}

.login-icon {
  width: 19px;
  height: 19px;
}

.demo-credentials {
  position: fixed;
  left: 28px;
  bottom: 26px;
  z-index: 1;
  width: 238px;
  border: 1px solid rgba(255, 221, 141, 0.2);
  border-radius: 8px;
  background: rgba(92, 20, 22, 0.78);
  color: #ffe8e8;
  padding: 14px;
  display: grid;
  gap: 10px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(4px);
}

.demo-credentials p {
  color: #ffcf4d;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0;
}

.demo-account {
  min-height: 50px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  text-align: left;
  transition:
    background 0.16s ease,
    transform 0.16s ease;
}

.demo-account:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: translateY(-1px);
}

.demo-icon {
  width: 21px;
  height: 21px;
  color: #ffcf4d;
  flex: 0 0 auto;
}

.demo-account span {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.demo-account strong {
  color: #fff;
  font-size: 13px;
}

.demo-account small {
  color: #ffe8e8;
  font-size: 12px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 720px) {
  .login-screen {
    min-height: 100svh;
    flex-direction: column;
    justify-content: flex-start;
    padding: 112px 16px 24px;
  }

  .login-content {
    width: min(420px, 100%);
    margin-top: 0;
    padding: 24px 18px 28px;
    order: 1;
  }

  .app-badge {
    width: 104px;
    height: 104px;
  }

  .badge-crest {
    width: 86px;
    height: 92px;
  }

  h1 {
    margin: 30px 0 28px;
    font-size: 34px;
    white-space: normal;
  }

  .demo-credentials {
    position: static;
    width: min(420px, 100%);
    margin: 16px auto 0;
    order: 2;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .demo-credentials p {
    grid-column: 1 / -1;
  }

  .demo-account {
    min-height: 72px;
    align-items: flex-start;
  }
}
</style>
