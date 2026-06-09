<template>
  <div class="ml-40 p-6">
    <div class="max-w-6xl">
      <!-- Page Title -->
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Action History</h1>
        <p class="text-gray-600">View all parking management actions</p>
      </div>

      <!-- History Entries -->
      <div v-if="historyEntries.length === 0" class="bg-white rounded-lg shadow p-8 text-center">
        <i class="pi pi-inbox text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-600">No history records found</p>
      </div>

      <div v-for="entry in historyEntries" :key="entry.id" class="bg-white rounded-lg shadow p-6 mb-4">
        <div class="grid grid-cols-4 gap-6">
          <!-- Left Section: Staff & Location Info -->
          <div class="col-span-1">
            <p class="font-semibold text-gray-900 text-sm">{{ entry.staffName }}</p>
            <div class="mt-3 space-y-2 text-sm">
              <div>
                <span class="text-gray-600">Building:</span>
                <p class="font-medium text-gray-900">{{ entry.building }}</p>
              </div>
              <div>
                <span class="text-gray-600">Floor:</span>
                <p class="font-medium text-gray-900">{{ entry.floor }}</p>
              </div>
            </div>
          </div>

          <!-- Center Section: Parking Slots -->
          <div class="col-span-1">
            <p class="text-sm text-gray-600 font-medium">Parking Slot(s)</p>
            <p class="font-medium text-gray-900 text-sm mt-2">{{ entry.parkingSlots }}</p>
          </div>

          <!-- Date & Time Section -->
          <div class="col-span-1 text-center">
            <p class="text-sm text-gray-600 font-medium">Date Edited</p>
            <p class="font-medium text-gray-900 text-sm mt-2">{{ entry.dateEdited }}</p>
            <p class="text-xs text-gray-600 mt-1">{{ entry.timeEdited }}</p>
          </div>

          <!-- Status Section -->
          <div class="col-span-1 text-right">
            <p class="text-sm text-gray-600 font-medium mb-2">Status Changed To</p>
            <span
              :class="[
                'px-4 py-2 rounded-lg font-semibold inline-block text-sm',
                entry.statusChangedTo === 'Enable'
                  ? 'bg-parking-green text-white'
                  : 'bg-mfu-red text-white',
              ]"
            >
              {{ entry.statusChangedTo }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface HistoryEntry {
  id: number
  staffName: string
  building: string
  floor: string
  parkingSlots: string
  dateEdited: string
  timeEdited: string
  statusChangedTo: 'Enable' | 'Disable'
}

const historyEntries = ref<HistoryEntry[]>([
  {
    id: 1,
    staffName: 'Thanatip Pitaksin',
    building: 'E4',
    floor: '4',
    parkingSlots: '120, 121, 122, 123',
    dateEdited: '11/4/2569',
    timeEdited: '13:00:23',
    statusChangedTo: 'Disable',
  },
  {
    id: 2,
    staffName: 'Thanatip Pitaksin',
    building: 'E4',
    floor: '4',
    parkingSlots: '100, 101, 102',
    dateEdited: '10/4/2569',
    timeEdited: '09:30:15',
    statusChangedTo: 'Enable',
  },
  {
    id: 3,
    staffName: 'Somprasong Jamboon',
    building: 'E4',
    floor: '4',
    parkingSlots: '50, 51, 52, 53, 54',
    dateEdited: '09/4/2569',
    timeEdited: '14:15:42',
    statusChangedTo: 'Disable',
  },
])

onMounted(() => {
  // Load history from API or localStorage in the future
})
</script>

<style scoped></style>
