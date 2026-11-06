export interface CctvFormCamera {
  _id?: string
  parkingSlotData?: unknown
  name: string
  cameraSelector: string
  cameraNo?: string
  ipAddress: string
  sourceCameraName?: string
  rtspLink: string
  cctvFileName: string
  parkingSlotFileId: string | null
  status?: 'Online' | 'Offline' | 'Disable' | 'Unknown'
}

export interface CctvSourceMatch {
  recordIndex: number
  cameraNo: string
  ipAddress: string
  sourceCameraName: string
  rtspLink: string
}

export type CctvConnectionStatus = 'Online' | 'Offline' | 'Unknown'

export interface CctvConnectionCheck {
  status: CctvConnectionStatus
  message: string
  frameData?: string
}
