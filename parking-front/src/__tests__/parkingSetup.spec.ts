import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardView from '@/views/admin/DashboardView.vue'
import { buildingService, floorService } from '@/services/api'

vi.mock('@/services/api', () => ({
  buildingService: { list: vi.fn(), cameraSummaries: vi.fn(), imageUrl: () => '', remove: vi.fn() },
  floorService: { list: vi.fn(), remove: vi.fn() },
}))

let wrapper: VueWrapper
const building = { _id: 'b1', building_name: 'B6', building_image: null, date_add: '', time_add: '' }
const floors = [1, 2].map((floor) => ({
  _id: `f${floor}`, building, floor, veh_type: 'car' as const, zone: floor,
  parking_slot_file: floor === 2 ? 'map.json' : null,
  status: 'available' as const, date_add: '', time_add: '',
}))
async function openSetup() {
  localStorage.clear()
  vi.mocked(buildingService.list).mockResolvedValue({ data: { buildings: [building] } } as never)
  vi.mocked(buildingService.cameraSummaries).mockResolvedValue({ data: { summaries: {} } } as never)
  vi.mocked(floorService.list).mockResolvedValue({ data: { floors } } as never)
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/admin/setup', component: DashboardView },
    { path: '/admin/maps/:floorId', name: 'AdminParkingMap', component: { template: '<div />' } },
  ] })
  await router.push('/admin/setup')
  wrapper = mount(DashboardView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  await wrapper.get('[aria-label="View floors for B6"]').trigger('click')
}
afterEach(() => { wrapper?.unmount(); vi.clearAllMocks() })

describe('admin parking setup floor actions', () => {
  it('marks only floors with maps green and opens CCTV with the selected location', async () => {
    await openSetup()
    const maps = wrapper.findAll('.floor-parking-map')
    expect(maps[0]!.classes()).not.toContain('has-map')
    expect(maps[1]!.classes()).toContain('has-map')
    await wrapper.get('[aria-label="CCTV for floor 2 (Cars)"]').trigger('click')
    expect(wrapper.get('.cctv-heading').text()).toBe('B6 : Floor 2 CCTV')
    expect(wrapper.find('.cctv-location-filters').exists()).toBe(false)
    expect(wrapper.get('.slot-files-panel').text()).toContain('No parking slot files imported')
    await wrapper.get('.cctv-map-button').trigger('click')
    await flushPromises()
    expect(wrapper.vm.$route.params.floorId).toBe('f2')
  })

  it('requires confirmation, retains a failed deletion, and allows retry', async () => {
    await openSetup()
    await wrapper.get('[aria-label="Delete floor 1 (Cars)"]').trigger('click')
    expect(floorService.remove).not.toHaveBeenCalled()
    vi.mocked(floorService.remove).mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('[role="alertdialog"] .red-button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('Failed to delete floor.')
    expect(wrapper.findAll('.floor-row')).toHaveLength(2)
    vi.mocked(floorService.remove).mockResolvedValueOnce({} as never)
    await wrapper.get('[role="alertdialog"] .red-button').trigger('click')
    await flushPromises()
    expect(floorService.remove).toHaveBeenLastCalledWith('f1')
    expect(wrapper.findAll('.floor-row')).toHaveLength(1)
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
  })
})
