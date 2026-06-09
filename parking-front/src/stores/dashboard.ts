import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DashboardStats, ParkingSlot, ParkingLog, CCTVCamera } from '@/types'
import { dashboardService, parkingService, cctvService } from '@/services/api'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<DashboardStats>({
    totalSlots: 0,
    available: 0,
    incoming: 0,
    occupied: 0,
    disabled: 0,
  })

  const slots = ref<ParkingSlot[]>([])
  const logs = ref<ParkingLog[]>([])
  const cameras = ref<CCTVCamera[]>([])
  const selectedSlots = ref<Set<string>>(new Set())
  const isLoading = ref(false)
  const error = ref<string>('')

  const buildingFilter = ref<string>('E4')
  const floorFilter = ref<string>('4')
  const vehicleFilter = ref<string>('cars')

  const selectedSlotsCount = computed(() => selectedSlots.value.size)

  const loadStats = async () => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await dashboardService.getStats(buildingFilter.value, floorFilter.value, vehicleFilter.value)
      stats.value = response.data
    } catch (err: any) {
      error.value = err.message || 'Failed to load stats'
    } finally {
      isLoading.value = false
    }
  }

  const loadSlots = async () => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await parkingService.getSlots(buildingFilter.value, floorFilter.value)
      slots.value = response.data
    } catch (err: any) {
      error.value = err.message || 'Failed to load slots'
    } finally {
      isLoading.value = false
    }
  }

  const loadLogs = async () => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await parkingService.getLogs(buildingFilter.value, floorFilter.value, vehicleFilter.value)
      logs.value = response.data
    } catch (err: any) {
      error.value = err.message || 'Failed to load logs'
    } finally {
      isLoading.value = false
    }
  }

  const loadCameras = async () => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await cctvService.getCameras(buildingFilter.value, floorFilter.value)
      cameras.value = response.data
    } catch (err: any) {
      error.value = err.message || 'Failed to load cameras'
    } finally {
      isLoading.value = false
    }
  }

  const toggleSlotSelection = (slotId: string) => {
    if (selectedSlots.value.has(slotId)) {
      selectedSlots.value.delete(slotId)
    } else {
      selectedSlots.value.add(slotId)
    }
  }

  const clearSlotSelection = () => {
    selectedSlots.value.clear()
  }

  const updateSlotStatus = async (slotId: string, status: string) => {
    try {
      await parkingService.updateSlot(slotId, status)
      await loadSlots()
      return true
    } catch (err) {
      error.value = 'Failed to update slot'
      return false
    }
  }

  const setFilters = (building: string, floor: string, vehicle: string) => {
    buildingFilter.value = building
    floorFilter.value = floor
    vehicleFilter.value = vehicle
  }

  return {
    stats,
    slots,
    logs,
    cameras,
    selectedSlots,
    isLoading,
    error,
    buildingFilter,
    floorFilter,
    vehicleFilter,
    selectedSlotsCount,
    loadStats,
    loadSlots,
    loadLogs,
    loadCameras,
    toggleSlotSelection,
    clearSlotSelection,
    updateSlotStatus,
    setFilters,
  }
})
