<template>
  <form class="overlay-card floor-form" @submit.prevent="saveFloor">
    <button
      class="close-x"
      type="button"
      :aria-label="t('Close floor form')"
      :disabled="isSaving"
      @click="$emit('cancel')"
    >
      <X class="h-7 w-7" :stroke-width="3" />
    </button>
    <h2>{{ mode === 'add' ? t('Add Floor') : t('Edit Floor') }}</h2>

    <label class="floor-field">
      <span>{{ t('Building *') }}</span>
      <select v-model="buildingId" required :disabled="isSaving">
        <option disabled value="">{{ t('Select building') }}</option>
        <option v-for="building in buildings" :key="building._id" :value="building._id">
          {{ building.building_name }}
        </option>
      </select>
    </label>
    <label class="floor-field">
      <span>{{ t('Floor *') }}</span>
      <input v-model.number="floorNumber" type="number" step="1" required :disabled="isSaving" />
    </label>
    <label class="floor-field">
      <span>{{ t('Vehicle *') }}</span>
      <select v-model="vehicleType" :disabled="isSaving">
        <option value="car">{{ t('Cars') }}</option>
        <option value="motorcycle">{{ t('Motorcycle') }}</option>
      </select>
    </label>
    <label v-if="mode === 'edit'" class="floor-field">
      <span>{{ t('Status') }}</span>
      <select v-model="status" :disabled="isSaving">
        <option value="Available">{{ t('Available') }}</option>
        <option value="Disable">{{ t('Disable') }}</option>
      </select>
    </label>
    <p v-if="error" class="floor-error" role="alert">{{ t(error) }}</p>
    <div class="floor-actions">
      <button
        :class="mode === 'add' ? 'green-button' : 'blue-button'"
        type="submit"
        :disabled="isSaving || !buildings.length"
      >
        {{ isSaving ? t('Saving...') : t('Confirm') }}
      </button>
      <button
        v-if="mode === 'edit'"
        class="cancel-button"
        type="button"
        :disabled="isSaving"
        @click="$emit('cancel')"
      >
        {{ t('Cancel') }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { t } from '@/i18n'
import { ref } from 'vue'
import { isAxiosError } from 'axios'
import { X } from 'lucide-vue-next'
import { floorService, type ParkingBuilding, type ParkingFloor } from '@/services/api'

const props = defineProps<{
  mode: 'add' | 'edit'
  buildings: ParkingBuilding[]
  floors?: ParkingFloor[]
  floor?: ParkingFloor | null
}>()
const emit = defineEmits<{
  saved: [buildingId: string]
  cancel: []
}>()

const buildingId = ref(props.floor?.building?._id ?? props.buildings[0]?._id ?? '')
const floorNumber = ref(props.floor?.floor ?? 1)
const vehicleType = ref<ParkingFloor['veh_type']>(props.floor?.veh_type ?? 'car')
const status = ref<ParkingFloor['status']>(
  props.mode === 'edit' && props.floor?.status === 'Available' ? 'Available' : 'Disable',
)
const isSaving = ref(false)
const error = ref('')

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
  const duplicate = (props.floors || []).some(
    (item) =>
      item._id !== props.floor?._id &&
      item.building?._id === buildingId.value &&
      item.floor === floorNumber.value &&
      item.veh_type === vehicleType.value,
  )
  if (duplicate) {
    error.value = 'This floor already exists for the selected vehicle type in this building.'
    return
  }

  error.value = ''
  isSaving.value = true
  const data = {
    building: buildingId.value,
    floor: floorNumber.value,
    veh_type: vehicleType.value,
    status: props.mode === 'add' ? 'Disable' : status.value,
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
  display: flex;
  flex-direction: column;
  width: min(460px, calc(100vw - 32px));
  min-height: auto;
  gap: 16px;
  padding: 52px 32px 28px;
}

.overlay-card.floor-form h2 {
  align-self: center;
  margin: 0;
}

.overlay-card.floor-form .floor-field {
  width: 100%;
  max-width: none;
  font-size: 14px;
}

.overlay-card.floor-form .floor-field input,
.overlay-card.floor-form .floor-field select {
  width: 100%;
  min-height: 36px;
}

.floor-error {
  color: #b42318;
  font-size: 13px;
  text-align: center;
}

.floor-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 2px;
}

.floor-actions button[type='submit'] {
  color: #fff;
}

.cancel-button {
  min-width: 84px;
  min-height: 36px;
  border-radius: 5px;
  border: 1px solid #64748b;
  background: #fff;
  color: #334155;
}

.cancel-button:hover:not(:disabled) {
  background: #f1f5f9;
}

@media (max-width: 520px) {
  .overlay-card.floor-form {
    padding: 52px 20px 24px;
  }
}
</style>
