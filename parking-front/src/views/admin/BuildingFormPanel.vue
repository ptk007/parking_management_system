<template>
  <form class="overlay-card building-form" @submit.prevent="saveBuilding">
    <button
      class="close-x"
      type="button"
      aria-label="Close building form"
      :disabled="isSaving"
      @click="$emit('cancel')"
    >
      <X class="h-7 w-7" :stroke-width="3" />
    </button>

    <h2>{{ mode === 'add' ? 'Add Building' : 'Edit Building' }}</h2>
    <img v-if="imagePreview" class="building-preview" :src="imagePreview" alt="Building preview" />
    <div v-else class="building-preview building-preview-empty">No image selected</div>

    <label class="building-field">
      <span>Building Name</span>
      <input v-model.trim="buildingName" class="building-name-input" type="text" required :disabled="isSaving" />
    </label>
    <label class="building-field">
      <span>Building Image</span>
      <input
        class="image-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="isSaving"
        @change="selectImage"
      />
      <small>JPG, PNG or WebP (up to 5 MB)</small>
    </label>

    <p v-if="error" class="building-error" role="alert">{{ error }}</p>
    <button :class="mode === 'add' ? 'green-button' : 'blue-button'" type="submit" :disabled="isSaving">
      {{ isSaving ? 'Saving...' : 'Confirm' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { isAxiosError } from 'axios'
import { X } from 'lucide-vue-next'
import { buildingService, type ParkingBuilding } from '@/services/api'

const props = defineProps<{ mode: 'add' | 'edit'; building?: ParkingBuilding | null }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()

const buildingName = ref(props.building?.building_name ?? '')
const selectedImage = ref<File | null>(null)
const previewUrl = ref('')
const error = ref('')
const isSaving = ref(false)
const imagePreview = computed(
  () => previewUrl.value || buildingService.imageUrl(props.building?.building_image ?? null),
)

const clearPreview = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

onUnmounted(clearPreview)

const selectImage = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  clearPreview()
  selectedImage.value = null
  error.value = ''
  if (!file) return

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    error.value = 'Choose a JPG, PNG or WebP image up to 5 MB.'
    input.value = ''
    return
  }

  selectedImage.value = file
  previewUrl.value = URL.createObjectURL(file)
}

const saveBuilding = async () => {
  const name = buildingName.value.trim()
  if (!name || isSaving.value) return
  if (props.mode === 'edit' && !props.building) {
    error.value = 'Building not found.'
    return
  }

  error.value = ''
  isSaving.value = true
  const data = new FormData()
  data.append('building_name', name)
  if (selectedImage.value) data.append('building_image', selectedImage.value)

  try {
    if (props.mode === 'edit' && props.building) {
      await buildingService.update(props.building._id, data)
    } else {
      await buildingService.create(data)
    }
    emit('saved')
  } catch (cause) {
    error.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Failed to save building.'
      : 'Failed to save building.'
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.building-form {
  gap: 14px;
  padding-top: 22px;
}

.building-form h2 {
  margin-bottom: 2px;
}

.building-preview {
  width: 176px;
  height: 132px;
  border-radius: 4px;
  object-fit: cover;
}

.building-preview-empty {
  display: grid;
  place-items: center;
  border: 1px dashed #b7b7b7;
  background: #f1f1f1;
  color: #777;
  font-size: 13px;
}

.building-form .building-field {
  width: 100%;
  max-width: 300px;
  font-size: 14px;
}

.building-form .building-name-input,
.building-form .image-input {
  width: 100%;
  min-height: 36px;
}

.building-form .image-input {
  padding: 5px;
}

.building-field small {
  color: #666;
  font-size: 12px;
}

.building-error {
  color: #b42318;
  font-size: 13px;
  text-align: center;
}
</style>
