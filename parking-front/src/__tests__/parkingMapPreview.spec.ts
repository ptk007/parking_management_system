import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ParkingMapView from '@/views/admin/ParkingMapView.vue'
import { floorService } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { createPreviewSlots, restorePreviewDraft } from '@/components/parking/parkingMapPreview'

vi.mock('@/services/api', () => ({ floorService: { list: vi.fn() } }))
const wrappers: VueWrapper[] = []
const floors = ['floor-one', 'floor-two'].map((_id, index) => ({
  _id, floor: index, veh_type: 'car', building: { building_name: `Building ${index}` },
}))

async function createPage(id = 'floor-one') {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.token = 'preview-test'
  auth.user = { _id: 'admin-test', id: 'admin-test', username: 'admin', name: 'Admin', fullName: 'Admin', role: 'admin', status: 'online' }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/floor/:floorId', component: ParkingMapView },
    { path: '/admin/setup', component: { template: '<div>Setup</div>' } },
  ] })
  await router.push(`/floor/${id}`)
  const wrapper = mount(ParkingMapView, { global: { plugins: [pinia, router] } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router, auth }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(floorService.list).mockResolvedValue({ data: { floors } } as never)
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('standalone Parking Map preview', () => {
  it('shows the chosen floor and combines zone, search and status filters', async () => {
    const { wrapper } = await createPage()
    expect(wrapper.get('.floor-context').text()).toContain('Building 0 / Floor 0 / Cars')
    expect(wrapper.findAll('.parking-tile')).toHaveLength(26)
    await wrapper.get('input[type="search"]').setValue('004')
    expect(wrapper.findAll('.parking-tile')).toHaveLength(1)
    expect(wrapper.get('.parking-tile').attributes('data-slot')).toBe('4')
    await wrapper.get('select').setValue('available')
    expect(wrapper.find('.empty-results').exists()).toBe(true)
    await wrapper.get('.empty-results button').trigger('click')
    expect(wrapper.findAll('.parking-tile')).toHaveLength(124)
  })

  it('inspects occupied slots without selecting them or allowing changes', async () => {
    const { wrapper } = await createPage()
    await wrapper.get('[data-slot="4"]').trigger('click')
    expect(wrapper.get('.slot-preview').text()).toContain('Occupied')
    expect(wrapper.get('.details-heading').text()).toContain('0 selected')
    expect(wrapper.get<HTMLButtonElement>('.disable-button').element.disabled).toBe(true)
    expect(wrapper.get<HTMLButtonElement>('.enable-button').element.disabled).toBe(true)
  })

  it('updates multiple editable slots and restores drafts only for the same floor', async () => {
    const { wrapper, router } = await createPage()
    await wrapper.get('[data-slot="1"]').trigger('click')
    await wrapper.get('[data-slot="2"]').trigger('click')
    await wrapper.get('.disable-button').trigger('click')
    expect(wrapper.get('[data-slot="1"]').classes()).toContain('disabled')
    expect(wrapper.get('[data-slot="2"]').classes()).toContain('disabled')
    expect(wrapper.get('.save-message').text()).toContain('Preview saved')
    await router.push('/floor/floor-two')
    await flushPromises()
    expect(wrapper.get('[data-slot="1"]').classes()).toContain('available')
    expect(wrapper.get('.details-heading').text()).toContain('0 selected')
    await router.push('/floor/floor-one')
    await flushPromises()
    expect(wrapper.get('[data-slot="1"]').classes()).toContain('disabled')
    await wrapper.get('[data-slot="1"]').trigger('click')
    await wrapper.get('.enable-button').trigger('click')
    expect(wrapper.get('[data-slot="1"]').classes()).toContain('available')
    expect(createPreviewSlots().find(slot => slot.number === 1)?.status).toBe('available')
  })

  it('reports storage failures without claiming the draft was saved', async () => {
    const { wrapper } = await createPage()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full') })
    await wrapper.get('[data-slot="1"]').trigger('click')
    await wrapper.get('.disable-button').trigger('click')
    expect(wrapper.get('.save-message.failed').text()).toContain('Could not save')
  })

  it('handles failed requests and missing floors without showing a misleading map', async () => {
    vi.mocked(floorService.list).mockRejectedValueOnce(new Error('Offline'))
    const { wrapper } = await createPage('missing')
    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to load')
    await wrapper.get('.page-state button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Floor not found')
    expect(wrapper.find('.pos-workspace').exists()).toBe(false)
  })

  it('does not restore draft changes over occupied sample slots', () => {
    const restored = restorePreviewDraft(JSON.stringify({ version: 1, statuses: { 4: 'available', 1: 'disabled' } }))
    expect(restored.find(slot => slot.number === 4)?.status).toBe('occupied')
    expect(restored.find(slot => slot.number === 1)?.status).toBe('disabled')
  })
})
