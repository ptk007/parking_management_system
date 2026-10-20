import { afterEach, describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import DashboardView from '@/views/staff/DashboardView.vue'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types'

const wrappers: VueWrapper[] = []

const createDashboard = (role?: UserRole | 'guest') => {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)

  if (role === 'guest') {
    auth.loginGuest()
  } else if (role) {
    auth.token = 'parking-permissions-test'
    auth.user = {
      _id: 'test-user',
      id: 'test-user',
      username: 'test-user',
      name: 'Test User',
      fullName: 'Test User',
      role,
      status: 'online',
    }
  }

  const wrapper = mount(DashboardView, { global: { plugins: [pinia] } })
  wrappers.push(wrapper)
  return { wrapper, auth }
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  localStorage.clear()
})

describe('parking permissions', () => {
  it.each([undefined, 'user', 'guest'] as const)(
    'keeps the parking map read-only for %s',
    async (role) => {
      const { wrapper } = createDashboard(role)
      const slots = wrapper.findAll<HTMLButtonElement>('.slot-cell')

      expect(wrapper.get('.tabbar').text()).toBe('Slots')
      expect(wrapper.find('.map-actions').exists()).toBe(false)
      expect(wrapper.find('.cctv-grid').exists()).toBe(false)
      expect(wrapper.find('.logs-panel').exists()).toBe(false)
      expect(wrapper.findAll('.stat-card')).toHaveLength(5)
      expect(wrapper.findAll('.status-legend span')).toHaveLength(4)
      expect(slots).toHaveLength(124)
      expect(slots.every((slot) => slot.element.disabled)).toBe(true)

      // Removing the DOM restriction must not bypass the click handler's role check.
      const availableSlot = wrapper.get<HTMLButtonElement>('.slot-cell.available')
      availableSlot.element.disabled = false
      await availableSlot.trigger('click')
      expect(wrapper.findAll('.slot-cell.selected')).toHaveLength(0)
    },
  )

  it.each(['staff', 'admin'] as const)(
    'preserves parking controls, CCTV, and logs for %s',
    async (role) => {
      const { wrapper } = createDashboard(role)
      const availableSlot = wrapper.get<HTMLButtonElement>('.slot-cell.available')

      expect(availableSlot.element.disabled).toBe(false)
      expect(wrapper.get<HTMLButtonElement>('.slot-cell.occupied').element.disabled).toBe(true)
      await availableSlot.trigger('click')
      expect(wrapper.get('.map-actions').text()).toContain('Selected: 1')
      await wrapper.get('.action-button.disable').trigger('click')
      expect(availableSlot.classes()).toContain('disabled')
      await availableSlot.trigger('click')
      await wrapper.get('.action-button.enable').trigger('click')
      expect(availableSlot.classes()).toContain('available')

      await wrapper
        .findAll('.tab-button')
        .find((button) => button.text() === 'CCTV')!
        .trigger('click')
      expect(wrapper.find('.cctv-grid').exists()).toBe(true)
      await wrapper
        .findAll('.tab-button')
        .find((button) => button.text() === 'Log')!
        .trigger('click')
      expect(wrapper.find('.logs-panel').exists()).toBe(true)
    },
  )

  it('clears selections and closes restricted tabs when the role changes to User', async () => {
    const { wrapper, auth } = createDashboard('staff')
    await wrapper.get('.slot-cell.available').trigger('click')
    expect(wrapper.findAll('.slot-cell.selected')).toHaveLength(1)

    auth.user!.role = 'user'
    await nextTick()
    expect(wrapper.findAll('.slot-cell.selected')).toHaveLength(0)
    expect(wrapper.find('.map-actions').exists()).toBe(false)

    for (const tab of ['CCTV', 'Log']) {
      auth.user!.role = 'staff'
      await nextTick()
      await wrapper
        .findAll('.tab-button')
        .find((button) => button.text() === tab)!
        .trigger('click')

      auth.user!.role = 'user'
      await nextTick()
      expect(wrapper.get('.tabbar').text()).toBe('Slots')
      expect(wrapper.find('.scene-board').exists()).toBe(true)
      expect(wrapper.find('.cctv-grid').exists()).toBe(false)
      expect(wrapper.find('.logs-panel').exists()).toBe(false)
    }
  })

  it('does not grant staff controls to an unauthenticated or disabled account', async () => {
    const { wrapper, auth } = createDashboard('staff')
    auth.token = ''
    await nextTick()
    expect(wrapper.find('.map-actions').exists()).toBe(false)
    expect(wrapper.get('.tabbar').text()).toBe('Slots')

    auth.token = 'parking-permissions-test'
    auth.user!.status = 'disable'
    await nextTick()
    expect(wrapper.find('.map-actions').exists()).toBe(false)
    expect(wrapper.get('.tabbar').text()).toBe('Slots')
  })
})
