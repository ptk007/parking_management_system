import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import DashboardView from '@/views/staff/DashboardView.vue'
import MyVehicleView from '@/views/user/MyVehicleView.vue'
import { useAuthStore } from '@/stores/auth'
import { floorService, parkingLogService, vehicleService } from '@/services/api'

vi.mock('@/services/api', () => ({
  floorService: { catalog: vi.fn(), setSlotStatuses: vi.fn() },
  parkingLogService: { list: vi.fn(), myHistory: vi.fn() },
  vehicleService: {
    getByUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

const wrappers: VueWrapper[] = []
const floorCatalog = [
  {
    _id: 'floor-1',
    building: {
      _id: 'building-1',
      building_name: 'E4',
      building_image: null,
      date_updated: '',
      time_updated: '',
    },
    floor: 4,
    veh_type: 'car' as const,
    parking_slot_file: null,
    status: 'Available' as const,
    date_updated: '',
    time_updated: '',
    parking_map: {
      version: 2,
      sourceName: 'Test map',
      slots: [{ number: 1, zone: 'A', status: 'available' as const }],
      layout: { shapes: [], positions: {} },
    },
  },
]
const record = {
  _id: 'log-1',
  owner: 'user-1',
  name: 'Parking Owner',
  building: 'E4',
  buildingId: 'building-1',
  floor: 4,
  floorId: 'floor-1',
  veh_type: 'car' as const,
  cameraPresetId: 'camera-1',
  parkingSlotName: 'zoneA_slot01',
  brand: 'Toyota',
  model: 'Corolla',
  color: 'Blue',
  license_num: 'กข 1234',
  province: 'เชียงราย',
  date_enter: '2026-11-04',
  park_time: '10:00:00',
  date_exit: null,
  exit_time: null,
  park_slot: 7,
  park_status: 'Parking' as const,
  slotDisabled: true,
  createdAt: '2026-11-04T03:00:00.000Z',
  updatedAt: '2026-11-04T03:00:00.000Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(floorService.catalog).mockResolvedValue({ data: { floors: floorCatalog } } as never)
  vi.mocked(parkingLogService.list).mockResolvedValue({ data: { logs: [record] } } as never)
  vi.mocked(parkingLogService.myHistory).mockResolvedValue({
    data: { logs: [record] },
  } as never)
  vi.mocked(vehicleService.getByUser).mockResolvedValue({
    data: { vehicles: [] },
  } as never)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  localStorage.clear()
})

function authenticate(role: 'admin' | 'staff' | 'user') {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.token = 'parking-log-test-token'
  auth.user = {
    _id: 'user-1',
    id: 'user-1',
    username: 'test',
    name: 'Test User',
    fullName: 'Test User',
    role,
    status: 'online',
  }
  localStorage.setItem('token', auth.token)
  return pinia
}

describe('parking log displays', () => {
  it('filters dashboard logs by a selected building, floor, and vehicle', async () => {
    const wrapper = mount(DashboardView, {
      global: { plugins: [authenticate('admin')] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('.tab-button').find((button) => button.text() === 'Log')!.trigger('click')
    await flushPromises()

    expect(parkingLogService.list).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Select a parking location')
    await wrapper.get('.filter-toggle').trigger('click')
    await wrapper.get('select[aria-label="Building"]').setValue('building-1')
    await wrapper.get('select[aria-label="Floor"]').setValue('4')
    await wrapper.get('select[aria-label="Vehicle"]').setValue('car')
    await flushPromises()

    expect(parkingLogService.list).toHaveBeenCalledOnce()
    expect(parkingLogService.list).toHaveBeenCalledWith({
      buildingId: 'building-1',
      floorId: 'floor-1',
      veh_type: 'car',
    })
    const logCard = wrapper.get('.parking-log-card')
    expect(logCard.text()).not.toContain('Floor')
    expect(logCard.text()).toContain('7')
    expect(logCard.text()).toContain('Parking (Slot Disable)')
    expect(logCard.text()).not.toContain('Building')
    expect(logCard.text()).toContain('Province')
    expect(logCard.text()).toContain('เชียงราย')
    expect(logCard.text()).toContain('License Plate')
    expect(logCard.text()).not.toContain('จังหวัด')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'View sample map')!
      .trigger('click')
    await flushPromises()
    await wrapper.find('.sample-log-toggle').trigger('click')
    expect(wrapper.text()).toContain('Sample preview only')
    expect(wrapper.text()).toContain('Guest 1')
    expect(wrapper.text()).toContain('Guest 2')
    expect(wrapper.text()).toContain('Guest 3')
    expect(wrapper.text()).toContain('Exited')
    expect(wrapper.text()).toContain('Not Parking')
    expect(wrapper.text()).toContain('กข 1001')

    await wrapper.find('.sample-log-toggle').trigger('click')
    expect(wrapper.text()).not.toContain('Sample preview only')
    await wrapper.get('.filter-toggle').trigger('click')
    await wrapper.get('select[aria-label="Building"]').setValue('building-1')
    await wrapper.get('select[aria-label="Floor"]').setValue('4')
    await wrapper.get('select[aria-label="Vehicle"]').setValue('car')
    await flushPromises()
    expect(wrapper.text()).toContain('กข 1234')
  })

  it('loads only the authenticated user parking history and shows building and floor', async () => {
    const wrapper = mount(MyVehicleView, {
      global: { plugins: [authenticate('user')] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper
      .findAll('.tab-button')
      .find((button) => button.text() === 'Parking History')!
      .trigger('click')
    await flushPromises()

    expect(parkingLogService.myHistory).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Building')
    expect(wrapper.text()).toContain('E4')
    expect(wrapper.text()).toContain('Floor')
    expect(wrapper.text()).toContain('Parking (Slot Disable)')
    expect(wrapper.text()).not.toContain('Parking Owner')
    const historyCard = wrapper.get('.parking-log-card')
    expect(historyCard.text().indexOf('Building')).toBeLessThan(historyCard.text().indexOf('Brand'))
    expect(historyCard.text().indexOf('Floor')).toBeLessThan(historyCard.text().indexOf('Brand'))
    expect(historyCard.text()).toContain('License Plate')
    expect(historyCard.text()).toContain('Province')
    expect(historyCard.text()).toContain('กข 1234')
    expect(historyCard.text()).toContain('เชียงราย')

    await wrapper.find('.sample-log-toggle').trigger('click')
    expect(wrapper.text()).toContain('Sample preview only')
    expect(wrapper.text()).toContain('กข 1004')
    expect(wrapper.text()).toContain('Exited')
    expect(wrapper.text()).toContain('Not Parking')
    expect(wrapper.text()).toContain('เชียงราย')
    expect(wrapper.text()).not.toContain('Guest 1')

    await wrapper.find('.sample-log-toggle').trigger('click')
    expect(wrapper.text()).not.toContain('Sample preview only')
    expect(wrapper.text()).toContain('กข 1234')
  })
})
