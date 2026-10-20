<template>
  <div class="vehicle-page">
    <div class="vehicle-tabs" role="tablist" aria-label="Vehicle sections">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-button', activeTab === tab.id ? 'is-active' : '']"
        type="button"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <section v-if="activeTab === 'cars'" class="vehicle-panel">
      <p v-if="isLoadingVehicles" class="panel-state">Loading vehicles...</p>
      <p v-else-if="vehicleError" class="panel-state error">{{ vehicleError }}</p>
      <p v-else-if="!vehicles.length" class="panel-state">No vehicles found</p>

      <article v-for="vehicle in vehicles" :key="vehicle.id" class="vehicle-card">
        <div class="card-actions">
          <button type="button" aria-label="Edit vehicle" @click="editVehicle(vehicle)">
            <PencilLine class="h-6 w-6" :stroke-width="2.4" />
          </button>
          <button
            type="button"
            aria-label="Delete vehicle"
            @click="openDeleteConfirmation(vehicle)"
          >
            <Trash2 class="h-6 w-6" :stroke-width="2.7" />
          </button>
        </div>

        <CarFront v-if="vehicle.type === 'car'" class="vehicle-icon" :stroke-width="2.5" />
        <Bike v-else class="vehicle-icon" :stroke-width="2.5" />

        <dl class="vehicle-details">
          <div>
            <dt>Brand</dt>
            <dd>{{ vehicle.brand }}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{{ vehicle.model }}</dd>
          </div>
          <div>
            <dt>Color</dt>
            <dd>{{ vehicle.color }}</dd>
          </div>
          <div>
            <dt>License Number</dt>
            <dd>{{ vehicle.licenseNumber }}</dd>
          </div>
          <div>
            <dt>Province</dt>
            <dd>{{ vehicle.province }}</dd>
          </div>
        </dl>
      </article>

      <button class="add-vehicle" type="button" aria-label="Add vehicle" @click="openTypePicker">
        <Plus class="h-16 w-16" :stroke-width="2.8" />
      </button>
    </section>

    <section v-else class="history-panel">
      <article v-for="entry in parkingHistory" :key="entry.id" class="history-card">
        <Clock3 class="history-icon" :stroke-width="2.4" />
        <div>
          <strong>{{ entry.vehicle }}</strong>
          <p>{{ entry.slot }} - {{ entry.time }}</p>
        </div>
        <span>{{ entry.status }}</span>
      </article>
    </section>

    <div
      v-if="isTypePickerOpen"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeTypePicker"
    >
      <section
        class="type-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-type-title"
      >
        <button
          class="type-close"
          type="button"
          aria-label="Close vehicle type picker"
          @click="closeTypePicker"
        >
          <X class="h-8 w-8" :stroke-width="2.8" />
        </button>

        <h2 id="vehicle-type-title">Vehicle add</h2>

        <div class="type-options">
          <button
            :class="['type-option', selectedVehicleType === 'car' ? 'is-selected' : '']"
            type="button"
            @click="selectVehicleType('car')"
          >
            <span class="type-icon-frame">
              <CarFront class="type-icon car-type-icon" :stroke-width="2.5" />
            </span>
            <span>Car</span>
          </button>

          <button
            :class="['type-option', selectedVehicleType === 'motorcycle' ? 'is-selected' : '']"
            type="button"
            @click="selectVehicleType('motorcycle')"
          >
            <span class="type-icon-frame">
              <Bike class="type-icon motor-type-icon" :stroke-width="2.5" />
            </span>
            <span>Motor</span>
          </button>
        </div>

        <button class="confirm-type" type="button" @click="confirmVehicleType">Confirm</button>
      </section>
    </div>

    <dialog
      ref="formDialog"
      class="vehicle-form-dialog"
      aria-labelledby="vehicle-details-title"
      @cancel.prevent="closeForm"
      @click.self="closeForm"
    >
      <form class="vehicle-form" :aria-busy="isSaving" @submit.prevent="confirmVehicleDetails">
        <div class="form-header">
          <button type="button" aria-label="Close form" :disabled="isSaving" @click="closeForm">
            <X class="h-8 w-8" :stroke-width="2.4" />
          </button>
          <h2 id="vehicle-details-title">
            {{ editingVehicleId ? 'Edit vehicle details' : 'Vehicle details' }}
          </h2>
        </div>

        <fieldset class="form-fields" :disabled="isSaving">
          <label>
            <span>Brand</span>
            <input
              v-model.trim="vehicleForm.brand"
              type="text"
              placeholder="กรอกยี่ห้อ เช่น Toyota, Honda"
              required
              autofocus
            />
          </label>

          <label>
            <span>Model</span>
            <input v-model.trim="vehicleForm.model" type="text" placeholder="กรอกรุ่นรถ" required />
          </label>

          <label>
            <span>Color</span>
            <input
              v-model.trim="vehicleForm.color"
              type="text"
              placeholder="e.g. White, Black, Silver"
              required
            />
          </label>

          <label>
            <span>License Plate</span>
            <input
              v-model.trim="vehicleForm.licenseNumber"
              type="text"
              placeholder="e.g. 3กข 1234"
              required
            />
          </label>

          <label>
            <span>จังหวัด</span>
            <select v-model="vehicleForm.province" required>
              <option disabled value="">เลือกจังหวัด</option>
              <option v-if="hasCustomProvince" :value="vehicleForm.province">
                {{ vehicleForm.province }}
              </option>
              <option v-for="province in thaiProvinces" :key="province" :value="province">
                {{ province }}
              </option>
            </select>
          </label>
        </fieldset>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <button class="save-button" type="submit" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Confirm' }}
        </button>
      </form>
    </dialog>

    <dialog
      ref="confirmationDialog"
      class="vehicle-confirmation"
      aria-labelledby="vehicle-confirmation-title"
      :aria-busy="isSaving"
      @cancel.prevent="cancelConfirmation"
      @click.self="cancelConfirmation"
    >
      <div class="confirmation-content">
        <span class="confirmation-icon" aria-hidden="true">?</span>
        <h2 id="vehicle-confirmation-title">Are you sure you want to add<br />this vehicle?</h2>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="confirmation-actions">
          <button class="confirmation-yes" type="button" :disabled="isSaving" @click="saveVehicle">
            {{ isSaving ? 'Saving...' : 'YES' }}
          </button>
          <button
            class="confirmation-cancel"
            type="button"
            :disabled="isSaving"
            @click="cancelConfirmation"
          >
            CANCEL
          </button>
        </div>
      </div>
    </dialog>

    <dialog
      ref="deleteDialog"
      class="vehicle-confirmation"
      aria-labelledby="vehicle-delete-title"
      aria-describedby="vehicle-delete-details"
      :aria-busy="isDeleting"
      @cancel.prevent="closeDeleteConfirmation"
      @click.self="closeDeleteConfirmation"
    >
      <div class="confirmation-content">
        <span class="confirmation-icon" aria-hidden="true">?</span>
        <h2 id="vehicle-delete-title">Are you sure you want to delete<br />this vehicle?</h2>
        <p id="vehicle-delete-details" class="confirmation-vehicle">
          {{ vehicleToDelete?.licenseNumber }} {{ vehicleToDelete?.province }}
        </p>
        <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
        <div class="confirmation-actions">
          <button
            class="confirmation-yes"
            type="button"
            :disabled="isDeleting"
            @click="deleteVehicle"
          >
            {{ isDeleting ? 'Deleting...' : 'YES' }}
          </button>
          <button
            class="confirmation-cancel"
            type="button"
            :disabled="isDeleting"
            autofocus
            @click="closeDeleteConfirmation"
          >
            CANCEL
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { isAxiosError } from 'axios'
import { Bike, CarFront, Clock3, PencilLine, Plus, Trash2, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { vehicleService } from '@/services/api'
import { thaiProvinces } from '@/data/thaiProvinces'

type ActiveTab = 'cars' | 'history'
type VehicleType = 'car' | 'motorcycle'

interface UserVehicle {
  id: string
  type: VehicleType
  brand: string
  model: string
  color: string
  licenseNumber: string
  province: string
}

interface ParkingHistoryEntry {
  id: number
  vehicle: string
  slot: string
  time: string
  status: string
}

interface ApiVehicle {
  _id: string
  veh_type: VehicleType
  brand: string
  model: string
  color: string
  license_num: string
  province: string
}

interface VehicleListResponse {
  vehicles?: ApiVehicle[]
}

interface VehicleResponse {
  vehicle?: ApiVehicle
}

const authStore = useAuthStore()

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'cars', label: 'Cars' },
  { id: 'history', label: 'Parking History' },
]

const activeTab = ref<ActiveTab>('cars')
const isFormOpen = ref(false)
const isConfirmationOpen = ref(false)
const formDialog = ref<HTMLDialogElement | null>(null)
const confirmationDialog = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const vehicleToDelete = ref<UserVehicle | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const isTypePickerOpen = ref(false)
const selectedVehicleType = ref<VehicleType>('car')
const editingVehicleId = ref<string | null>(null)
const isLoadingVehicles = ref(false)
const isSaving = ref(false)
const vehicleError = ref('')
const formError = ref('')

const vehicles = ref<UserVehicle[]>([])

const parkingHistory = ref<ParkingHistoryEntry[]>([
  {
    id: 1,
    vehicle: 'Toyota Fortuner',
    slot: 'Parking slot B10',
    time: '12/08/2569 12:00',
    status: 'Parking',
  },
])

const vehicleForm = reactive({
  type: 'car' as VehicleType,
  brand: '',
  model: '',
  color: '',
  licenseNumber: '',
  province: '',
})

const ownerId = computed(() => authStore.user?._id || authStore.user?.id || '')
const shouldSyncWithApi = computed(() => {
  return Boolean(ownerId.value && ownerId.value !== 'guest' && !authStore.isGuest)
})

const hasCustomProvince = computed(() =>
  Boolean(vehicleForm.province && !thaiProvinces.includes(vehicleForm.province)),
)

const mapApiVehicle = (vehicle: ApiVehicle): UserVehicle => ({
  id: vehicle._id,
  type: vehicle.veh_type === 'motorcycle' ? 'motorcycle' : 'car',
  brand: vehicle.brand,
  model: vehicle.model,
  color: vehicle.color,
  licenseNumber: vehicle.license_num,
  province: vehicle.province,
})

const createVehiclePayload = () => ({
  veh_type: vehicleForm.type,
  name: ownerId.value,
  brand: vehicleForm.brand.trim(),
  model: vehicleForm.model.trim(),
  color: vehicleForm.color.trim(),
  license_num: vehicleForm.licenseNumber.trim(),
  province: vehicleForm.province.trim(),
})

const getVehicleError = (error: unknown, fallback: string) => {
  return isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || fallback
    : fallback
}

const loadVehicles = async () => {
  vehicleError.value = ''

  if (!shouldSyncWithApi.value) {
    vehicles.value = []
    return
  }

  isLoadingVehicles.value = true

  try {
    const response = await vehicleService.getByUser(ownerId.value)
    const data = response.data as VehicleListResponse
    vehicles.value = (data.vehicles || []).map(mapApiVehicle)
  } catch (err) {
    vehicleError.value = getVehicleError(err, 'Failed to load vehicles')
  } finally {
    isLoadingVehicles.value = false
  }
}

const resetForm = () => {
  formError.value = ''
  vehicleForm.type = selectedVehicleType.value
  vehicleForm.brand = ''
  vehicleForm.model = ''
  vehicleForm.color = ''
  vehicleForm.licenseNumber = ''
  vehicleForm.province = ''
}

const openTypePicker = () => {
  selectedVehicleType.value = 'car'
  editingVehicleId.value = null
  isTypePickerOpen.value = true
}

const closeTypePicker = () => {
  isTypePickerOpen.value = false
}

const selectVehicleType = (type: VehicleType) => {
  selectedVehicleType.value = type
}

const openAddForm = (type: VehicleType) => {
  editingVehicleId.value = null
  selectedVehicleType.value = type
  resetForm()
  vehicleForm.type = type
  isFormOpen.value = true
}

const confirmVehicleType = () => {
  isTypePickerOpen.value = false
  openAddForm(selectedVehicleType.value)
}

const editVehicle = (vehicle: UserVehicle) => {
  formError.value = ''
  editingVehicleId.value = vehicle.id
  selectedVehicleType.value = vehicle.type
  vehicleForm.type = vehicle.type
  vehicleForm.brand = vehicle.brand
  vehicleForm.model = vehicle.model
  vehicleForm.color = vehicle.color
  vehicleForm.licenseNumber = vehicle.licenseNumber
  vehicleForm.province = vehicle.province
  isFormOpen.value = true
}

const closeForm = () => {
  if (isSaving.value) return

  isConfirmationOpen.value = false
  isFormOpen.value = false
  editingVehicleId.value = null
  resetForm()
}

const confirmVehicleDetails = () => {
  if (isSaving.value) return

  formError.value = ''
  const { brand, model, color, license_num, province } = createVehiclePayload()
  if (![brand, model, color, license_num, province].every(Boolean)) {
    formError.value = 'กรุณากรอกข้อมูลรถให้ครบทุกช่อง'
    return
  }

  if (editingVehicleId.value) {
    void saveVehicle()
    return
  }

  isConfirmationOpen.value = true
}

const cancelConfirmation = () => {
  if (isSaving.value) return
  isConfirmationOpen.value = false
  formError.value = ''
}

const saveVehicle = async () => {
  if (isSaving.value) return

  const nextVehicle: UserVehicle = {
    id: editingVehicleId.value ?? `local-${Date.now()}`,
    type: vehicleForm.type,
    brand: vehicleForm.brand.trim(),
    model: vehicleForm.model.trim(),
    color: vehicleForm.color.trim(),
    licenseNumber: vehicleForm.licenseNumber.trim(),
    province: vehicleForm.province.trim(),
  }

  await saveVehicleData(nextVehicle)
}

const saveVehicleData = async (vehicle: UserVehicle) => {
  isSaving.value = true
  formError.value = ''

  try {
    if (shouldSyncWithApi.value) {
      const payload = createVehiclePayload()
      const response = editingVehicleId.value
        ? await vehicleService.update(editingVehicleId.value, payload)
        : await vehicleService.create(payload)
      const data = response.data as VehicleResponse
      const savedVehicle = data.vehicle ? mapApiVehicle(data.vehicle) : vehicle

      vehicles.value = editingVehicleId.value
        ? vehicles.value.map((item) => (item.id === editingVehicleId.value ? savedVehicle : item))
        : [savedVehicle, ...vehicles.value]
    } else if (editingVehicleId.value) {
      vehicles.value = vehicles.value.map((item) =>
        item.id === editingVehicleId.value ? vehicle : item,
      )
    } else {
      vehicles.value = [...vehicles.value, vehicle]
    }

    vehicleError.value = ''
    isSaving.value = false
    closeForm()
  } catch (err) {
    formError.value = getVehicleError(err, 'Failed to save vehicle')
  } finally {
    isSaving.value = false
  }
}

const openDeleteConfirmation = (vehicle: UserVehicle) => {
  if (isDeleting.value) return

  vehicleToDelete.value = vehicle
  deleteError.value = ''
  deleteDialog.value?.showModal()
}

const closeDeleteConfirmation = () => {
  if (isDeleting.value) return

  deleteDialog.value?.close()
  vehicleToDelete.value = null
  deleteError.value = ''
}

const deleteVehicle = async () => {
  if (!vehicleToDelete.value || isDeleting.value) return

  const vehicleId = vehicleToDelete.value.id
  isDeleting.value = true
  deleteError.value = ''

  try {
    if (shouldSyncWithApi.value && !vehicleId.startsWith('local-')) {
      await vehicleService.remove(vehicleId)
    }

    vehicles.value = vehicles.value.filter((vehicle) => vehicle.id !== vehicleId)
    vehicleError.value = ''
    deleteDialog.value?.close()
    vehicleToDelete.value = null
  } catch (err) {
    deleteError.value = getVehicleError(err, 'Failed to delete vehicle')
  } finally {
    isDeleting.value = false
  }
}

watch([isFormOpen, isConfirmationOpen], async () => {
  await nextTick()

  if (!isFormOpen.value || isConfirmationOpen.value) formDialog.value?.close()
  if (!isConfirmationOpen.value) confirmationDialog.value?.close()

  if (isConfirmationOpen.value && !confirmationDialog.value?.open) {
    confirmationDialog.value?.showModal()
  } else if (isFormOpen.value && !isConfirmationOpen.value && !formDialog.value?.open) {
    formDialog.value?.showModal()
  }
})

watch(
  [ownerId, shouldSyncWithApi],
  () => {
    loadVehicles()
  },
  { immediate: true },
)
</script>

<style scoped>
.vehicle-page {
  min-height: calc(100vh - 78px);
  margin-left: 138px;
  background: #d9d9d9;
  color: #111;
  padding: 0 6px 24px;
}

.vehicle-tabs {
  min-height: 53px;
  display: flex;
  align-items: flex-start;
  background: #fff;
}

.tab-button {
  min-width: 118px;
  height: 53px;
  border: 1px solid #a9a9a9;
  border-radius: 5px;
  background: #fff;
  color: #9c9c9c;
  padding: 0 18px;
  font-size: 16px;
  font-weight: 700;
}

.tab-button.is-active {
  background: #fdeceb;
  color: #9e2d25;
}

.vehicle-panel,
.history-panel {
  position: relative;
  width: min(1270px, calc(100vw - 210px));
  min-height: 690px;
  margin: 81px auto 0;
  border: 3px solid #1198f4;
  border-radius: 27px;
  background: #f7f7f7;
  padding: 61px 72px;
}

.vehicle-panel {
  display: grid;
  grid-template-columns: minmax(280px, 448px) 1fr;
  align-items: start;
  gap: 72px;
}

.vehicle-card {
  position: relative;
  width: min(448px, 100%);
  min-height: 368px;
  border-radius: 10px;
  background: #fff;
  padding: 34px 48px 30px;
  box-shadow: 0 7px 11px rgba(0, 0, 0, 0.2);
}

.panel-state {
  width: min(448px, 100%);
  min-height: 96px;
  border-radius: 10px;
  background: #fff;
  color: #8a8a8a;
  display: grid;
  place-items: center;
  padding: 18px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 7px 11px rgba(0, 0, 0, 0.12);
}

.panel-state.error {
  color: #9e2d25;
  background: #fff5f4;
}

.card-actions {
  position: absolute;
  top: 13px;
  right: 16px;
  display: flex;
  gap: 12px;
}

.card-actions button {
  width: 28px;
  height: 28px;
  color: #202020;
  display: grid;
  place-items: center;
}

.vehicle-icon {
  width: 88px;
  height: 88px;
  margin: 0 auto 12px;
  color: #909090;
  display: block;
}

.vehicle-details {
  display: grid;
  gap: 19px;
  font-size: 17px;
  line-height: 1.18;
}

.vehicle-details div {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 20px;
}

.vehicle-details dt {
  text-align: right;
}

.vehicle-details dt::after {
  content: ':';
  float: right;
  margin-right: -12px;
}

.vehicle-details dd {
  min-width: 0;
  overflow-wrap: anywhere;
}

.add-vehicle {
  justify-self: center;
  align-self: start;
  width: 107px;
  height: 107px;
  margin-top: 106px;
  border: 1px solid #111;
  border-radius: 999px;
  background: #d9d9d9;
  color: #777;
  display: grid;
  place-items: center;
  transition:
    background 0.16s ease,
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.add-vehicle:hover {
  background: #ececec;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
}

.history-panel {
  display: grid;
  align-content: start;
  gap: 18px;
}

.history-card {
  min-height: 82px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 4px 9px rgba(0, 0, 0, 0.16);
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 16px 22px;
}

.history-icon {
  width: 34px;
  height: 34px;
  color: #9e2d25;
}

.history-card strong {
  font-size: 17px;
}

.history-card p {
  color: #747474;
  font-size: 14px;
}

.history-card span {
  border-radius: 999px;
  background: #e9f9ef;
  color: #168d4e;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 800;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(24, 24, 24, 0.12);
  backdrop-filter: blur(1px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.type-picker {
  position: relative;
  width: min(543px, 100%);
  border-radius: 5px;
  background: #fff;
  padding: 18px 16px 25px;
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.18);
}

.type-close {
  position: absolute;
  left: 16px;
  top: 55px;
  z-index: 1;
  width: 38px;
  height: 38px;
  color: #202020;
  display: grid;
  place-items: center;
}

.type-picker h2 {
  color: #8b8b8b;
  font-size: 27px;
  font-weight: 400;
  line-height: 1.15;
  text-align: center;
}

.type-options {
  min-height: 263px;
  margin-top: 6px;
  background: #d9d9d9;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 52px;
  padding: 24px 52px 30px;
}

.type-option {
  display: grid;
  justify-items: center;
  gap: 14px;
  color: #111;
  font-size: 29px;
  line-height: 1;
}

.type-icon-frame {
  width: 158px;
  height: 158px;
  border: 2px solid #ababab;
  border-radius: 999px;
  background: #fff;
  display: grid;
  place-items: center;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.type-option:hover .type-icon-frame,
.type-option.is-selected .type-icon-frame {
  border-color: #1198f4;
  box-shadow: 0 0 0 4px rgba(17, 152, 244, 0.14);
  transform: translateY(-1px);
}

.type-icon {
  width: 100px;
  height: 100px;
  color: #8f8f8f;
}

.motor-type-icon {
  width: 103px;
  height: 103px;
}

.confirm-type {
  width: 91px;
  height: 42px;
  margin: 14px auto 0;
  border-radius: 6px;
  background: #1ed760;
  color: #111;
  display: grid;
  place-items: center;
  font-size: 14px;
  box-shadow: 0 4px 7px rgba(0, 0, 0, 0.22);
}

.confirm-type:hover {
  background: #28e46b;
}

.vehicle-form-dialog {
  position: fixed;
  inset: 131px 0 24px 138px;
  width: min(440px, calc(100vw - 170px));
  height: min(660px, calc(100dvh - 155px));
  max-height: calc(100dvh - 155px);
  margin: auto;
  border: 0;
  border-radius: 3px;
  background: #fff;
  padding: 0;
  color: #111;
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.28);
}

.vehicle-form-dialog::backdrop,
.vehicle-confirmation::backdrop {
  background: transparent;
}

.vehicle-form {
  min-height: 100%;
  padding: 0 22px 28px;
}

.form-fields {
  min-width: 0;
  margin: 22px 0 0;
  padding: 0;
  border: 0;
  display: grid;
  gap: 16px;
}

.form-header {
  position: relative;
  min-height: 62px;
  border-bottom: 1px solid #e7e7e7;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-header h2 {
  padding: 0 38px;
  color: #929292;
  font-size: 24px;
  font-weight: 400;
  text-align: center;
}

.form-header button {
  position: absolute;
  left: -4px;
  width: 34px;
  height: 34px;
  color: #929292;
  display: grid;
  place-items: center;
}

.vehicle-form label {
  display: grid;
  gap: 6px;
  color: #5f5f5f;
  font-size: 13px;
  font-weight: 400;
}

.vehicle-form input,
.vehicle-form select {
  width: 100%;
  min-width: 0;
  height: 42px;
  border: 1px solid #d8d8d8;
  border-radius: 8px;
  background: #f0f0f0;
  padding: 0 12px;
  color: #5f5f5f;
  font: inherit;
  font-size: 14px;
  outline: none;
}

.vehicle-form input::placeholder {
  color: #a3a3a3;
  opacity: 1;
}

.vehicle-form input:focus,
.vehicle-form select:focus {
  border-color: #1198f4;
  box-shadow: 0 0 0 3px rgba(17, 152, 244, 0.18);
}

.save-button {
  display: block;
  width: 104px;
  height: 40px;
  margin: 26px auto 0;
  border-radius: 5px;
  background: #1ed760;
  color: #111;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.25);
}

.save-button:hover:not(:disabled) {
  background: #28e46b;
}

.vehicle-form button:disabled,
.vehicle-confirmation button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.form-error {
  margin-top: 14px;
  color: #b42318;
  font-size: 13px;
  text-align: center;
  overflow-wrap: anywhere;
}

.vehicle-confirmation {
  position: fixed;
  inset: 78px 0 0 138px;
  width: min(340px, calc(100vw - 170px));
  max-height: calc(100dvh - 110px);
  margin: auto;
  padding: 0;
  border: 0;
  border-radius: 20px;
  background: #fff;
  color: #111;
  box-shadow: 3px 4px 4px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.confirmation-content {
  padding: 16px 18px 14px;
}

.confirmation-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: #ffe500;
  color: #000;
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.vehicle-confirmation h2 {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.15;
}

.confirmation-vehicle {
  margin-top: 10px;
  color: #5f5f5f;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.confirmation-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-top: 12px;
}

.confirmation-actions button {
  min-width: 102px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.25);
}

.confirmation-yes {
  background: #009ff5;
}

.confirmation-cancel {
  background: #ed2e36;
}

.vehicle-form button:focus-visible,
.confirmation-actions button:focus-visible {
  outline: 2px solid #1198f4;
  outline-offset: 3px;
}

@media (max-width: 900px) {
  .vehicle-page {
    margin-left: 138px;
  }

  .vehicle-panel,
  .history-panel {
    width: min(760px, calc(100vw - 172px));
    min-height: auto;
    margin-top: 36px;
    padding: 34px 28px;
  }

  .vehicle-panel {
    grid-template-columns: 1fr;
    gap: 34px;
  }

  .vehicle-card {
    justify-self: center;
  }

  .add-vehicle {
    margin-top: 0;
  }
}

@media (max-width: 620px) {
  .vehicle-form-dialog,
  .vehicle-confirmation {
    inset: 16px;
    max-width: calc(100vw - 32px);
    max-height: calc(100dvh - 32px);
  }

  .vehicle-form-dialog {
    width: 440px;
    height: min(660px, calc(100dvh - 32px));
  }

  .vehicle-confirmation {
    width: 340px;
  }

  .vehicle-page {
    margin-left: 0;
    padding: 0 10px 24px;
  }

  .vehicle-panel,
  .history-panel {
    width: 100%;
    border-radius: 18px;
    padding: 24px 14px;
  }

  .vehicle-card {
    padding: 34px 20px 28px;
  }

  .vehicle-details {
    font-size: 15px;
  }

  .vehicle-details div {
    grid-template-columns: 102px 1fr;
    gap: 16px;
  }

  .type-picker {
    padding: 18px 12px 23px;
  }

  .type-close {
    top: 47px;
  }

  .type-options {
    min-height: auto;
    gap: 18px;
    padding: 22px 18px 28px;
  }

  .type-icon-frame {
    width: 128px;
    height: 128px;
  }

  .type-icon {
    width: 82px;
    height: 82px;
  }

  .type-option {
    font-size: 24px;
  }
}
</style>
