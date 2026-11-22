<template>
  <div class="dated-log-list">
    <section v-for="group in groups" :key="group.date" class="log-day">
      <component :is="headingLevel" class="log-day-heading">
        <time v-if="group.date" :datetime="group.date">{{ displayDate(group.date) }}</time>
        <template v-else>Date unavailable</template>
      </component>
      <div class="log-day-records">
        <slot :entries="group.entries" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    entries: readonly T[]
    getDate: (entry: T) => string | null | undefined
    headingLevel?: 'h2' | 'h3'
  }>(),
  { headingLevel: 'h2' },
)

defineSlots<{
  default(props: { entries: T[] }): unknown
}>()

function dateKey(value: string | null | undefined) {
  const date = value?.trim() ?? ''
  // The API supplies Bangkok calendar dates. Keep them independent of the browser time zone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  const legacyDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date)
  return legacyDate ? `${legacyDate[3]}-${legacyDate[2]}-${legacyDate[1]}` : ''
}

function displayDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

const groups = computed(() => {
  const byDate = new Map<string, T[]>()
  for (const entry of props.entries) {
    const date = dateKey(props.getDate(entry))
    const entries = byDate.get(date)
    if (entries) entries.push(entry)
    else byDate.set(date, [entry])
  }

  return Array.from(byDate, ([date, entries]) => ({ date, entries })).sort((a, b) =>
    b.date.localeCompare(a.date),
  )
})
</script>

<style scoped>
.dated-log-list,
.log-day-records {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.log-day {
  min-width: 0;
  border: 1px solid #bcbcbc;
  border-radius: 8px;
  background: #f7f7f7;
  padding: clamp(10px, 2vw, 18px);
}

.log-day-heading {
  margin: 0 0 12px;
  color: #222;
  font-size: clamp(20px, 2vw, 24px);
  font-weight: 800;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
</style>
