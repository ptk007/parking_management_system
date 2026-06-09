import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, AuthResponse } from '@/types'
import { authService } from '@/services/api'

// Mock credentials for demo
const DEMO_CREDENTIALS: Record<string, { password: string; role: User['role'] }> = {
  staff1: { password: 'password123', role: 'staff' },
  admin1: { password: 'admin123', role: 'admin' },
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const isLoading = ref(false)
  const error = ref<string>('')

  const isAuthenticated = computed(() => !!token.value)

  const login = async (username: string, password: string) => {
    isLoading.value = true
    error.value = ''

    try {
      // Check demo credentials first
      const demoUser = DEMO_CREDENTIALS[username]
      if (demoUser && demoUser.password === password) {
        // Create mock user and token for demo
        const mockUser: User = {
          id: '1',
          username: username,
          fullName: username === 'staff1' ? 'Thanatip P.' : 'Admin User',
          role: demoUser.role,
          buildingId: 'E4',
          floorId: '4',
          status: 'online',
          avatar: username.slice(0, 2).toUpperCase() || 'U',
        }
        const mockToken = `demo_token_${Date.now()}`

        token.value = mockToken
        user.value = mockUser

        localStorage.setItem('token', mockToken)
        localStorage.setItem('user', JSON.stringify(mockUser))

        return true
      }

      // Otherwise try real API
      const response = await authService.login(username, password)
      const data: AuthResponse = response.data

      token.value = data.token
      user.value = data.user

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      return true
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Invalid username or password'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    try {
      await authService.logout()
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
    try {
      const response = await authService.verifyToken()
      if (response.status === 200) {
        return true
      }
    } catch (err) {
      return false
    }
  }

  const initFromStorage = () => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken) {
      token.value = storedToken
    }

    if (storedUser) {
      user.value = JSON.parse(storedUser)
    }
  }

  return {
    user,
    token,
    isLoading,
    error,
    isAuthenticated,
    login,
    logout,
    verifyToken,
    initFromStorage,
  }
})
