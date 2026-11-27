<template>
  <div class="redirect-screen">
    <div class="redirect-content">
      <p>{{ t('Redirecting to login...') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n'
import { useRouter } from 'vue-router'

const router = useRouter()

// Redirect to main login page
router.replace('/login')
</script>

<style scoped>
.redirect-screen {
  min-height: 100vh;
  background: #9f2f30;
  display: flex;
  align-items: center;
  justify-content: center;
}

.redirect-content {
  color: white;
  font-size: 16px;
}
</style>
