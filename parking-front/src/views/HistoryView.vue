<template>
  <div class="ml-40 p-6">
    <div class="max-w-4xl">
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

      <div v-for="entry in historyEntries" :key="entry._id" class="bg-white rounded-lg shadow p-6 mb-4">
        <div class="flex items-center justify-between">
          <!-- Left Section -->
          <div class="flex-1">
            <p class="font-semibold text-gray-900 text-lg">{{ entry.staffName }}</p>
            <div class="grid grid-cols-2 gap-4 mt-3 text-sm">
              <div>
                <span class="text-gray-600">Building:</span>
                <span class="font-medium ml-2">{{ entry.building }}</span>
              </div>
              <div>
                <span class="text-gray-600">Floor:</span>
                <span class="font-medium ml-2">{{ entry.floor }}</span>
              </div>
              <div class="col-span-2">
                <span class="text-gray-600">Parking Slots:</span>
                <span class="font-medium ml-2">{{ entry.parkingSlots.join(', ') }}</span>
              </div>
            </div>
          </div>

          <!-- Center Section -->
          <div class="text-center px-6 border-l border-r border-gray-200">
            <p class="text-sm text-gray-600">Date & Time</p>
            <p class="font-semibold text-gray-900 mt-1">{{ formatDate(entry.dateEdited) }}</p>
            <p class="text-sm text-gray-600 mt-1">{{ entry.timeEdited }}</p>
          </div>

          <!-- Right Section -->
          <div class="text-center pl-6">
            <p class="text-sm text-gray-600 mb-2">Status Changed To</p>
            <span
              :class="[
                'px-4 py-2 rounded-lg font-semibold inline-block',
                entry.statusChangedTo === 'enable'
                  ? 'bg-parking-green text-white'
                  : 'bg-mfu-red text-white',
              ]"
            >
              {{ entry.statusChangedTo.toUpperCase() }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { HistoryEntry } from '@/types'
import { historyService } from '@/services/api'

const historyEntries = ref<HistoryEntry[]>([])

const formatDate = (date: any) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

onMounted(async () => {
  try {
    const response = await historyService.getHistory()
    historyEntries.value = response.data
  } catch (err) {
    console.error('Failed to load history:', err)
  }
})
</script>

<style scoped></style>
