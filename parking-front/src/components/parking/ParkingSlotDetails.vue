<template>
  <aside v-if="selectedSlots.length" class="details-panel" :aria-label="t('Slot details and actions')">
    <div class="details-heading">
      <h2>{{ t('Slot details') }}</h2>
      <span>{{ t(['{count} selected', { count: selectedSlots.length }]) }}</span>
    </div>
    <div class="detail-body">
      <div v-if="singleSlot" :class="['slot-preview', singleSlot.status]">
        <ParkingSquare :size="36" aria-hidden="true" />
        <strong>{{ slotDisplayName(singleSlot) }}</strong>
        <span>{{ t(statusLabels[singleSlot.status]) }}</span>
        <span
          v-if="slotConnectionStatus(singleSlot) !== 'Connect'"
          class="slot-connection-status connection-status-label"
        >
          ({{ t(slotConnectionStatus(singleSlot)) }})
        </span>
      </div>
      <div v-if="allowAssignment" class="slot-assignment">
        <label for="slot-cctv">{{ t('Select CCTV') }}</label>
        <select
          id="slot-cctv"
          :value="presetId"
          :disabled="busy || !presets.length"
          @change="emit('camera-change', inputValue($event))"
        >
          <option value="">{{ t(presets.length ? 'Select CCTV' : 'None') }}</option>
          <option v-for="preset in presets" :key="preset._id" :value="preset._id">
            {{ preset.name }}
          </option>
        </select>
        <template v-if="singleSlot">
          <label for="slot-parking-name">{{ t('Select Parking Slot') }}</label>
          <select
            id="slot-parking-name"
            :value="singleSlot.parkingSlotName || ''"
            :disabled="busy || !presetId || (!parkingSlotNames.length && !singleSlot.parkingSlotName)"
            @change="emit('parking-slot-change', inputValue($event), presetId)"
          >
            <option value="">{{ t(parkingSlotNames.length ? 'Select Parking Slot' : 'None') }}</option>
            <option v-for="name in parkingSlotNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </template>
      </div>
      <form
        v-if="showVehicleDetails && singleSlot?.status === 'occupied'"
        class="vehicle-detail-form"
        @submit.prevent="saveVehicleDetails"
      >
        <label for="slot-license-plate">{{ t('License Plate') }}</label>
        <input id="slot-license-plate" v-model.trim="licensePlate" type="text" maxlength="100" autocomplete="off" required />
        <label for="slot-province">{{ t('Province') }}</label>
        <select id="slot-province" v-model="province" required>
          <option disabled value="">{{ t('Select Province') }}</option>
          <option v-if="customProvince" :value="province">{{ province === 'Unknown' ? t('Unknown') : province }}</option>
          <option v-for="value in thaiProvinces" :key="value" :value="value">{{ value }}</option>
        </select>
        <p v-if="vehicleMessage" :class="['vehicle-detail-message', { error: vehicleError }]" role="status">
          {{ t(vehicleMessage) }}
        </p>
        <div class="vehicle-detail-actions">
          <div v-if="singleSlot.date_updated" class="vehicle-detail-updated">
            <span>{{ t('Date Updated') }}</span><strong>{{ singleSlot.date_updated }}</strong>
            <span>{{ t('Time Updated') }}</span><strong>{{ singleSlot.time_updated || '-' }}</strong>
          </div>
          <button class="vehicle-detail-save" type="submit" :disabled="busy || savingVehicle || !canSaveVehicle">
            {{ t(savingVehicle ? 'Saving...' : 'Save') }}
          </button>
        </div>
      </form>
      <p v-if="singleSlot && !isEditableSlot(singleSlot)" class="locked-note">
        <LockKeyhole :size="15" aria-hidden="true" />
        {{ t('Occupied and incoming statuses are controlled by the camera.') }}
      </p>
    </div>
    <div class="detail-body selection-section">
      <h3>{{ t(['{count} parking slots selected', { count: selectedSlots.length }]) }}</h3>
      <p>{{ t('Shift-click slots to select more than one.') }}</p>
      <div class="selection-actions">
        <button
          type="button"
          class="enable-button"
          :disabled="busy || statusActionsDisabled || !canEnable"
          @click="emit('status-change', 'available')"
        ><CheckCircle2 :size="16" aria-hidden="true" />{{ t('Enable') }}</button>
        <button
          type="button"
          class="disable-button"
          :disabled="busy || statusActionsDisabled || !canDisable"
          @click="emit('status-change', 'disabled')"
        ><Ban :size="16" aria-hidden="true" />{{ t('Disable') }}</button>
      </div>
      <slot name="feedback" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isAxiosError } from 'axios'
import { Ban, CheckCircle2, LockKeyhole, ParkingSquare } from 'lucide-vue-next'
import { thaiProvinces } from '@/data/thaiProvinces'
import { t, type LocalizedText } from '@/i18n'
import { floorService, type ParkingFloor, type ParkingMapPreset } from '@/services/api'
import { slotKey } from './parkingMapJson'
import { slotDisplayName } from './parkingLayout'
import { isEditableSlot, slotConnectionStatus, statusLabels, type PreviewSlot } from './parkingMapPreview'

const props = withDefaults(defineProps<{
  floorId: string
  slots: PreviewSlot[]
  selectedSlots: PreviewSlot[]
  presets?: ParkingMapPreset[]
  allowAssignment?: boolean
  showVehicleDetails?: boolean
  statusActionsDisabled?: boolean
  busy?: boolean
}>(), { presets: () => [] })
const emit = defineEmits<{
  'camera-change': [presetId: string]
  'parking-slot-change': [name: string, presetId: string]
  'status-change': [status: 'available' | 'disabled']
  'map-updated': [floorId: string, map: NonNullable<ParkingFloor['parking_map']>]
  'vehicle-saving': [saving: boolean]
}>()
const singleSlot = computed(() => props.selectedSlots.length === 1 ? props.selectedSlots[0] : undefined)
const canEnable = computed(() => props.selectedSlots.some((slot) => slot.status === 'disabled'))
const canDisable = computed(() => props.selectedSlots.some((slot) => slot.status === 'available'))
const presetId = computed(() => {
  const ids = new Set(props.selectedSlots.map((slot) => slot.cameraPresetId || ''))
  return ids.size === 1 ? [...ids][0]! : ''
})
const parkingSlotNames = computed(() => {
  const names = props.presets.find((preset) => preset._id === presetId.value)?.slotNames || []
  const assignedNames = new Set(
    props.slots
      .filter((slot) =>
        slot.cameraPresetId === presetId.value && slot.parkingSlotName &&
        (!singleSlot.value || slotKey(slot) !== slotKey(singleSlot.value)),
      )
      .map((slot) => slot.parkingSlotName),
  )
  return [...new Set(names)].filter((name) => !assignedNames.has(name))
})
const licensePlate = ref('')
const province = ref('')
const savingVehicle = ref(false)
const vehicleMessage = ref<LocalizedText>('')
const vehicleError = ref(false)
const customProvince = computed(() => province.value && !thaiProvinces.includes(province.value))
const canSaveVehicle = computed(() =>
  Boolean(licensePlate.value.trim()) && licensePlate.value.trim().toLowerCase() !== 'unknown' &&
  Boolean(province.value.trim()),
)
const vehicleState = computed(() => {
  const slot = singleSlot.value
  if (slot?.status !== 'occupied') return { key: '', plate: '', province: '' }
  return {
    key: JSON.stringify([props.floorId, slotKey(slot)]),
    plate: slot.license_num || 'Unknown',
    province: slot.province || 'Unknown',
  }
})
watch(vehicleState, (next, previous) => {
  const changedSlot = next.key !== previous?.key
  if (changedSlot || licensePlate.value === previous?.plate) licensePlate.value = next.plate
  if (changedSlot || province.value === previous?.province) province.value = next.province
  if (changedSlot) vehicleMessage.value = ''
}, { immediate: true })

function inputValue(event: Event) {
  return (event.target as HTMLSelectElement).value
}

async function saveVehicleDetails() {
  const slot = singleSlot.value
  if (slot?.status !== 'occupied' || !props.showVehicleDetails || props.busy ||
      savingVehicle.value || !canSaveVehicle.value) return
  const floorId = props.floorId
  const key = vehicleState.value.key
  savingVehicle.value = true
  emit('vehicle-saving', true)
  vehicleMessage.value = ''
  vehicleError.value = false
  try {
    const { data } = await floorService.updateOccupiedSlotVehicleDetails(
      floorId, slotKey(slot), licensePlate.value.trim(), province.value.trim(),
    )
    emit('map-updated', floorId, data.map)
    if (vehicleState.value.key !== key) return
    if (data.activeLogUpdated) {
      vehicleMessage.value = data.removedHistoryCount
        ? ['Vehicle details saved to the slot and active parking log. {count} older history record(s) deleted.', { count: data.removedHistoryCount }]
        : 'Vehicle details saved to the slot and active parking log. No older history records found.'
    } else {
      vehicleMessage.value = data.activeLogFound
        ? 'Vehicle details saved to the slot, but the active parking log changed before it could be updated.'
        : 'Vehicle details saved to the slot. No active parking log was found.'
    }
  } catch (cause) {
    if (vehicleState.value.key !== key) return
    vehicleError.value = true
    vehicleMessage.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Unable to save vehicle details.'
      : cause instanceof Error ? cause.message : 'Unable to save vehicle details.'
  } finally {
    savingVehicle.value = false
    emit('vehicle-saving', false)
  }
}
</script>

<style scoped>
.details-panel {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #334155;
}
.details-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 17px;
  border-bottom: 1px solid #edf0f4;
}
.details-heading h2 { margin: 0; font-size: 16px; font-weight: 650; }
.details-heading span { font-size: 11px; color: #64748b; }
.detail-body { padding: 0 16px 16px; }
.slot-preview {
  display: grid;
  justify-items: center;
  gap: 10px;
  margin: 16px 0;
  padding: 22px 12px;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #dbe2eb;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
.slot-preview strong { font-size: 22px; max-width: 100%; }
.slot-preview span { font-size: 12px; }
.slot-preview.available { background: #edf9f1; color: #15803d; }
.slot-preview.occupied { background: #fceeed; color: #c23b45; }
.slot-preview.incoming { background: #fff5df; color: #a36507; }
.slot-assignment, .vehicle-detail-form {
  display: grid;
  gap: 8px;
  margin: 16px 0;
  font-size: 12px;
}
.vehicle-detail-form label { color: #475569; font-weight: 600; }
.slot-assignment select, .vehicle-detail-form :is(input, select) {
  min-width: 0;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid #dbe2eb;
  border-radius: 6px;
  background: white;
  color: #1e293b;
}
.vehicle-detail-actions, .selection-actions { display: flex; align-items: center; gap: 8px; }
.vehicle-detail-actions { justify-content: space-between; margin-top: 4px; }
.vehicle-detail-updated {
  display: grid;
  grid-template-columns: auto auto;
  gap: 4px 6px;
  color: #64748b;
  font-size: 10px;
}
.vehicle-detail-updated strong { overflow-wrap: anywhere; }
.selection-section { border-top: 1px solid #edf0f4; padding-top: 16px; }
.selection-section h3 { margin: 0; font-size: 12px; font-weight: 650; }
.selection-section > p { margin-top: 8px; color: #64748b; font-size: 11px; }
.selection-actions { margin: 14px 0 6px; }
button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  border: 1px solid #dbe2eb;
  border-radius: 7px;
  background: white;
  font-size: 12px;
  cursor: pointer;
}
button:disabled { opacity: 0.5; cursor: default; }
.enable-button { color: #15803d; }
.disable-button { color: #b42318; }
.vehicle-detail-save { background: #15803d; color: white; font-weight: 650; }
.vehicle-detail-message { color: #15803d; }
.vehicle-detail-message.error { color: #b42318; }
.locked-note { display: flex; gap: 6px; align-items: flex-start; color: #64748b; font-size: 11px; }
</style>
