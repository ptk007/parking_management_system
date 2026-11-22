import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isAxiosError } from 'axios'
import type { ApiUser, User, AuthResponse, UserStatus } from '@/types'
import { authService } from '@/services/api'

type StoredUser = Omit<Partial<ApiUser>, 'status'> &
  Omit<Partial<User>, 'status'> & { status?: UserStatus | 'disabled' }

const GUEST_TOKEN_PREFIX = 'guest_token_'
const GUEST_USER_ID = 'guest'

const createInitials = (name: string, username: string) => {
  const source = name.trim() || username.trim() || 'U'
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  return (initials || source.slice(0, 2) || 'U').toUpperCase()
}

const normalizeStatus = (status?: StoredUser['status']): UserStatus => {
  return status === 'disabled' || status === 'disable' ? 'disable' : status || 'offline'
}

const normalizeUser = (apiUser: StoredUser): User => {
  const id = apiUser._id || apiUser.id || ''
  const username = apiUser.username || ''
  const fullName = apiUser.name || apiUser.fullName || username

  return {
    ...apiUser,
    _id: id,
    id,
    username,
    name: apiUser.name || fullName,
    fullName,
    role: apiUser.role || 'user',
    status: normalizeStatus(apiUser.status),
    user_image: apiUser.user_image ?? null,
    avatar: apiUser.avatar || createInitials(fullName, username),
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const isLoading = ref(false)
  const error = ref<string>('')

  const isAuthenticated = computed(() => !!token.value)
  const isGuest = computed(
    () => token.value.startsWith(GUEST_TOKEN_PREFIX) || user.value?._id === GUEST_USER_ID,
  )
  const isAdmin = computed(
    () =>
      isAuthenticated.value &&
      !isGuest.value &&
      user.value?.status !== 'disable' &&
      user.value?.role === 'admin',
  )
  const canManageParking = computed(
    () =>
      isAdmin.value ||
      (isAuthenticated.value &&
        !isGuest.value &&
        user.value?.status !== 'disable' &&
        user.value?.role === 'staff'),
  )

  const login = async (username: string, password: string) => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await authService.login(username, password)
      const data: AuthResponse = response.data
      const authUser = normalizeUser(data.user)

      token.value = data.token
      user.value = authUser

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(authUser))

      return true
    } catch (err) {
      error.value =
        (isAxiosError<{ message?: string }>(err) && err.response?.data?.message) ||
        'Invalid username or password'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const loginGuest = (username = 'guest') => {
    const guestUsername = username.trim() || 'guest'
    const guestUser: User = {
      _id: GUEST_USER_ID,
      id: GUEST_USER_ID,
      username: guestUsername,
      name: 'Guest User',
      fullName: 'Guest User',
      role: 'user',
      status: 'online',
      user_image: null,
      avatar: 'GU',
    }

    localStorage.removeItem('token')
    localStorage.removeItem('user')
    token.value = `${GUEST_TOKEN_PREFIX}${Date.now()}`
    user.value = guestUser
    error.value = ''
  }

  const logout = async () => {
    try {
      if (!isGuest.value) {
        await authService.logout()
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      user.value = null
      token.value = ''
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  const verifyToken = async () => {
    if (isGuest.value) return true

    try {
      const response = await authService.verifyToken()
      const data = response.data as { user?: ApiUser }
      if (response.status === 200 && data.user) {
        const authUser = normalizeUser(data.user)
        user.value = authUser
        localStorage.setItem('user', JSON.stringify(authUser))
        return true
      }
      return false
    } catch (err) {
      return false
    }
  }

  const initFromStorage = () => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken?.startsWith('demo_token_') || storedToken?.startsWith(GUEST_TOKEN_PREFIX)) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      token.value = ''
      user.value = null
      return
    }

    if (storedToken) {
      token.value = storedToken
    } else {
      localStorage.removeItem('user')
    }

    if (storedToken && storedUser) {
      try {
        user.value = normalizeUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('user')
        user.value = null
      }
    }
  }

  return {
    user,
    token,
    isLoading,
    error,
    isAuthenticated,
    isGuest,
    isAdmin,
    canManageParking,
    login,
    loginGuest,
    logout,
    verifyToken,
    initFromStorage,
  }
})
