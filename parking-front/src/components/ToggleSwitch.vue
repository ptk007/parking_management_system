<template>
  <button
    class="toggle-switch"
    :class="{ checked }"
    type="button"
    role="switch"
    :aria-checked="checked"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('toggle')"
  >
    <span class="toggle-switch-thumb" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  checked: boolean
  disabled?: boolean
  label: string
}>()

defineEmits<{
  toggle: []
}>()
</script>

<style scoped>
.toggle-switch {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  box-sizing: border-box;
  width: 48px;
  height: 28px;
  vertical-align: middle;
  padding: 0;
  border: 1px solid #9ca3af;
  border-radius: 999px;
  background: #9ca3af;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.toggle-switch.checked {
  border-color: #25a244;
  background: #25a244;
}

.toggle-switch:focus-visible {
  outline: 3px solid rgb(37 162 68 / 28%);
  outline-offset: 2px;
}

.toggle-switch:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.toggle-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  display: block;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 25%);
  transition: left 0.16s ease;
}

.toggle-switch.checked .toggle-switch-thumb {
  left: 22px;
}
</style>
