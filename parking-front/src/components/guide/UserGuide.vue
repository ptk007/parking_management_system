<template>
  <button
    type="button"
    class="guide-launcher"
    :aria-label="t('Open guide')"
    :title="t('Guide')"
    aria-haspopup="dialog"
    aria-controls="user-guide"
    @click="openGuide"
  >
    <BookOpen :size="17" aria-hidden="true" />
    <span>{{ t('Guide') }}</span>
  </button>

  <dialog
    id="user-guide"
    ref="dialog"
    class="guide-dialog"
    aria-labelledby="user-guide-title"
    @click.self="closeGuide"
  >
    <header class="guide-header">
      <span class="guide-header-icon"><BookOpen :size="24" aria-hidden="true" /></span>
      <h2 id="user-guide-title">{{ t(['{role} guide', { role: t(guide.roleLabel) }]) }}</h2>
      <button
        type="button"
        class="guide-dismiss"
        :aria-label="t('Close guide')"
        autofocus
        @click="closeGuide"
      >
        <X :size="21" aria-hidden="true" />
      </button>
    </header>

    <ul class="guide-steps">
      <li v-for="step in guide.steps" :key="step.title" class="guide-step">
        <span class="guide-step-icon"><component :is="step.icon" :size="22" aria-hidden="true" /></span>
        <div>
          <h3>{{ t(step.title) }}</h3>
          <p>{{ t(step.description) }}</p>
          <ol class="guide-path">
            <li v-for="(label, index) in step.path" :key="label">
              <ChevronRight v-if="index" :size="13" aria-hidden="true" />
              <span>{{ t(label) }}</span>
            </li>
          </ol>
        </div>
      </li>
    </ul>

    <footer class="guide-footer">
      <p>{{ t('You can open this guide again anytime from the Guide button.') }}</p>
      <button type="button" @click="closeGuide">{{ t('Close') }}</button>
    </footer>
  </dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BookOpen, ChevronRight, X } from 'lucide-vue-next'
import { t } from '@/i18n'
import { roleGuides, type GuideRole } from './guideContent'

const props = defineProps<{
  role: GuideRole
  accountId: string
  openOnSignIn: boolean
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const guide = computed(() => roleGuides[props.role])
const storageKey = computed(() => `parking:guide-seen:${props.role}:${props.accountId}`)

function openGuide() {
  if (!dialog.value || dialog.value.open) return
  dialog.value.showModal()
  try {
    localStorage.setItem(storageKey.value, 'true')
  } catch {
    // The guide remains usable when the browser blocks storage.
  }
}

function closeGuide() {
  dialog.value?.close()
}

onMounted(() => {
  if (!props.openOnSignIn) return
  try {
    if (localStorage.getItem(storageKey.value) === 'true') return
  } catch {
    // Open the guide even when the browser blocks storage.
  }
  openGuide()
})
</script>

<style scoped>
.guide-launcher {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 2px;
  pointer-events: auto;
  cursor: pointer;
  border: 1px solid #ffffff66;
  border-radius: 50%;
  background: #fff6f3;
  color: #8e2c34;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 3px 10px #752a2845;
}

.guide-launcher:hover {
  background: #fff;
}

.guide-dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(660px, calc(100vw - 24px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 16px;
  background: #fff;
  color: #273548;
  pointer-events: auto;
  box-shadow: 0 20px 70px #20192340;
}

.guide-dialog[open] {
  display: flex;
  flex-direction: column;
}

.guide-dialog::backdrop {
  background: #231d29a3;
}

.guide-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #9c302d;
  color: #fff;
}

.guide-header-icon,
.guide-step-icon {
  flex: 0 0 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 10px;
}

.guide-header-icon {
  background: #ffffff26;
}

.guide-header h2 {
  flex: 1;
  margin: 0;
  font-size: 21px;
  font-weight: 700;
}

.guide-dismiss {
  flex: 0 0 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #fff;
  background: #ffffff26;
  cursor: pointer;
}

.guide-steps {
  flex: 0 1 auto;
  min-height: 0;
  margin: 0;
  padding: 14px 20px;
  overflow: auto;
  overscroll-behavior: contain;
  list-style: none;
}

.guide-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e8e9ee;
}

.guide-step:last-child {
  border-bottom: 0;
}

.guide-step > div {
  min-width: 0;
}

.guide-step-icon {
  background: #f9ece8;
  color: #902f34;
}

.guide-step h3 {
  margin: 0 0 3px;
  font-size: 16px;
  font-weight: 700;
}

.guide-step p,
.guide-footer p {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 1.5;
}

.guide-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin: 7px 0 0;
  padding: 0;
  list-style: none;
}

.guide-path li {
  display: flex;
  align-items: center;
  gap: 5px;
}

.guide-path span {
  padding: 3px 7px;
  border: 1px solid #e0e4ec;
  border-radius: 5px;
  background: #f4f6fa;
  color: #3b4b64;
  font-size: 12px;
  font-weight: 600;
}

.guide-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 20px;
  border-top: 1px solid #e8e9ee;
  background: #fbfbfd;
}

.guide-footer p {
  font-size: 12px;
}

.guide-footer button {
  flex-shrink: 0;
  padding: 7px 15px;
  border-radius: 7px;
  background: #9c302d;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.guide-footer button:hover {
  background: #812723;
}

.guide-launcher:focus-visible,
.guide-dialog button:focus-visible {
  outline: 2px solid #75a5e6;
  outline-offset: 3px;
}

@media (max-width: 540px) {
  .guide-header,
  .guide-steps,
  .guide-footer {
    padding-inline: 14px;
  }
}
</style>
