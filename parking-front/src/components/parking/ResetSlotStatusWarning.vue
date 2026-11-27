<template>
  <span
    class="reset-warning"
    :tabindex="disabled ? 0 : undefined"
    :aria-describedby="disabled ? descriptionId : undefined"
    @keydown.esc="dismissed = true"
    @mouseleave="dismissed = false"
    @focusout="dismissed = false"
  >
    <slot :description-id="descriptionId" />
    <span :id="descriptionId" role="tooltip" class="reset-tooltip" :class="{ dismissed }">
      {{ t('Disable every CCTV preset on this floor before resetting parking slots') }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { t } from '@/i18n'

defineProps<{ disabled: boolean }>()
const descriptionId = useId()
const dismissed = ref(false)
</script>

<style scoped>
.reset-warning {
  position: relative;
  display: inline-flex;
  max-width: 100%;
}
:slotted(button:disabled) {
  pointer-events: none;
}
.reset-tooltip {
  position: absolute;
  inset-block-start: 100%;
  inset-inline-end: 0;
  z-index: 10;
  box-sizing: border-box;
  width: max-content;
  max-width: 100%;
  padding: 8px 10px;
  border: 1px solid #fdba74;
  border-radius: 6px;
  background: #fff7ed;
  color: #7c2d12;
  box-shadow: 0 4px 12px rgb(15 23 42 / 16%);
  font-size: 12px;
  line-height: 1.4;
  visibility: hidden;
}
.reset-warning:hover .reset-tooltip:not(.dismissed),
.reset-warning:focus-within .reset-tooltip:not(.dismissed) {
  visibility: visible;
}
</style>
