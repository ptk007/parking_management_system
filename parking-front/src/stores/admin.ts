import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface StaffMember {
  _id: string
  staffName: string
  username: string
  password: string
  dateAdded: string
  timeAdded: string
  status: 'Online' | 'Offline' | 'Disable' | 'Logging in'
}

export interface Building {
  _id: string
  buildingName: string
  floors: number
  lastDateAdded: string
  lastTimeAdded: string
  image?: string
}

export interface Camera {
  _id: string
  cameraName: string
  ipAddress: string
  building: string
  floor: string
  status: 'Online' | 'Offline'
  lastUpdate: string
}

export interface Floor {
  _id: string
  building: string
  floorNumber: number
  vehicleType: string
  status: 'Available' | 'Disable'
  slotsCount: number
}

export const useAdminStore = defineStore('admin', () => {
  // Dashboard filters
  const buildingFilter = ref('E4')
  const floorFilter = ref('4')
  const vehicleFilter = ref('Cars')
  const activeTab = ref('slots')

  // Staff Management
  const staffList = ref<StaffMember[]>([
    {
      _id: '1',
      staffName: 'Thanathip Pitaksin',
      username: 'Thanathip',
      password: 'password123',
      dateAdded: '11/3/2569',
      timeAdded: '14:00:00',
      status: 'Online',
    },
    {
      _id: '2',
      staffName: 'Atithan Sarapol',
      username: 'Atithan',
      password: 'password123',
      dateAdded: '18/3/2569',
      timeAdded: '12:00:00',
      status: 'Offline',
    },
    {
      _id: '3',
      staffName: 'Panuwat Panan',
      username: 'Atithan',
      password: 'password123',
      dateAdded: '19/3/2569',
      timeAdded: '12:00:00',
      status: 'Disable',
    },
  ])

  // Buildings
  const buildings = ref<Building[]>([
    {
      _id: '1',
      buildingName: 'E4',
      floors: 4,
      lastDateAdded: '19/3/2569',
      lastTimeAdded: '12:00:00',
      image: 'building1.jpg',
    },
  ])

  // Floors
  const floors = ref<Floor[]>([
    {
      _id: '1',
      building: 'E4',
      floorNumber: 4,
      vehicleType: 'Cars',
      status: 'Available',
      slotsCount: 124,
    },
    {
      _id: '2',
      building: 'E4',
      floorNumber: 4,
      vehicleType: 'Motorcycle',
      status: 'Available',
      slotsCount: 50,
    },
    {
      _id: '3',
      building: 'E4',
      floorNumber: 3,
      vehicleType: 'Cars',
      status: 'Disable',
      slotsCount: 120,
    },
  ])

  // Cameras
  const cameras = ref<Camera[]>([
    {
      _id: '1',
      cameraName: 'Floor4 B6',
      ipAddress: '172.28.113.103',
      building: 'E4',
      floor: '4',
      status: 'Online',
      lastUpdate: '17/03/2569 17:03:23',
    },
  ])

  // Dashboard Statistics
  const stats = ref({
    totalSlots: 124,
    available: 47,
    incoming: 6,
    occupied: 74,
    disabled: 3,
    activeStaff: 6,
  })

  // Parking Slots
  const slots = ref<any[]>([
    { _id: '1', slotNumber: '1', status: 'available' },
    { _id: '2', slotNumber: '2', status: 'available' },
    { _id: '3', slotNumber: '3', status: 'available' },
    { _id: '4', slotNumber: '4', status: 'occupied' },
    { _id: '5', slotNumber: '5', status: 'occupied' },
    { _id: '6', slotNumber: '6', status: 'occupied' },
  ])

  const selectedSlots = ref<Set<string>>(new Set())
  const selectedSlotsCount = computed(() => selectedSlots.value.size)

  // Actions
  const toggleSlotSelection = (slotId: string) => {
    if (selectedSlots.value.has(slotId)) {
      selectedSlots.value.delete(slotId)
    } else {
      selectedSlots.value.add(slotId)
    }
  }

  const addStaff = (staff: StaffMember) => {
    staffList.value.push(staff)
  }

  const updateStaff = (staffId: string, updatedStaff: Partial<StaffMember>) => {
    const index = staffList.value.findIndex((s) => s._id === staffId)
    if (index !== -1) {
      const currentStaff = staffList.value[index] as StaffMember
      staffList.value[index] = { ...currentStaff, ...updatedStaff }
    }
  }

  const deleteStaff = (staffId: string) => {
    staffList.value = staffList.value.filter((s) => s._id !== staffId)
  }

  const addBuilding = (building: Building) => {
    buildings.value.push(building)
  }

  const addFloor = (floor: Floor) => {
    floors.value.push(floor)
  }

  const addCamera = (camera: Camera) => {
    cameras.value.push(camera)
  }

  const updateCamera = (cameraId: string, updatedCamera: Partial<Camera>) => {
    const index = cameras.value.findIndex((c) => c._id === cameraId)
    if (index !== -1) {
      const currentCamera = cameras.value[index] as Camera
      cameras.value[index] = { ...currentCamera, ...updatedCamera }
    }
  }

  return {
    // Filters
    buildingFilter,
    floorFilter,
    vehicleFilter,
    activeTab,

    // State
    staffList,
    buildings,
    floors,
    cameras,
    stats,
    slots,
    selectedSlots,
    selectedSlotsCount,

    // Actions
    toggleSlotSelection,
    addStaff,
    updateStaff,
    deleteStaff,
    addBuilding,
    addFloor,
    addCamera,
    updateCamera,
  }
})
