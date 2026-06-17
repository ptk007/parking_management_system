import axios from 'axios'
import type { AxiosInstance } from 'axios'

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
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

export const cctvService = {
  getCameras: (buildingId: string, floorId: string) =>
    apiClient.get('/staff/cctv/cameras', {
      params: { buildingId, floorId },
    }),
  getStreamUrl: (cameraId: string) => apiClient.get(`/staff/cctv/cameras/${cameraId}/stream`),
  getSnapshot: (cameraId: string) => apiClient.get(`/staff/cctv/cameras/${cameraId}/snapshot`),
}

export const chatService = {
  getTickets: () => apiClient.get('/staff/chat/tickets'),
  getTicket: (ticketId: string) => apiClient.get(`/staff/chat/tickets/${ticketId}`),
  createTicket: (subject: string, message: string) =>
    apiClient.post('/staff/chat/tickets', { subject, message }),
  sendMessage: (ticketId: string, message: string) =>
    apiClient.post(`/staff/chat/messages/${ticketId}`, { message }),
  updateTicketStatus: (ticketId: string, status: string) =>
    apiClient.put(`/staff/chat/tickets/${ticketId}`, { status }),
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
}

export default apiClient
