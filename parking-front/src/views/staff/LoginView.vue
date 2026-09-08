<template>
  <div class="login-screen" :style="loginScreenStyle">
    <div class="login-content" :class="{ 'login-content--form': selectedRole }">
      <div class="app-badge" aria-hidden="true">
        <img class="badge-crest" :src="mfuLogo" alt="" />
      </div>

      <h1>MFU Parking Management</h1>

      <div v-if="!selectedRole" class="role-options" aria-label="Choose user type">
        <button type="button" class="role-card" @click="selectRole('student')">
          <GraduationCap class="role-icon graduation-icon" :stroke-width="2.6" />
          <span>Student</span>
          <small>&#x0E19;&#x0E31;&#x0E01;&#x0E28;&#x0E36;&#x0E01;&#x0E29;&#x0E32;</small>
        </button>

        <button type="button" class="role-card" @click="selectRole('admin')">
          <UserRound class="role-icon" :stroke-width="3" />
          <span>Admin</span>
          <small>&#x0E40;&#x0E08;&#x0E49;&#x0E32;&#x0E2B;&#x0E19;&#x0E49;&#x0E32;&#x0E17;&#x0E35;&#x0E48;</small>
        </button>
      </div>

      <button v-if="!selectedRole" type="button" class="guest-link" @click="enterGuestDashboard">
        Guest User
      </button>

      <form v-else class="login-form" @submit.prevent="handleLogin">
        <button type="button" class="back-role" @click="clearRole">
          <ArrowLeft class="back-icon" :stroke-width="2.4" />
          <span>&#x0E22;&#x0E49;&#x0E2D;&#x0E19;&#x0E01;&#x0E25;&#x0E31;&#x0E1A;</span>
        </button>

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
          <span v-if="isLoading">Logging in...</span>
          <span v-else>Login</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, GraduationCap, UserRound } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import loginBackground from '@/assets/mba-mfu.jpg'
import mfuLogo from '@/assets/mae-fah-luang-university.png'

type LoginRole = 'student' | 'admin' | 'guest'

interface RoleConfig {
  label: string
  apiRole: 'user' | 'admin' | 'staff'
  route: string
}

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})

const selectedRole = ref<LoginRole | null>(null)
const isLoading = ref(false)
const error = ref('')

const loginScreenStyle = {
  '--login-bg-image': `url(${loginBackground})`,
}

const roleConfigs: Record<LoginRole, RoleConfig> = {
  student: {
    label: 'Student',
    apiRole: 'user',
    route: '/dashboard',
  },
  admin: {
    label: 'Admin',
    apiRole: 'admin',
    route: '/admin/dashboard',
  },
  guest: {
    label: 'Guest User',
    apiRole: 'user',
    route: '/dashboard',
  },
}

const selectedRoleConfig = computed(() => {
  return selectedRole.value ? roleConfigs[selectedRole.value] : roleConfigs.student
})

const selectRole = (role: LoginRole) => {
  selectedRole.value = role
  form.username = ''
  form.password = ''
  error.value = ''
}

const clearRole = () => {
  selectedRole.value = null
  form.username = ''
  form.password = ''
  error.value = ''
}

const enterGuestDashboard = async () => {
  authStore.loginGuest()
  await router.push('/dashboard')
}

const handleLogin = async () => {
  if (!selectedRole.value) return

  isLoading.value = true
  error.value = ''

  try {
    const username = form.username.trim()
    const password = form.password

    if (!username || !password) {
      error.value = 'Please enter username and password'
      return
    }

    const config = selectedRoleConfig.value

    if (selectedRole.value === 'guest') {
      authStore.loginGuest(username)
      await router.push(config.route)
      return
    }

    const success = await authStore.login(username, password)

    if (!success) {
      error.value = authStore.error || 'Login failed'
      return
    }

    if (authStore.user?.role !== config.apiRole) {
      await authStore.logout()
      error.value = `This account is not allowed for ${config.label}`
      return
    }

    await router.push(config.route)
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
  background: #9f2f30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.login-screen::before {
  position: absolute;
  inset: -10px;
  content: '';
  background: var(--login-bg-image), #9f2f30;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(3px);
  opacity: 0.86;
  transform: scale(1.02);
}

.login-content {
  position: relative;
  z-index: 1;
  width: min(508px, 92vw);
  min-height: 435px;
  border-radius: 30px;
  background: rgba(210, 109, 112, 0.94);
  padding: 45px 48px 54px;
  box-shadow: 0 24px 70px rgba(66, 11, 12, 0.24);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-content--form {
  width: min(508px, 92vw);
  min-height: 435px;
  border-radius: 30px;
  background: rgba(210, 109, 112, 0.94);
  padding: 45px 48px 48px;
  box-shadow: 0 24px 70px rgba(66, 11, 12, 0.24);
}

.app-badge {
  width: 74px;
  height: 74px;
  border-radius: 16px;
  background: #8d292b;
  display: grid;
  place-items: center;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.28);
}

.badge-crest {
  width: 66px;
  height: 66px;
  object-fit: contain;
  filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.24));
}

h1 {
  margin: 36px 0 61px;
  color: #ffb400;
  font-size: 25px;
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0;
  text-align: center;
  white-space: nowrap;
}

.role-options {
  display: flex;
  justify-content: center;
  gap: 29px;
}

.role-card {
  width: 122px;
  height: 104px;
  border: 0;
  border-radius: 12px;
  background: #d9d9d9;
  color: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.role-card:hover {
  box-shadow: 0 10px 22px rgba(73, 23, 5, 0.18);
  transform: translateY(-1px);
}

.role-card:focus-visible,
.guest-link:focus-visible,
.back-role:focus-visible,
.login-input:focus-visible,
.login-button:focus-visible {
  outline: 3px solid rgba(255, 180, 0, 0.72);
  outline-offset: 3px;
}

.role-icon {
  width: 45px;
  height: 45px;
  color: #000;
}

.graduation-icon {
  width: 61px;
}

.role-card span {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.15;
}

.role-card small {
  font-size: 12px;
  line-height: 1.15;
}

.guest-link {
  margin-top: 13px;
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.login-form {
  width: min(328px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.back-role {
  align-self: flex-start;
  min-height: 34px;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.11);
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.16s ease,
    transform 0.16s ease;
}

.back-role:hover {
  background: rgba(255, 255, 255, 0.17);
  transform: translateY(-1px);
}

.back-icon {
  width: 17px;
  height: 17px;
}

.field {
  width: 100%;
}

.login-input {
  width: 100%;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  background: #f1f1f1;
  padding: 0 13px;
  color: #202020;
  font-size: 15px;
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
  border: 1px solid rgba(255, 205, 205, 0.32);
  border-radius: 8px;
  background: rgba(74, 8, 10, 0.32);
  color: #ffe7e7;
  padding: 9px 11px;
  font-size: 12px;
}

.login-button {
  width: 132px;
  height: 42px;
  margin-top: 2px;
  border: 0;
  border-radius: 8px;
  background: #ffbf24;
  color: #251205;
  font-size: 15px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
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
  opacity: 0.72;
  transform: none;
}

.login-icon {
  width: 17px;
  height: 17px;
}

.login-content--form h1 {
  margin-bottom: 31px;
}

.login-content--form .login-form {
  width: min(328px, 100%);
  gap: 15px;
}

.login-content--form .back-role {
  margin-bottom: 5px;
}

.login-content--form .field + .field {
  margin-top: 0;
}

.login-content--form .login-input {
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 8px;
  background: #f1f1f1;
  padding: 0 15px;
  color: #202020;
  font-size: 17px;
}

.login-content--form .login-input::placeholder {
  color: #757575;
}

.login-content--form .login-input:focus {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(255, 180, 0, 0.34);
}

.login-content--form .login-error {
  margin-top: 0;
  font-size: 13px;
}

.login-content--form .login-button {
  width: 156px;
  height: 48px;
  margin-top: 4px;
  border-radius: 8px;
  background: #ffbf24;
  color: #251205;
  font-size: 17px;
  font-weight: 800;
}

.login-content--form .login-error + .login-button {
  margin-top: 4px;
}

.login-content--form .login-button:hover {
  background: #ffd463;
  box-shadow: 0 8px 20px rgba(73, 23, 5, 0.2);
  transform: translateY(-1px);
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
    min-height: auto;
    margin-top: 0;
    padding: 34px 18px 42px;
    order: 1;
  }

  .login-content--form {
    width: min(420px, 100%);
    min-height: auto;
    padding: 34px 18px 38px;
  }

  .app-badge {
    width: 74px;
    height: 74px;
  }

  .badge-crest {
    width: 66px;
    height: 66px;
  }

  h1 {
    margin: 32px 0 45px;
    font-size: 24px;
    white-space: normal;
  }

  .role-options {
    gap: 18px;
  }

  .role-card {
    width: 116px;
    height: 102px;
  }

  .login-content--form .login-form {
    width: min(328px, 100%);
  }

  .login-content--form .back-role {
    margin-bottom: 4px;
  }

  .login-content--form .field + .field {
    margin-top: 0;
  }

  .login-content--form .login-input {
    height: 48px;
    border-radius: 8px;
    font-size: 16px;
  }

  .login-content--form .login-button {
    width: 156px;
    height: 48px;
    margin-top: 4px;
    border-radius: 8px;
    font-size: 17px;
  }
}
</style>
