export interface User {
  id: string
  username: string
  fullName: string
  role: 'staff' | 'admin' | 'user'
  buildingId?: string
  floorId?: string
  status: 'online' | 'offline' | 'disabled'
  avatar?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface ParkingSlot {
  _id: string
  slotNumber: string
  floorId: string
  vehicleType: string
  status: 'available' | 'occupied' | 'disabled'
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
  lastUpdate: Date
}

export interface DashboardStats {
  totalSlots: number
  available: number
  incoming: number
  occupied: number
  disabled: number
}

export interface ChatTicket {
  _id: string
  ticketNumber: string
  subject: string
  status: 'open' | 'done'
  messages: ChatMessage[]
  createdAt: Date
  assignedSupport?: {
    id: string
    name: string
    avatar?: string
  }
}

export interface ChatMessage {
  _id: string
  sender: string
  senderType: 'staff' | 'support'
  message: string
  timestamp: Date
  attachments?: string[]
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
