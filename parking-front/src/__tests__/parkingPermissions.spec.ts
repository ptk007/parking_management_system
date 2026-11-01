import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import DashboardView from '@/views/staff/DashboardView.vue'
import { useAuthStore } from '@/stores/auth'
import { floorService } from '@/services/api'
import { emptyParkingLayout } from '@/components/parking/parkingLayout'
import type { UserRole } from '@/types'
vi.mock('@/services/api', () => ({ floorService: { catalog: vi.fn(), setSlotStatuses: vi.fn() } }))
const map = {
  version: 2,
  sourceName: 'saved map',
  layout: emptyParkingLayout(),
  slots: [
    { number: 1, zone: 'default', status: 'available' },
    { number: 2, zone: 'default', status: 'occupied' },
  ],
}
const floors = [
  {
    _id: 'f1',
    building: { _id: 'b1', building_name: 'E4' },
    floor: 4,
    veh_type: 'car',
    parking_map: map,
  },
  {
    _id: 'f2',
    building: { _id: 'b2', building_name: 'E5' },
    floor: 1,
    veh_type: 'motorcycle',
    parking_map: null,
  },
]
const wrappers: VueWrapper[] = []
async function createDashboard(role?: UserRole | 'guest') {
  const pinia = createPinia(),
    auth = useAuthStore(pinia)
  if (role === 'guest') auth.loginGuest()
  else if (role) {
    auth.token = 'test'
    auth.user = {
      _id: 'test',
      id: 'test',
      username: 'test',
      name: 'Test',
      fullName: 'Test',
      role,
      status: 'online',
    }
  }
  const wrapper = mount(DashboardView, { global: { plugins: [pinia] } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, auth }
}
async function selectLocation(wrapper: VueWrapper, building = 'b1', floor = '4', vehicle = 'car') {
  if (!wrapper.find('.filter-overlay').exists())
    await wrapper.get('[aria-controls="map-filters"]').trigger('click')
  await wrapper.findAll('.filter-overlay select')[0]!.setValue(building)
  await wrapper.findAll('.filter-overlay select')[1]!.setValue(floor)
  await wrapper.findAll('.filter-overlay select')[2]!.setValue(vehicle)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(floorService.catalog).mockResolvedValue({ data: { floors } } as never)
})
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  localStorage.clear()
})
describe('dashboard parking locations and permissions', () => {
  it.each(['offline', 'empty', 'unmapped'] as const)(
    'shows the sample parking floor immediately when the catalog is %s',
    async (state) => {
      if (state === 'offline')
        vi.mocked(floorService.catalog).mockRejectedValueOnce(new Error('offline'))
      else
        vi.mocked(floorService.catalog).mockResolvedValueOnce({
          data: { floors: state === 'empty' ? [] : [floors[1]] },
        } as never)
      const { wrapper } = await createDashboard('user')
      expect(wrapper.get('.sample-badge').text()).toBe('Sample map')
      expect(wrapper.findAll('[data-slot]')).toHaveLength(124)
      expect(wrapper.get('.stat-card strong').text()).toBe('124')
      expect(wrapper.get('.location').text()).toBe('E4 (Sample) / Floor 4 / Cars')
      expect(wrapper.find('.filter-overlay').exists()).toBe(false)
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    },
  )
  it('previews the sample alongside saved locations and changes sample statuses without an API write', async () => {
    const { wrapper } = await createDashboard('staff')
    await wrapper
      .findAll('.map-header button')
      .find((button) => button.text() === 'View sample map')!
      .trigger('click')
    const slot = wrapper.findAll('.canvas-slot.available')[0]!
    await slot.trigger('keydown', { key: 'Enter' })
    await wrapper.findAll('.map-actions button')[1]!.trigger('click')
    expect(slot.classes()).toContain('disabled')
    expect(floorService.setSlotStatuses).not.toHaveBeenCalled()
    await wrapper.get('[aria-controls="map-filters"]').trigger('click')
    await selectLocation(wrapper)
    expect(wrapper.find('.sample-badge').exists()).toBe(false)
    expect(wrapper.get('.stat-card strong').text()).toBe('2')
  })
  it('shows the default page until all inputs are selected and reads the saved map totals', async () => {
    const { wrapper } = await createDashboard('user')
    expect(wrapper.find('.filter-overlay').exists()).toBe(false)
    expect(wrapper.text()).toContain('Select a parking location')
    expect(wrapper.text()).not.toContain('Select Building, Floor and Vehicle to view the parking map.')
    expect(wrapper.get('.stat-card strong').text()).toBe('0')
    await wrapper.get('[aria-controls="map-filters"]').trigger('click')
    expect(wrapper.findAll('.filter-overlay select')).toHaveLength(1)
    await wrapper.findAll('.filter-overlay select')[0]!.setValue('b1')
    expect(wrapper.findAll('.filter-overlay select')).toHaveLength(2)
    expect(wrapper.find('[data-slot]').exists()).toBe(false)
    await wrapper.findAll('.filter-overlay select')[1]!.setValue('4')
    expect(wrapper.findAll('.filter-overlay select')).toHaveLength(3)
    expect(wrapper.find('[data-slot]').exists()).toBe(false)
    await wrapper.findAll('.filter-overlay select')[2]!.setValue('car')
    expect(wrapper.findAll('[data-slot]')).toHaveLength(2)
    expect(wrapper.get('.stat-card strong').text()).toBe('2')
    await wrapper.get('[aria-controls="map-filters"]').trigger('click')
    expect(wrapper.find('.filter-overlay').exists()).toBe(false)
    expect(wrapper.get('.location').text()).toBe('E4 / Floor 4 / Cars')
  })
  it('keeps the location selector available above the CCTV and Log tabs', async () => {
    const { wrapper } = await createDashboard('staff')
    await wrapper.findAll('.tab-button').find((button) => button.text() === 'CCTV')!.trigger('click')
    expect(wrapper.get('.dashboard-map').classes()).toContain('header-only')
    await wrapper.get('[aria-controls="map-filters"]').trigger('click')
    expect(wrapper.find('.filter-overlay.inline').exists()).toBe(true)
    await wrapper.findAll('.filter-overlay select')[0]!.setValue('b1')
    await wrapper.findAll('.filter-overlay select')[1]!.setValue('4')
    await wrapper.findAll('.filter-overlay select')[2]!.setValue('car')
    expect(wrapper.get('.location').text()).toBe('E4 / Floor 4 / Cars')
    await wrapper.findAll('.tab-button').find((button) => button.text() === 'Log')!.trigger('click')
    expect(wrapper.get('.dashboard-map').classes()).toContain('header-only')
    expect(wrapper.find('.filter-overlay.inline').exists()).toBe(true)
  })
  it('shows the persisted editor zoom in the dashboard and blocks viewer zoom controls', async () => {
    const zoomFloor = {
      ...floors[0],
      parking_map: { ...map, layout: { ...emptyParkingLayout(), zoom: 175 } },
    }
    vi.mocked(floorService.catalog).mockResolvedValueOnce({
      data: { floors: [zoomFloor] },
    } as never)
    const { wrapper } = await createDashboard('user')
    await selectLocation(wrapper)
    expect(wrapper.get('.zoom-tools').text()).toContain('175%')
    expect(wrapper.get<HTMLButtonElement>('[aria-label="Zoom in"]').element.disabled).toBe(true)
  })
  it('shows the unavailable message for a disabled floor', async () => {
    vi.mocked(floorService.catalog).mockResolvedValueOnce({
      data: { floors: [{ ...floors[0], status: 'disable' }] },
    } as never)
    const { wrapper } = await createDashboard('user')
    await selectLocation(wrapper)
    expect(wrapper.get('.map-empty').text()).toContain('Parking is not available for now!')
    expect(wrapper.find('[data-slot]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(
      'Select Building, Floor and Vehicle to view the parking map.',
    )
  })
  it('shows zero for an unconfigured map and resets dependent inputs when building changes', async () => {
    const { wrapper } = await createDashboard('admin')
    await selectLocation(wrapper)
    await selectLocation(wrapper, 'b2', '1', 'motorcycle')
    expect(wrapper.text()).toContain('No parking map yet')
    expect(wrapper.get('.stat-card strong').text()).toBe('0')
    await wrapper.findAll('select')[0]!.setValue('b1')
    expect(wrapper.text()).toContain('Select a parking location')
    expect(wrapper.find('[data-slot]').exists()).toBe(false)
  })
  it.each([undefined, 'user', 'guest'] as const)(
    'keeps mutation tools hidden for %s',
    async (role) => {
      const { wrapper } = await createDashboard(role)
      await selectLocation(wrapper)
      expect(wrapper.get('.tabbar').text()).toBe('Slots')
      expect(wrapper.find('.map-actions').exists()).toBe(false)
      expect(wrapper.find('.editor-intro').exists()).toBe(false)
      await wrapper.get('[data-slot="1"]').trigger('keydown', { key: 'Delete' })
      expect(wrapper.findAll('[data-slot]')).toHaveLength(2)
      expect(floorService.setSlotStatuses).not.toHaveBeenCalled()
    },
  )
  it.each(['staff', 'admin'] as const)(
    'retains status controls and updated log columns for %s',
    async (role) => {
      const { wrapper } = await createDashboard(role)
      await selectLocation(wrapper)
      await wrapper.get('[data-slot="1"]').trigger('keydown', { key: 'Enter' })
      vi.mocked(floorService.setSlotStatuses).mockResolvedValue({
        data: {
          map: {
            ...map,
            slots: map.slots.map((s) => ({ ...s, status: s.number === 1 ? 'disabled' : s.status })),
          },
        },
      } as never)
      await wrapper.findAll('.map-actions button')[1]!.trigger('click')
      await flushPromises()
      expect(floorService.setSlotStatuses).toHaveBeenCalledWith('f1', ['["default",1]'], 'disabled')
      await wrapper
        .findAll('.tab-button')
        .find((b) => b.text() === 'CCTV')!
        .trigger('click')
      expect(wrapper.find('.cctv-grid').exists()).toBe(true)
      await wrapper
        .findAll('.tab-button')
        .find((b) => b.text() === 'Log')!
        .trigger('click')
      const text = wrapper.get('.logs-panel').text()
      for (const label of [
        'Name',
        'Brand',
        'Model',
        'Color',
        'License plate',
        'Province',
        'Date Enter',
        'Parking Time',
        'Date Exited',
        'Exited Time',
        'Parking Slot Number',
        'Parking Status',
      ])
        expect(text).toContain(label)
      expect(text).not.toContain('Face Driver')
    },
  )
  it('revokes restricted tabs and controls when the account is disabled', async () => {
    const { wrapper, auth } = await createDashboard('staff')
    await selectLocation(wrapper)
    await wrapper
      .findAll('.tab-button')
      .find((b) => b.text() === 'Log')!
      .trigger('click')
    auth.user!.status = 'disable'
    await nextTick()
    expect(wrapper.get('.tabbar').text()).toBe('Slots')
    expect(wrapper.find('.logs-panel').exists()).toBe(false)
    expect(wrapper.find('.map-actions').exists()).toBe(false)
  })
})
