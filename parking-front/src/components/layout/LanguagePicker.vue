<template>
  <label class="language-picker">
    <Languages :size="17" aria-hidden="true" />
    <select :value="language" :aria-label="t('Language')" @change="changeLanguage">
      <option value="th" lang="th">ไทย</option>
      <option value="en" lang="en">English</option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { Languages } from 'lucide-vue-next'
import { language, setLanguage, t } from '@/i18n'

function changeLanguage(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'th' || value === 'en') setLanguage(value)
}
</script>

<style scoped>
.language-picker {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 7px;
  padding: 7px 9px;
  border: 1px solid #dbe2eb;
  border-radius: 7px;
  background: white;
  color: #334155;
  font-size: 13px;
}

.language-picker select {
  cursor: pointer;
}

.language-picker select:focus-visible {
  outline: 2px solid #334155;
  outline-offset: 2px;
}

@media (max-width: 540px) {
  .language-picker {
    padding-inline: 5px;
  }
  .language-picker svg {
    display: none;
  }
}
</style>
