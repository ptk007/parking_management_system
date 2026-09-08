export type UserRole = 'staff' | 'admin' | 'user'
export type UserStatus = 'online' | 'offline' | 'disable'

export interface ApiUser {
  _id: string
  username: string
  name: string
  role: UserRole
  status: UserStatus
  date_add?: string
  time_add?: string
  user_image?: string | null
}

export interface User extends ApiUser {
  id: string
  fullName: string
  buildingId?: string
  floorId?: string
  avatar?: string
}

export interface AuthResponse {
  token: string
  user: ApiUser
}

export interface ParkingSlot {
  _id: string
  slotNumber: string
  floorId: string
  vehicleType: string
  status: 'available' | 'incoming' | 'occupied' | 'disabled'
  currentVehicle?: string
  lastUpdated: Date
}

export interface ParkingLog {
  _id: string
  ownerName: string
  licenseNumber: string
  province: string
  vehicleDescription: string
  entryTime: Date
  exitTime?: Date
  parkingSlot: string
  parkingStatus: 'parking' | 'exited' | 'notParking'
  faceRecognition: {
    entryPhoto?: string
    exitPhoto?: string
  }
}

export interface CCTVCamera {
  _id: string
  name: string
  ipAddress: string
  buildingId: string
  floorId: string
  status: 'online' | 'offline'
  streamUrl: string
  streamProtocol?: string
  snapshotUrl?: string
  mjpegUrl?: string
  lastUpdate: Date | string | null
}

export interface DashboardStats {
  totalSlots: number
  available: number
  incoming: number
  occupied: number
  disabled: number
}

export type TicketStatus = 'open' | 'in_progress' | 'done'
export type TicketCategory = 'parking' | 'vehicle' | 'account' | 'other'

export interface ChatParticipant {
  _id: string
  name: string
}

export interface NewSupportTicket {
  subject: string
  category: TicketCategory
  location: string
  message: string
}

export interface ChatTicket {
  _id: string
  ticketNumber: string
  subject: string
  category: TicketCategory
  location: string
  status: TicketStatus
  owner: ChatParticipant
  assignedSupport: ChatParticipant | null
  messages?: ChatMessage[]
  lastMessage: ChatMessage | null
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  _id: string
  sender: string
  senderName: string
  senderType: 'user' | 'support'
  message: string
  timestamp: string
}

export interface HistoryEntry {
  _id: string
  staffName: string
  building: string
  floor: string
  parkingSlots: string[]
  dateEdited: Date
  timeEdited: string
  statusChangedTo: 'enable' | 'disable'
}
