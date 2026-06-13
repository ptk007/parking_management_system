<template>
  <div class="ml-40">
    <!-- Tab Navigation -->
    <div class="bg-white border-b border-gray-200 px-6">
      <div class="flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'py-4 px-1 border-b-2 font-medium text-sm transition',
            activeTab === tab
              ? 'border-mfu-red text-mfu-red'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300',
          ]"
        >
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </div>
    </div>

    <!-- Filters & Stats -->
    <div class="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <!-- Building Filter -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">Building *</label>
          <select
            v-model="dashboardStore.buildingFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red"
          >
            <option value="E4">E4</option>
            <option value="E5">E5</option>
          </select>
        </div>

        <!-- Floor Filter -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">Floor *</label>
          <select
            v-model="dashboardStore.floorFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red"
          >
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>

        <!-- Vehicle Filter -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">Vehicle *</label>
          <select
            v-model="dashboardStore.vehicleFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red"
          >
            <option value="cars">Cars</option>
            <option value="motorcycles">Motorcycles</option>
          </select>
        </div>
      </div>

      <!-- Statistics -->
      <div class="flex items-center space-x-4">
        <div class="text-center">
          <p class="text-xs text-gray-600">Total Slots</p>
          <p class="text-2xl font-bold text-blue-500">{{ dashboardStore.stats.totalSlots }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Available</p>
          <p class="text-2xl font-bold text-parking-green">{{ dashboardStore.stats.available }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Incoming</p>
          <p class="text-2xl font-bold text-parking-yellow">{{ dashboardStore.stats.incoming }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Occupied</p>
          <p class="text-2xl font-bold text-red-600">{{ dashboardStore.stats.occupied }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Disabled</p>
          <p class="text-2xl font-bold text-parking-gray">{{ dashboardStore.stats.disabled }}</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="p-6">
      <!-- Slots Tab -->
      <div v-if="activeTab === 'slots'" class="space-y-6">
        <div class="bg-white rounded-lg shadow">
          <!-- Parking Map Placeholder -->
          <div class="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
            <div class="text-center">
              <i class="pi pi-map text-4xl text-gray-400 mb-4"></i>
              <p class="text-gray-600">Parking Floor Map (Floor {{ dashboardStore.floorFilter }})</p>
              <p class="text-xs text-gray-500 mt-2">Upload parking floor image</p>
            </div>
          </div>

          <!-- Slot Selection Controls -->
          <div class="p-4 border-t border-gray-200 flex items-center justify-between">
            <div class="text-sm text-gray-600">
              Selecting: <span class="font-semibold text-mfu-red">{{ dashboardStore.selectedSlotsCount }}</span>
            </div>
            <div class="flex space-x-2">
              <button
                @click="handleEditSlots"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition"
              >
                Edit
              </button>
              <button
                @click="handleEnableSlots"
                class="px-4 py-2 bg-parking-green hover:bg-green-600 text-white rounded-lg text-sm transition"
              >
                Enable
              </button>
              <button
                @click="handleDisableSlots"
                class="px-4 py-2 bg-mfu-red hover:bg-red-700 text-white rounded-lg text-sm transition"
              >
                Disable
              </button>
            </div>
          </div>
        </div>

        <!-- Slots Grid -->
        <div class="grid grid-cols-4 gap-4">
          <div
            v-for="slot in dashboardStore.slots"
            :key="slot._id"
            @click="dashboardStore.toggleSlotSelection(slot._id)"
            :class="[
              'p-4 rounded-lg border-2 cursor-pointer transition text-center font-semibold text-sm',
              dashboardStore.selectedSlots.has(slot._id)
                ? 'border-blue-500 bg-blue-50'
                : slot.status === 'available'
                  ? 'border-parking-green bg-green-50 text-parking-green'
                  : slot.status === 'occupied'
                    ? 'border-red-600 bg-red-50 text-red-600'
                    : 'border-parking-gray bg-gray-50 text-parking-gray',
            ]"
          >
            <div>{{ slot.slotNumber }}</div>
            <div class="text-xs mt-1">{{ slot.status }}</div>
          </div>
        </div>
      </div>

      <!-- CCTV Tab -->
      <div v-if="activeTab === 'cctv'" class="grid grid-cols-2 gap-6">
        <div
          v-for="camera in dashboardStore.cameras"
          :key="camera._id"
          class="bg-white rounded-lg shadow overflow-hidden"
        >
          <!-- Camera Header -->
          <div class="bg-gray-900 px-4 py-3 flex items-center justify-between">
            <span class="text-white font-semibold text-sm">{{ camera.name }}</span>
            <div class="flex items-center space-x-2">
              <span :class="['w-2 h-2 rounded-full', camera.status === 'online' ? 'bg-red-500' : 'bg-gray-500']"></span>
              <span class="text-xs text-white">{{ camera.status === 'online' ? '🔴 Live' : 'Offline' }}</span>
            </div>
          </div>

          <!-- Camera Feed -->
          <div class="w-full aspect-video bg-black flex items-center justify-center">
            <div class="text-center">
              <i class="pi pi-video text-4xl text-gray-600 mb-2"></i>
              <p class="text-gray-500 text-sm">{{ camera.name }}</p>
              <p class="text-xs text-gray-600 mt-1">{{ camera.status }}</p>
            </div>
          </div>

          <!-- Camera Info -->
          <div class="p-3 bg-gray-50 border-t border-gray-200 text-xs">
            <p class="text-gray-600">
              <span class="font-medium">IP:</span> {{ camera.ipAddress }}
            </p>
            <p class="text-gray-600 mt-1">
              <span class="font-medium">Updated:</span> {{ formatDate(camera.lastUpdate) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Log Tab -->
      <div v-if="activeTab === 'log'" class="space-y-4">
        <!-- Warning Banner -->
        <div class="bg-yellow-50 border-2 border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          <i class="pi pi-info-circle mr-2"></i>
          Exited car log will reset after 24 hours
        </div>

        <!-- Parking Logs -->
        <div v-if="dashboardStore.logs.length === 0" class="bg-white rounded-lg p-8 text-center">
          <i class="pi pi-inbox text-4xl text-gray-300 mb-3"></i>
          <p class="text-gray-600">No parking records found</p>
        </div>

        <div v-for="log in dashboardStore.logs" :key="log._id" class="bg-white rounded-lg shadow p-6 flex items-center justify-between">
          <!-- Vehicle Icon -->
          <div class="mr-4">
            <i class="pi pi-car text-3xl text-mfu-red"></i>
          </div>

          <!-- Vehicle Info -->
          <div class="flex-1">
            <p class="font-semibold text-gray-900">{{ log.ownerName }}</p>
            <p class="text-sm text-gray-600">License: {{ log.licenseNumber }} | {{ log.province }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ log.vehicleDescription }}</p>
          </div>

          <!-- Time Info -->
          <div class="text-center px-6">
            <p class="text-sm font-medium text-gray-900">{{ formatDate(log.entryTime) }}</p>
            <p class="text-xs text-gray-600">{{ formatTime(log.entryTime) }}</p>
            <p class="text-xs text-gray-500 mt-2">Slot: {{ log.parkingSlot }}</p>
            <p
              :class="[
                'text-xs font-semibold mt-1 px-2 py-1 rounded',
                log.parkingStatus === 'parking'
                  ? 'bg-orange-100 text-parking-orange'
                  : log.parkingStatus === 'exited'
                    ? 'bg-red-100 text-mfu-red'
                    : 'bg-gray-100 text-parking-gray',
              ]"
            >
              {{ log.parkingStatus }}
            </p>
          </div>

          <!-- Face Recognition -->
          <div class="px-6 text-center">
            <p class="text-xs font-medium text-gray-700 mb-2">Face Driver</p>
            <div class="flex space-x-2">
              <div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <i class="pi pi-user text-gray-400"></i>
              </div>
              <div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <i class="pi pi-user text-gray-400"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboardStore = useDashboardStore()
const activeTab = ref<'slots' | 'cctv' | 'log'>('slots')
const tabs: ('slots' | 'cctv' | 'log')[] = ['slots', 'cctv', 'log']

const formatDate = (date: any) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

const formatTime = (date: any) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const handleEditSlots = () => {
  console.log('Edit slots:', Array.from(dashboardStore.selectedSlots))
}

const handleEnableSlots = async () => {
  for (const slotId of dashboardStore.selectedSlots) {
    await dashboardStore.updateSlotStatus(slotId, 'available')
  }
  dashboardStore.clearSlotSelection()
}

const handleDisableSlots = async () => {
  const restrictedSlots: string[] = []
  
  for (const slotId of dashboardStore.selectedSlots) {
    const slot = dashboardStore.slots.find(s => s._id === slotId)
    if (slot?.status === 'incoming' || slot?.status === 'occupied') {
      restrictedSlots.push(`${slot.slotNumber} (${slot.status})`)
    } else {
      await dashboardStore.updateSlotStatus(slotId, 'disabled')
    }
  }
  
  if (restrictedSlots.length > 0) {
    alert(`Cannot disable slots with active vehicles: ${restrictedSlots.join(', ')}`)
  }
  
  dashboardStore.clearSlotSelection()
}

onMounted(async () => {
  await dashboardStore.loadStats()
  await dashboardStore.loadSlots()
  await dashboardStore.loadCameras()
  await dashboardStore.loadLogs()
})
</script>

<style scoped></style>
