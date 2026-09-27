<template>
  <form class="overlay-card floor-form" @submit.prevent="saveFloor">
    <button class="close-x" type="button" aria-label="Close floor form" :disabled="isSaving" @click="$emit('cancel')">
      <X class="h-7 w-7" :stroke-width="3" />
    </button>
    <h2>{{ mode === 'add' ? 'Add Floor' : 'Edit Floor' }}</h2>

    <label class="floor-field">
      <span>Building *</span>
      <select v-model="buildingId" required :disabled="isSaving">
        <option disabled value="">Select building</option>
        <option v-for="building in buildings" :key="building._id" :value="building._id">
          {{ building.building_name }}
        </option>
      </select>
    </label>
    <label class="floor-field">
      <span>Floor *</span>
      <input v-model.number="floorNumber" type="number" step="1" required :disabled="isSaving" />
    </label>
    <label class="floor-field">
      <span>Vehicle *</span>
      <select v-model="vehicleType" :disabled="isSaving">
        <option value="car">Cars</option>
        <option value="motorcycle">Motorcycle</option>
      </select>
    </label>
    <label class="floor-field">
      <span>Status</span>
      <select v-model="status" :disabled="isSaving">
        <option value="available">Available</option>
        <option value="unavailable">Unavailable</option>
        <option value="disable">Disable</option>
      </select>
    </label>
    <p v-if="error" class="floor-error" role="alert">{{ error }}</p>
    <div class="floor-actions">
      <button :class="mode === 'add' ? 'green-button' : 'blue-button'" type="submit" :disabled="isSaving || !buildings.length">
        {{ isSaving ? 'Saving...' : 'Confirm' }}
      </button>
      <button v-if="mode === 'edit'" class="red-button" type="button" :disabled="isSaving" @click="openDeleteConfirmation">
        Delete
      </button>
    </div>
  </form>

  <div v-if="showDeleteConfirmation" class="floor-delete-backdrop" @click.self="!isSaving && (showDeleteConfirmation = false)">
    <div class="floor-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="floor-delete-title">
      <h2 id="floor-delete-title">Delete Floor {{ floor?.floor }}?</h2>
      <p>This floor will be removed from {{ floor?.building?.building_name }}.</p>
      <p v-if="deleteError" class="floor-error" role="alert">{{ deleteError }}</p>
      <div class="floor-delete-actions">
        <button type="button" :disabled="isSaving" @click="showDeleteConfirmation = false">Cancel</button>
        <button class="red-button" type="button" :disabled="isSaving" @click="deleteFloor">
          {{ isSaving ? 'Deleting...' : 'Delete' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { isAxiosError } from 'axios'
import { X } from 'lucide-vue-next'
import { floorService, type ParkingBuilding, type ParkingFloor } from '@/services/api'

const props = defineProps<{
  mode: 'add' | 'edit'
  buildings: ParkingBuilding[]
  floor?: ParkingFloor | null
}>()
const emit = defineEmits<{ saved: [buildingId: string]; deleted: [buildingId: string]; cancel: [] }>()

const buildingId = ref(props.floor?.building?._id ?? props.buildings[0]?._id ?? '')
const floorNumber = ref(props.floor?.floor ?? 1)
const vehicleType = ref<ParkingFloor['veh_type']>(props.floor?.veh_type ?? 'car')
const status = ref<ParkingFloor['status']>(props.floor?.status ?? 'disable')
const isSaving = ref(false)
const error = ref('')
const showDeleteConfirmation = ref(false)
const deleteError = ref('')

const openDeleteConfirmation = () => {
  deleteError.value = ''
  showDeleteConfirmation.value = true
}

const deleteFloor = async () => {
  if (!props.floor || isSaving.value) return
  isSaving.value = true
  deleteError.value = ''
  try {
    await floorService.remove(props.floor._id)
    emit('deleted', props.floor.building?._id ?? buildingId.value)
  } catch (cause) {
    deleteError.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Failed to delete floor.'
      : 'Failed to delete floor.'
  } finally {
    isSaving.value = false
  }
}

const saveFloor = async () => {
  if (isSaving.value) return
  if (!buildingId.value || !Number.isInteger(floorNumber.value)) {
    error.value = 'Select a building and enter a valid floor.'
    return
  }
  if (props.mode === 'edit' && !props.floor) {
    error.value = 'Floor not found.'
    return
  }

  error.value = ''
  isSaving.value = true
  const data = {
    building: buildingId.value,
    floor: floorNumber.value,
    veh_type: vehicleType.value,
    status: status.value,
  }

  try {
    if (props.mode === 'edit' && props.floor) {
      await floorService.update(props.floor._id, data)
    } else {
      await floorService.create(data)
    }
    emit('saved', buildingId.value)
  } catch (cause) {
    error.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Failed to save floor.'
      : 'Failed to save floor.'
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.overlay-card.floor-form {
  width: min(440px, 100%);
  min-height: auto;
  gap: 12px;
  padding-top: 24px;
}

.floor-form .floor-field {
  width: 100%;
  max-width: 320px;
  font-size: 14px;
}

.floor-form .floor-field input,
.floor-form .floor-field select {
  width: 100%;
  min-height: 36px;
}

.floor-error {
  color: #b42318;
  font-size: 13px;
  text-align: center;
}

.floor-actions,
.floor-delete-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.floor-delete-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.floor-delete-dialog {
  width: min(400px, 100%);
  padding: 24px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.2);
}

.floor-delete-dialog h2 {
  margin-bottom: 10px;
  font-size: 20px;
  font-weight: 700;
}

.floor-delete-dialog p {
  margin-bottom: 16px;
  font-size: 14px;
}

.floor-delete-actions {
  justify-content: flex-end;
}

.floor-delete-actions button {
  min-width: 84px;
  min-height: 36px;
  border-radius: 5px;
}
</style>
