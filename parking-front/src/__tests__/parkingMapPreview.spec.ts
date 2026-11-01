import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ParkingMapView from '@/views/admin/ParkingMapView.vue'
import { floorService } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { emptyParkingLayout } from '@/components/parking/parkingLayout'
import { restoreMapDraft } from '@/components/parking/parkingMapPreview'

vi.mock('@/services/api', () => ({
  floorService: { list: vi.fn(), saveMap: vi.fn(), update: vi.fn() },
}))
const wrappers: VueWrapper[] = []
const floors = ['floor-one', 'floor-two'].map((_id, index) => ({
  _id,
  floor: index,
  veh_type: 'car',
  building: { _id: `building-${index}`, building_name: `Building ${index}` },
  status: 'disable',
}))
const mapSlots = [
  { number: 1, name: 'camera_slot_01', zone: 'default', status: 'disabled' },
  { number: 2, name: 'camera_slot_02', zone: 'default', status: 'available' },
  { number: 3, name: 'camera_slot_03', zone: 'default', status: 'occupied' },
]
const key = (id = 'floor-one') => `parking-map-preview:v1:admin-test:${id}`
async function createPage(seed = true) {
  if (seed)
    localStorage.setItem(
      key(),
      JSON.stringify({
        version: 2,
        slots: mapSlots,
        sourceName: 'floor.json',
        layout: emptyParkingLayout(),
      }),
    )
  const pinia = createPinia(),
    auth = useAuthStore(pinia)
  auth.token = 'preview-test'
  auth.user = {
    _id: 'admin-test',
    id: 'admin-test',
    username: 'admin',
    name: 'Admin',
    fullName: 'Admin',
    role: 'admin',
    status: 'online',
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/floor/:floorId', component: ParkingMapView },
      {
        path: '/admin/setup',
        name: 'AdminSetup',
        component: { template: '<div>Setup</div>' },
      },
    ],
  })
  await router.push('/floor/floor-one')
  const wrapper = mount({ template: '<router-view />' }, { global: { plugins: [pinia, router] } })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}
async function select(wrapper: VueWrapper, number: number) {
  await wrapper.get(`[data-slot="${number}"]`).trigger('keydown', { key: 'Enter' })
}
async function editor(wrapper: VueWrapper) {
  await wrapper.findAll('.view-mode button')[1]!.trigger('click')
}
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  vi.mocked(floorService.saveMap).mockResolvedValue({} as never)
  vi.mocked(floorService.update).mockImplementation(async (_id, data) => ({
    data: { floor: { ...floors[0], ...data } },
  }) as never)
  vi.mocked(floorService.list).mockResolvedValue({ data: { floors } } as never)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('Parking Map workspace', () => {
  it('uses one canvas for preview and editor, with name search and no zone controls', async () => {
    const { wrapper } = await createPage()
    expect(wrapper.get('.floor-context').text()).toContain('Building 0 / Floor 0 / Cars')
    expect(wrapper.find('.zone-tabs').exists()).toBe(false)
    expect(wrapper.text()).toContain('Parking Preview')
    expect(wrapper.find('.details-panel').exists()).toBe(false)
    await select(wrapper, 1)
    expect(wrapper.find('.details-panel').exists()).toBe(true)
    await wrapper.get('[data-slot="1"]').trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.find('.details-panel').exists()).toBe(false)
    await select(wrapper, 1)
    const positions = wrapper
      .findAll('[data-layout-slot]')
      .map((item) => item.attributes('transform'))
    await editor(wrapper)
    expect(
      wrapper.findAll('[data-layout-slot]').map((item) => item.attributes('transform')),
    ).toEqual(positions)
    expect(wrapper.find('button[aria-label="Ellipse"]').exists()).toBe(false)
    await wrapper.get('input[type="search"]').setValue('camera_slot_02')
    expect(wrapper.get('[data-slot="2"]').attributes('opacity')).toBe('1')
    expect(wrapper.get('[data-slot="1"]').attributes('opacity')).toBe('0.18')
  })
  it('updates floor status from the controls beside the Parking Map title', async () => {
    const { wrapper } = await createPage()
    const available = wrapper.get<HTMLButtonElement>('.floor-status-button.available')
    const disable = wrapper.get<HTMLButtonElement>('.floor-status-button.disable')

    expect(available.text()).toBe('Available')
    expect(disable.text()).toBe('Disable')
    expect(disable.attributes('aria-pressed')).toBe('true')
    await available.trigger('click')
    await flushPromises()

    expect(floorService.update).toHaveBeenCalledWith(
      'floor-one',
      expect.objectContaining({
        building: 'building-0',
        floor: 0,
        veh_type: 'car',
        status: 'available',
      }),
    )
    expect(available.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll<HTMLButtonElement>('.view-mode button')[1]!.element.disabled).toBe(true)
  })
  it('keeps occupied slots read-only and renames editable map labels without changing identity or position', async () => {
    const { wrapper } = await createPage()
    await select(wrapper, 3)
    expect(wrapper.get('.slot-preview').text()).toContain('Occupied')
    expect(wrapper.get<HTMLButtonElement>('.disable-button').element.disabled).toBe(true)
    await editor(wrapper)
    await select(wrapper, 1)
    const position = wrapper.get('[data-slot="1"]').attributes('transform')
    await wrapper.get('#slot-name').setValue('camera_slot_02')
    await wrapper.get('.rename-slot').trigger('submit')
    expect(wrapper.get('.field-error').text()).toContain('already in use')
    await wrapper.get('#slot-name').setValue('zoneA_slot01')
    await wrapper.get('.rename-slot').trigger('submit')
    expect(wrapper.get('[data-slot="1"]').text()).toContain('zoneA_slot01')
    expect(wrapper.get('[data-slot="1"]').attributes('transform')).toBe(position)
    expect(JSON.parse(localStorage.getItem(key())!).slots[0].name).toBe('zoneA_slot01')
  })
  it('persists autosave independently per floor, saves manually, and warns before losing changes', async () => {
    const { wrapper, router } = await createPage()
    await editor(wrapper)
    await wrapper.get('input[role="switch"]').setValue(false)
    await select(wrapper, 1)
    await wrapper.get('.enable-button').trigger('click')
    expect(JSON.parse(localStorage.getItem(key())!).slots[0].status).toBe('disabled')
    await router.push('/floor/floor-two')
    await flushPromises()
    expect(router.currentRoute.value.params.floorId).toBe('floor-one')
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('Save your changes?')
    await wrapper.findAll('.leave-dialog button')[2]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.params.floorId).toBe('floor-two')
    expect(wrapper.findAll('[data-slot]')).toHaveLength(0)
    await editor(wrapper)
    expect(wrapper.get<HTMLInputElement>('input[role="switch"]').element.checked).toBe(true)
    await router.push('/floor/floor-one')
    await flushPromises()
    await editor(wrapper)
    expect(wrapper.get<HTMLInputElement>('input[role="switch"]').element.checked).toBe(false)
    expect(wrapper.get('[data-slot="1"]').classes()).toContain('available')
  })
  it('saves the chosen zoom manually when autosave is off', async () => {
    const { wrapper } = await createPage()
    await editor(wrapper)
    await wrapper.get('input[role="switch"]').setValue(false)
    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    expect(wrapper.get('.zoom-tools').text()).toContain('125%')
    expect(floorService.saveMap).not.toHaveBeenCalled()
    const saveButton = wrapper.get<HTMLButtonElement>('.save-controls button')
    expect(saveButton.element.disabled).toBe(false)
    await saveButton.trigger('click')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem(key())!).layout.zoom).toBe(125)
    expect(floorService.saveMap).toHaveBeenCalledWith(
      'floor-one',
      expect.objectContaining({
        layout: expect.objectContaining({ zoom: 125 }),
      }),
    )
    expect(wrapper.get('.save-controls [role="status"]').text()).toContain('Map saved')
  })
  it('restores a map after deleting every slot and does not invent a sample for a new floor', async () => {
    const { wrapper } = await createPage(false)
    expect(wrapper.findAll('[data-slot]')).toHaveLength(0)
    const empty = { version: 2, slots: [], layout: emptyParkingLayout(), sourceName: 'New map' }
    expect(restoreMapDraft(JSON.stringify(empty)).slots).toEqual([])
  })
  it('reports server save failures and keeps changes dirty', async () => {
    const { wrapper } = await createPage()
    vi.mocked(floorService.saveMap).mockRejectedValue(new Error('offline'))
    await select(wrapper, 1)
    await wrapper.get('.enable-button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.save-message.failed').text()).toContain('Could not save')
  })
  it('blocks layout editing and importing while the floor is Available', async () => {
    vi.mocked(floorService.list).mockResolvedValue({
      data: { floors: [{ ...floors[0], status: 'available' }] },
    } as never)
    const { wrapper } = await createPage()
    expect(wrapper.findAll<HTMLButtonElement>('.view-mode button')[1]!.element.disabled).toBe(true)
    expect(
      wrapper.get<HTMLInputElement>('[aria-label="Import parking map JSON"]').element.disabled,
    ).toBe(true)
    expect(wrapper.find('.editor-intro').exists()).toBe(false)
    expect(wrapper.findAll('[data-slot]')).toHaveLength(3)
  })
  it('loads errors without showing a misleading map', async () => {
    vi.mocked(floorService.list).mockRejectedValueOnce(new Error('offline'))
    const { wrapper } = await createPage(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to load')
    expect(wrapper.find('.map-workspace').exists()).toBe(false)
  })
})
