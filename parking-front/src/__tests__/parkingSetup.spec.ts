import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DashboardView from '@/views/admin/DashboardView.vue'
import { buildingService, floorService } from '@/services/api'

vi.mock('@/services/api', () => ({
  buildingService: { list: vi.fn(), cameraSummaries: vi.fn(), imageUrl: () => '', remove: vi.fn() },
  floorService: {
    list: vi.fn(),
    remove: vi.fn(),
    sourceFiles: vi.fn().mockResolvedValue({ data: { files: [] } }),
  },
}))

let wrapper: VueWrapper
const building = {
  _id: 'b1',
  building_name: 'B6',
  building_image: null,
  date_updated: '2026-11-02',
  time_updated: '10:15:00',
}
const floors = [1, 2].map((floor) => ({
  _id: `f${floor}`,
  building,
  floor,
  veh_type: 'car' as const,
  parking_slot_file: floor === 2 ? 'map.json' : null,
  status: 'Available' as const,
  date_updated: '',
  time_updated: '',
}))
async function openSetup() {
  localStorage.clear()
  vi.mocked(buildingService.list).mockResolvedValue({ data: { buildings: [building] } } as never)
  vi.mocked(buildingService.cameraSummaries).mockResolvedValue({
    data: {
      summaries: {},
      floorSummaries: {
        f1: { total: 1, online: 1, offline: 0, disabled: 0, unknown: 0 },
        f2: { total: 0, online: 0, offline: 0, disabled: 0, unknown: 0 },
      },
    },
  } as never)
  vi.mocked(floorService.list).mockResolvedValue({ data: { floors } } as never)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/setup', component: DashboardView },
      { path: '/admin/maps/:floorId', name: 'AdminParkingMap', component: { template: '<div />' } },
    ],
  })
  await router.push('/admin/setup')
  wrapper = mount(DashboardView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
  await wrapper.get('[aria-label="View floors for B6"]').trigger('click')
}
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
})

describe('admin parking setup floor actions', () => {
  it('marks only floors with maps green and opens CCTV with the selected location', async () => {
    await openSetup()
    expect(wrapper.get('.building-row').text()).toContain('Date Updated : 2026-11-02')
    expect(wrapper.get('.building-row').text()).toContain('Time Updated : 10:15:00')
    const floorDetails = wrapper.get('.floor-row .setup-copy').findAll('p')
    expect(floorDetails).toHaveLength(3)
    expect(floorDetails[0]!.text()).toContain('Floor : 1')
    expect(floorDetails[1]!.text()).toContain('Date Updated :')
    expect(floorDetails[2]!.text()).toContain('Time Updated :')
    const maps = wrapper.findAll('.floor-parking-map')
    const floorCctvSummaries = wrapper.findAll('.floor-row .building-camera-summary')
    expect(floorCctvSummaries).toHaveLength(2)
    expect(floorCctvSummaries[0]!.text()).toContain('1 camera')
    expect(floorCctvSummaries[0]!.text()).toContain('Online 1')
    expect(floorCctvSummaries[1]!.text()).toContain('No cameras assigned')
    expect(maps[0]!.classes()).not.toContain('has-map')
    expect(maps[1]!.classes()).toContain('has-map')
    await wrapper.get('[aria-label="CCTV for floor 2 (Cars)"]').trigger('click')
    expect(wrapper.get('.cctv-heading').text()).toBe('B6 : Floor 2 CCTV')
    expect(wrapper.find('.cctv-location-filters').exists()).toBe(false)
    expect(wrapper.get('.slot-files-panel').text()).toContain(
      'No original CCTV source files imported',
    )
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
