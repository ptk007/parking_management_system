import axios from 'axios'
import type { AxiosInstance } from 'axios'
import type { ApiUser, ChatTicket, NewSupportTicket, RegistrationInput, UserStatus } from '@/types'

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
  register: (data: RegistrationInput) => apiClient.post('/auth/register', data),
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  logout: () => apiClient.post('/auth/logout'),
  verifyToken: () => apiClient.get('/auth/verify'),
}

export interface StaffUserInput {
  username: string
  name: string
  password?: string
  user_image?: File | null
}

function staffUserFormData(data: StaffUserInput, includeRole: boolean) {
  const form = new FormData()
  form.append('username', data.username)
  form.append('name', data.name)
  if (data.password) form.append('password', data.password)
  if (includeRole) form.append('role', 'staff')
  if (data.user_image) form.append('user_image', data.user_image)
  return form
}

export const userService = {
  listStaff: () => apiClient.get<{ success: boolean; count: number; users: ApiUser[] }>('/users'),
  createStaff: (data: StaffUserInput) =>
    apiClient.post<{ success: boolean; user: ApiUser }>('/users', staffUserFormData(data, true), {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateStaff: (id: string, data: StaffUserInput) =>
    apiClient.put<{ success: boolean; user: ApiUser }>(
      `/users/${id}`,
      staffUserFormData(data, false),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
  setStaffStatus: (id: string, status: Extract<UserStatus, 'offline' | 'disable'>) =>
    apiClient.patch<{ success: boolean; user: ApiUser }>(`/users/${id}/status`, { status }),
  remove: (id: string) => apiClient.delete<{ success: boolean; message: string }>(`/users/${id}`),
  imageUrl: (imagePath: string | null | undefined) =>
    imagePath ? new URL(imagePath.replace(/^\/+/, ''), `${API_ORIGIN}/`).toString() : '',
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

export interface ParkingLogRecord {
    _id: string
    owner: string | null
    name: string
    building: string
    buildingId: string
    floor: number
    floorId: string
    veh_type: 'car' | 'motorcycle'
    cameraPresetId: string
    parkingSlotName: string | null
    brand: string
    model: string
    color: string
    license_num: string
    province: string
    date_enter: string
    park_time: string
    date_exit: string | null
    exit_time: string | null
    park_slot: number | null
    park_status: 'Parking' | 'Exited' | 'Not parking'
    slotDisabled: boolean
    createdAt: string
    updatedAt: string
}

export const parkingLogService = {
    list: (filters?: { buildingId?: string; floorId?: string; veh_type?: 'car' | 'motorcycle' }) =>
      apiClient.get<{ logs: ParkingLogRecord[] }>('/parking-logs', { params: filters }),
    export: (filters: { buildingId: string; floorId: string; veh_type: 'car' | 'motorcycle' }) =>
      apiClient.get<Blob>('/parking-logs/export', {
        params: filters,
        responseType: 'blob',
      }),
    exportSamples: (logs: Record<string, unknown>[]) =>
      apiClient.post<Blob>('/parking-logs/export-sample', { logs }, { responseType: 'blob' }),
    myHistory: () => apiClient.get<{ logs: ParkingLogRecord[] }>('/parking-logs/me'),
}

export const vehicleService = {
  getByUser: (userId: string) => apiClient.get(`/vehicles/user/${userId}`),
  create: (data: any) => apiClient.post('/vehicles', data),
  update: (vehicleId: string, data: any) => apiClient.put(`/vehicles/${vehicleId}`, data),
  remove: (vehicleId: string) => apiClient.delete(`/vehicles/${vehicleId}`),
}

export interface BuildingCameraSummary {
  total: number
  online: number
  offline: number
  disabled: number
  unknown: number
}

export interface CameraSummaryResponse {
  summaries: Record<string, BuildingCameraSummary>
  floorSummaries: Record<string, BuildingCameraSummary>
}

export interface DashboardCameraPreset {
  _id: string
  floorId: string
  floor: number
  veh_type: 'car' | 'motorcycle'
  buildingId: string
  name: string
  cctvFileName?: string
  cameraSelector?: string
  cameraNo?: string
  ipAddress?: string
  sourceCameraName?: string
  rtspLink?: string
  status: 'Enable' | 'Disable'
  sourceStatus: 'Online' | 'Offline' | 'Unknown'
  modelEnabled: boolean
  modelRuntimeStatus: 'Offline' | 'Starting' | 'Online' | 'Stopping' | 'Error'
  modelRuntimeMessage: string
  modelRuntimeUpdatedAt: string | null
  modelRuntimeId: string
  slotStatusRefreshVersion: number
  parkingSlotFileId?: string
  parkingSlotData?: unknown
  createAt?: string
  updateAt?: string
}

export interface ParkingBuilding {
  _id: string
  building_name: string
  building_image: string | null
  date_updated: string
  time_updated: string
}

export const buildingService = {
  cameraSummaries: () =>
    apiClient.get<CameraSummaryResponse>(
      '/admin/system/buildings/camera-summary',
    ),
  list: () => apiClient.get<{ buildings: ParkingBuilding[] }>('/admin/system/buildings'),
  create: (data: FormData) =>
    apiClient.post<{ building: ParkingBuilding }>('/admin/system/buildings', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: FormData) =>
    apiClient.patch<{ building: ParkingBuilding }>(`/admin/system/buildings/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  remove: (id: string) => apiClient.delete(`/admin/system/buildings/${id}`),
  imageUrl: (path: string | null) =>
    path ? new URL(path.replace(/^\/+/, ''), `${API_ORIGIN}/`).toString() : '',
}

export interface ParkingSlotFile {
  _id: string
  original_name: string
  path: string
  size: number
  fileType?: 'cctv' | 'parking-slot'
  available?: boolean
}

export interface ParkingMapPreset {
  _id: string
  name: string
  slotNames?: string[]
  status?: 'Enable' | 'Disable'
  modelEnabled?: boolean
}

export interface CctvSourceSearchResult {
  matches: import('@/views/admin/cctvForm').CctvSourceMatch[]
  camera?: import('@/views/admin/cctvForm').CctvSourceMatch
  status: import('@/views/admin/cctvForm').CctvConnectionStatus
  message: string
  frameData?: string
}

export interface ParkingFloor {
  _id: string
  building: ParkingBuilding | null
  floor: number
  veh_type: 'car' | 'motorcycle'
  parking_slot_file: string | null
  mapPresets?: ParkingMapPreset[]
  parking_map?: {
    version: number
    sourceName: string
    slots: import('@/components/parking/parkingMapPreview').PreviewSlot[]
    layout: import('@/components/parking/parkingLayout').ParkingLayout
  } | null
  camera_presets?: import('@/views/admin/cctvForm').CctvFormCamera[]
  status: 'Available' | 'Disable'
  date_updated: string
  time_updated: string
}

export type ParkingFloorPayload = Pick<ParkingFloor, 'floor' | 'veh_type' | 'status'> & {
  building: string
}

export interface ParkingSlotStatusLog {
  _id: string
  name: string
  role: 'staff' | 'admin'
  building: string
  floor: number
  veh_type: 'car' | 'motorcycle'
  slots: { zone: string; number: number; name: string }[]
  date_updated: string
  time_updated: string
  status: 'available' | 'disabled'
}

export const floorService = {
  updateOccupiedSlotVehicleDetails: (
    id: string,
    key: string,
    license_num: string,
    province: string,
  ) =>
    apiClient.patch<{
      success: boolean
      map: NonNullable<ParkingFloor['parking_map']>
      log: ParkingLogRecord | null
      activeLogFound: boolean
      activeLogUpdated: boolean
      removedHistoryCount: number
    }>(
      `/admin/system/floors/catalog/${id}/slot-vehicle-details`,
      { key, license_num, province },
    ),
  slotStatusLogs: (roles: ('staff' | 'admin')[]) =>
    apiClient.get<{ logs: ParkingSlotStatusLog[] }>('/admin/system/floors/slot-status-logs', {
      params: { roles: roles.join(',') },
    }),
  setSlotStatuses: (id: string, keys: string[], status: 'available' | 'disabled') =>
    apiClient.patch<{ map: NonNullable<ParkingFloor['parking_map']>; changedSlots: number }>(
      `/admin/system/floors/catalog/${id}/slot-statuses`,
      { keys, status },
    ),
  catalog: () => apiClient.get<{ floors: ParkingFloor[] }>('/admin/system/floors/catalog'),
  get: (id: string) => apiClient.get<{ floor: ParkingFloor }>(`/admin/system/floors/${id}`),
  setCameraModelEnabled: (floorId: string, cameraId: string, enabled: boolean) =>
    apiClient.patch<{ floor: ParkingFloor }>(
      `/admin/system/floors/${floorId}/cameras/${cameraId}/model`,
      { enabled },
    ),
  setCameraPresetStatus: (floorId: string, cameraId: string, status: 'Enable' | 'Disable') =>
    apiClient.patch<{ floor: ParkingFloor }>(
      `/admin/system/floors/${floorId}/cameras/${cameraId}/status`,
      { status },
    ),
  resetSlotStatuses: (id: string) =>
    apiClient.post<{ map: NonNullable<ParkingFloor['parking_map']> }>(
      `/admin/system/floors/catalog/${id}/reset-slot-statuses`,
    ),
  refreshModelSlotStatuses: (id: string) =>
    apiClient.post<{ success: boolean; message: string; requestedSlots: number }>(
      `/admin/system/floors/catalog/${id}/update-slot-statuses`,
    ),
  getCameraModelFrame: (
    floorId: string,
    cameraId: string,
    signal?: AbortSignal,
  ) =>
    apiClient.get<Blob>(
      `/admin/system/floors/${floorId}/cameras/${cameraId}/model-preview`,
      { responseType: 'blob', signal },
    ),
  saveMap: (id: string, map: unknown) => apiClient.put(`/admin/system/floors/${id}/map`, map),
  saveCamera: (
    id: string,
    camera: import('@/views/admin/cctvForm').CctvFormCamera,
    file?: File | null,
  ) => {
    const url = camera._id
      ? `/admin/system/floors/${id}/cameras/${camera._id}`
      : `/admin/system/floors/${id}/cameras`
    if (file) {
      const data = new FormData()
      Object.entries(camera).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'parkingSlotData') {
          data.append(key, String(value))
        }
      })
      data.append('parking_slot_file', file)
      return camera._id
        ? apiClient.patch<{ floor: ParkingFloor }>(url, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        : apiClient.post<{ floor: ParkingFloor }>(url, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
    }
    return camera._id
      ? apiClient.patch<{ floor: ParkingFloor }>(url, camera)
      : apiClient.post<{ floor: ParkingFloor }>(url, camera)
  },
  removeCamera: (floorId: string, cameraId: string) =>
    apiClient.delete<{ success: boolean; floor: ParkingFloor }>(
      `/admin/system/floors/${floorId}/cameras/${cameraId}`,
    ),
  sourceFiles: () =>
    apiClient.get<{ files: ParkingSlotFile[] }>('/admin/system/floors/source-files'),
  searchCctvSource: (fileId: string, query: string) =>
    apiClient.post<CctvSourceSearchResult>(
      `/admin/system/floors/source-files/${fileId}/cameras/search`,
      { query },
    ),
  streamCctvPreview: (
    fileId: string,
    recordIndex: number,
    parkingSlotData: unknown,
    signal: AbortSignal,
  ) => {
    const token = localStorage.getItem('token')
    return fetch(
      `${API_BASE_URL.replace(/\/+$/, '')}/admin/system/floors/source-files/${fileId}/cameras/${recordIndex}/preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ parkingSlotData }),
        signal,
      },
    )
  },
  probeCctvSource: (fileId: string, recordIndex: number) =>
    apiClient.post<
      import('@/views/admin/cctvForm').CctvConnectionCheck & {
        camera: import('@/views/admin/cctvForm').CctvSourceMatch
      }
    >(`/admin/system/floors/source-files/${fileId}/cameras/${recordIndex}/probe`),
  importSourceFiles: (files: File[]) => {
    const data = new FormData()
    files.forEach((file) => data.append('files', file))
    return apiClient.post('/admin/system/floors/source-files', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadSourceFile: (file: ParkingSlotFile) =>
    apiClient.get<string>(`/admin/system/floors/source-files/${file._id}`, {
      responseType: 'text',
    }),
  list: () => apiClient.get<{ floors: ParkingFloor[] }>('/admin/system/floors'),
  create: (data: ParkingFloorPayload) =>
    apiClient.post<{ floor: ParkingFloor }>('/admin/system/floors', data),
  update: (id: string, data: ParkingFloorPayload) =>
    apiClient.patch<{ floor: ParkingFloor }>(`/admin/system/floors/${id}`, data),
  remove: (id: string) => apiClient.delete(`/admin/system/floors/${id}`),
}

export const cctvService = {
  getDashboardPresets: (buildingName: string, floor: number, vehicleType: 'car' | 'motorcycle') =>
    apiClient.get<{ cameras: DashboardCameraPreset[] }>('/admin/system/floors/catalog/cameras', {
      params: { buildingName, floor, veh_type: vehicleType },
    }),
  getDashboardModelFrame: (floorId: string, cameraId: string, signal?: AbortSignal) =>
    apiClient.get<Blob>(
      `/admin/system/floors/catalog/${floorId}/cameras/${cameraId}/model-preview`,
      { responseType: 'blob', signal },
    ),
  streamDashboardCameraPreview: (floorId: string, cameraId: string, signal: AbortSignal) => {
    const token = localStorage.getItem('token')
    return fetch(
      `${API_BASE_URL.replace(/\/+$/, '')}/admin/system/floors/catalog/${floorId}/cameras/${cameraId}/preview`,
      {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      },
    )
  },
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
