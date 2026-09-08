import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type { ChatTicket, NewSupportTicket } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authService = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  logout: () => apiClient.post('/auth/logout'),
  verifyToken: () => apiClient.get('/auth/verify'),
}

export const dashboardService = {
  getStats: (buildingId: string, floorId: string, vehicleType: string) =>
    apiClient.get('/staff/dashboard', {
      params: { buildingId, floorId, vehicleType },
    }),
}

export const parkingService = {
  getSlots: (buildingId: string, floorId: string) =>
    apiClient.get('/staff/parking/slots', {
      params: { buildingId, floorId },
    }),
  updateSlot: (slotId: string, status: string) =>
    apiClient.put(`/staff/parking/slots/${slotId}`, { status }),
  getLogs: (buildingId: string, floorId: string, vehicleType: string) =>
    apiClient.get('/staff/logs', {
      params: { buildingId, floorId, vehicleType },
    }),
}

export const vehicleService = {
  getByUser: (userId: string) => apiClient.get(`/vehicles/user/${userId}`),
  create: (data: any) => apiClient.post('/vehicles', data),
  update: (vehicleId: string, data: any) => apiClient.put(`/vehicles/${vehicleId}`, data),
  remove: (vehicleId: string) => apiClient.delete(`/vehicles/${vehicleId}`),
}

export const cctvService = {
  getCameras: (buildingId: string, floorId: string) =>
    apiClient.get('/staff/cctv/cameras', {
      params: { buildingId, floorId },
    }),
  getStreamUrl: (cameraId: string) => apiClient.get(`/staff/cctv/cameras/${cameraId}/stream`),
  getSnapshot: (cameraId: string) => apiClient.get(`/staff/cctv/cameras/${cameraId}/snapshot`),
  getMediaUrl: (mediaPath: string) => {
    const url = new URL(mediaPath, API_ORIGIN)
    const token = localStorage.getItem('token')
    if (token) url.searchParams.set('token', token)
    return url.toString()
  },
}

export const chatService = {
  getTickets: () => apiClient.get<{ tickets: ChatTicket[] }>('/support/tickets'),
  getTicket: (ticketId: string) =>
    apiClient.get<{ ticket: ChatTicket }>(`/support/tickets/${ticketId}`),
  createTicket: (data: NewSupportTicket) =>
    apiClient.post<{ ticket: ChatTicket }>('/support/tickets', data),
  sendMessage: (ticketId: string, message: string) =>
    apiClient.post<{ ticket: ChatTicket }>(`/support/tickets/${ticketId}/messages`, { message }),
  claimTicket: (ticketId: string) =>
    apiClient.post<{ ticket: ChatTicket }>(`/support/tickets/${ticketId}/claim`),
  updateTicketStatus: (ticketId: string, status: 'open' | 'done') =>
    apiClient.patch<{ ticket: ChatTicket }>(`/support/tickets/${ticketId}/status`, { status }),
  markRead: (ticketId: string, messageId: string) =>
    apiClient.post(`/support/tickets/${ticketId}/read`, { messageId }),
}

export const historyService = {
  getHistory: (dateRange?: { start: Date; end: Date }) =>
    apiClient.get('/staff/history', { params: { dateRange } }),
}

export const staffService = {
  getProfile: () => apiClient.get('/staff/profile'),
  getAssignedArea: () => apiClient.get('/staff/profile/assigned-area'),
  updateProfile: (data: any) => apiClient.put('/staff/profile', data),
}

const createResourceService = (resource: string) => ({
  list: () => apiClient.get(`/${resource}`),
  get: (id: string) => apiClient.get(`/${resource}/${id}`),
  create: (data: any) => apiClient.post(`/${resource}`, data),
  update: (id: string, data: any) => apiClient.put(`/${resource}/${id}`, data),
  remove: (id: string) => apiClient.delete(`/${resource}/${id}`),
  checkDuplicate: (params: Record<string, string | number>) =>
    apiClient.get(`/${resource}/check-duplicate`, { params }),
})

export const databaseService = {
  users: createResourceService('users'),
  vehicles: createResourceService('vehicles'),
  parkingZones: createResourceService('parking-zones'),
  history: createResourceService('history'),
  parkingLogs: createResourceService('parking-logs'),
  cctv: createResourceService('cctv'),
  parkingSlots: createResourceService('parking-slots'),
  cctvinfo2: createResourceService('cctvinfo2'),
  oldcctvinfo4: createResourceService('oldcctvinfo4'),
}

export default apiClient
