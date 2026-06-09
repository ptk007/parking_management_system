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
            v-model="selectedBuilding"
            disabled
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red bg-gray-100 cursor-not-allowed"
          >
            <option value="E4">E4</option>
          </select>
        </div>

        <!-- Floor Filter -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">Floor *</label>
          <select
            v-model="selectedFloor"
            disabled
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red bg-gray-100 cursor-not-allowed"
          >
            <option value="4">4</option>
          </select>
        </div>

        <!-- Vehicle Filter -->
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">Vehicle *</label>
          <select
            v-model="selectedVehicle"
            class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mfu-red"
          >
            <option value="Cars">Cars</option>
            <option value="Motorcycles">Motorcycles</option>
          </select>
        </div>
      </div>

      <!-- Statistics -->
      <div class="flex items-center space-x-4">
        <div class="text-center">
          <p class="text-xs text-gray-600">Total Slots</p>
          <p class="text-2xl font-bold text-mfu-red">{{ stats.totalSlots }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Available</p>
          <p class="text-2xl font-bold text-parking-green">{{ stats.available }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Incoming</p>
          <p class="text-2xl font-bold text-parking-yellow">{{ stats.incoming }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Occupied</p>
          <p class="text-2xl font-bold text-parking-orange">{{ stats.occupied }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-600">Disable</p>
          <p class="text-2xl font-bold text-parking-gray">{{ stats.disable }}</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="p-6">
      <!-- Slots Tab -->
      <div v-if="activeTab === 'slots'" class="space-y-6">
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <!-- Parking Map -->
          <div class="p-6 bg-amber-100 rounded-lg">
            <h3 class="text-center font-bold text-2xl mb-4 text-gray-800">E4 Floor 4</h3>
            <svg
              :viewBox="`0 0 1300 700`"
              class="w-full border-2 border-gray-400 bg-amber-50 rounded-lg"
              style="max-height: 500px"
            >
              <!-- Parking Slots -->
              <g v-for="(slot, index) in parkingSlots" :key="index">
                <rect
                  :x="slot.x"
                  :y="slot.y"
                  width="25"
                  height="25"
                  :fill="getSlotColor(slot.slotNumber)"
                  stroke="#333"
                  stroke-width="1"
                  @click="toggleSlotSelection(slot.slotNumber)"
                  style="cursor: pointer"
                />
                <text
                  :x="slot.x + 12.5"
                  :y="slot.y + 17"
                  text-anchor="middle"
                  font-size="10"
                  font-weight="bold"
                  fill="#000"
                  pointer-events="none"
                >
                  {{ slot.slotNumber }}
                </text>
              </g>

              <!-- Labels -->
              <text x="200" y="100" font-size="20" font-weight="bold" fill="#666">out</text>
              <text x="200" y="160" font-size="20" font-weight="bold" fill="#666">in</text>
              <text x="200" y="550" font-size="20" font-weight="bold" fill="#666">up</text>
              <text x="400" y="610" font-size="20" font-weight="bold" fill="#666">down</text>

              <!-- Row Labels -->
              <text x="1250" y="110" font-size="16" font-weight="bold" fill="#666">A</text>
              <text x="1250" y="230" font-size="16" font-weight="bold" fill="#666">B</text>
              <text x="1250" y="350" font-size="16" font-weight="bold" fill="#666">C</text>
              <text x="1250" y="470" font-size="16" font-weight="bold" fill="#666">D</text>
              <text x="1250" y="610" font-size="16" font-weight="bold" fill="#666">E</text>
            </svg>
          </div>

          <!-- Slot Selection Controls -->
          <div class="p-4 border-t border-gray-200 flex items-center justify-between">
            <div class="text-sm text-gray-600">
              Selecting : <span class="font-semibold text-mfu-red">{{ selectedSlots.size }}</span>
            </div>
            <div class="flex space-x-2">
              <button
                @click="handleEditSlots"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition font-semibold"
              >
                Edit
              </button>
              <button
                @click="handleEnableSlots"
                class="px-4 py-2 bg-parking-green hover:bg-green-600 text-white rounded-lg text-sm transition font-semibold"
              >
                Enable
              </button>
              <button
                @click="handleDisableSlots"
                class="px-4 py-2 bg-mfu-red hover:bg-red-700 text-white rounded-lg text-sm transition font-semibold"
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- CCTV Tab -->
      <div v-if="activeTab === 'cctv'" class="grid grid-cols-2 gap-6">
        <div v-for="i in 4" :key="i" class="bg-white rounded-lg shadow overflow-hidden">
          <!-- Camera Header -->
          <div class="bg-gray-900 px-4 py-3 flex items-center justify-between">
            <span class="text-white font-semibold text-sm">Camera {{ i }}</span>
            <div class="flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              <span class="text-xs text-white">🔴 Live</span>
            </div>
          </div>

          <!-- Camera Feed -->
          <div class="w-full aspect-video bg-black flex items-center justify-center">
            <div class="text-center">
              <i class="pi pi-video text-4xl text-gray-600 mb-2"></i>
              <p class="text-gray-500 text-sm">Camera {{ i }}</p>
            </div>
          </div>

          <!-- Timestamp -->
          <div class="p-2 bg-gray-800 text-white text-xs">
            {{ new Date().toLocaleString() }}
          </div>
        </div>
      </div>

      <!-- Log Tab -->
      <div v-if="activeTab === 'log'" class="space-y-4">
        <!-- Warning Banner -->
        <div class="bg-yellow-50 border-2 border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm font-medium">
          Exited car log will reset after 24 hours
        </div>

        <!-- Parking Logs -->
        <div
          v-for="log in parkingLogs"
          :key="log.id"
          class="bg-white rounded-lg shadow p-6 flex items-center justify-between"
        >
          <!-- Vehicle Icon -->
          <div class="mr-4">
            <i class="pi pi-car text-3xl text-mfu-red"></i>
          </div>

          <!-- Left Section: Vehicle Info -->
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900">Name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {{ log.name }}</p>
            <p class="text-sm text-gray-600">License Number : {{ log.licenseNumber }}</p>
            <p class="text-sm text-gray-600">Province&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {{ log.province }}</p>
            <p class="text-xs text-gray-500 mt-1">Vehicle Description : {{ log.vehicleDescription }}</p>
          </div>

          <!-- Center Section: Time & Location Info -->
          <div class="text-sm px-6 border-l border-r border-gray-200">
            <p class="font-medium text-gray-900">Date&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {{ log.date }}</p>
            <p class="text-gray-600">Parking Time : {{ log.parkingTime }}</p>
            <p class="text-gray-600 mt-1">Exit Time&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {{ log.exitTime }}</p>
            <p class="text-gray-600 mt-1">Parking slot number : {{ log.parkingSlot }}</p>
            <p class="mt-2">
              Parking Status :
              <span
                :class="[
                  'font-semibold',
                  log.status === 'Parking' ? 'text-parking-orange' : log.status === 'Exited' ? 'text-mfu-red' : 'text-parking-gray',
                ]"
              >
                {{ log.status }}
              </span>
            </p>
          </div>

          <!-- Right Section: Face Recognition -->
          <div class="text-center pl-6">
            <p class="text-xs font-medium text-gray-700 mb-2">Face Driver</p>
            <div class="flex space-x-2">
              <div class="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center">
                <i class="pi pi-user text-gray-500 text-xl"></i>
              </div>
              <div class="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center">
                <i class="pi pi-user text-gray-500 text-xl"></i>
              </div>
            </div>
            <p class="text-xs text-gray-600 mt-2">Entered</p>
            <p class="text-xs text-gray-600">Exited</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import parkingSlotsData from '@/data/parking-slots.json'

const activeTab = ref<'slots' | 'cctv' | 'log'>('slots')
const tabs: ('slots' | 'cctv' | 'log')[] = ['slots', 'cctv', 'log']
const selectedBuilding = ref('E4')
const selectedFloor = ref('4')
const selectedVehicle = ref('Cars')
const selectedSlots = ref<Set<number>>(new Set())
const parkingSlots = ref<Array<{ slotNumber: number; x: number; y: number }>>([])
const slotStatus = ref<{ [key: number]: string }>({})

const stats = computed(() => ({
  totalSlots: 124,
  available: 47,
  incoming: 6,
  occupied: 74,
  disable: 3,
}))

const parkingLogs = ref([
  {
    id: 1,
    name: 'Mrs. Wilayporn Nonsila',
    licenseNumber: 'กง 1234',
    province: 'เชียงราย',
    vehicleDescription: 'Black Toyota Fortuner',
    date: '12/08/2569',
    parkingTime: '12:00:34',
    exitTime: '-',
    parkingSlot: '10',
    status: 'Parking',
  },
  {
    id: 2,
    name: '*Guest555',
    licenseNumber: 'ภค 5555',
    province: 'สำพัน',
    vehicleDescription: 'Unknown',
    date: '12/08/2569',
    parkingTime: '14:00:34',
    exitTime: '16:01:21',
    parkingSlot: '54',
    status: 'Exited',
  },
  {
    id: 3,
    name: 'Anut in Charnvirakul',
    licenseNumber: 'สฮ 1000',
    province: 'กรุงเทพมหานคร',
    vehicleDescription: 'BYD blue pearl',
    date: '12/08/2569',
    parkingTime: '-',
    exitTime: '-',
    parkingSlot: '-',
    status: 'Not Parking',
  },
])

const getSlotColor = (slotNumber: number): string => {
  if (selectedSlots.value.has(slotNumber)) {
    return '#93C5FD' // light blue for selected
  }
  const status = slotStatus.value[slotNumber] || 'available'
  if (status === 'occupied') return '#FF9800' // orange
  if (status === 'disabled') return '#9E9E9E' // gray
  return '#4CAF50' // green for available
}

const toggleSlotSelection = (slotNumber: number) => {
  if (selectedSlots.value.has(slotNumber)) {
    selectedSlots.value.delete(slotNumber)
  } else {
    selectedSlots.value.add(slotNumber)
  }
}

const handleEditSlots = () => {
  console.log('Edit slots:', Array.from(selectedSlots.value))
}

const handleEnableSlots = () => {
  for (const slotId of selectedSlots.value) {
    slotStatus.value[slotId] = 'available'
  }
  selectedSlots.value.clear()
}

const handleDisableSlots = () => {
  for (const slotId of selectedSlots.value) {
    slotStatus.value[slotId] = 'disabled'
  }
  selectedSlots.value.clear()
}

onMounted(() => {
  // Load parking slots data
  const data = parkingSlotsData as any
  const floor4Data = data.E4.floor4

  // Collect all slot positions
  const allSlots: Array<{ slotNumber: number; x: number; y: number }> = []
  for (const row of Object.values(floor4Data.rows) as any[]) {
    allSlots.push(...row.positions)
  }

  parkingSlots.value = allSlots.sort((a, b) => a.slotNumber - b.slotNumber)

  // Load slot statuses
  slotStatus.value = floor4Data.slotStatus
})
</script>

<style scoped></style>
