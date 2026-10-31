import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import BuildingFormPanel from '@/views/admin/BuildingFormPanel.vue'
import { buildingService, type ParkingBuilding } from '@/services/api'

vi.mock('@/services/api', () => ({
  buildingService: {
    create: vi.fn(),
    update: vi.fn(),
    imageUrl: vi.fn((path: string | null) => path ? `http://localhost:3000/${path}` : ''),
  },
}))

const building: ParkingBuilding = {
  _id: 'building-1',
  building_name: 'E4',
  building_image: 'images/parking_building/e4.jpg',
  date_add: '28/09/2569',
  time_add: '12:00:00',
}

const wrappers: VueWrapper[] = []

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:building-preview'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

const selectImage = async (wrapper: VueWrapper) => {
  const file = new File(['image'], 'building.png', { type: 'image/png' })
  const input = wrapper.get<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
  return file
}

describe('admin building image form', () => {
  it('sends the selected image when adding a building', async () => {
    vi.mocked(buildingService.create).mockResolvedValue({} as never)
    const wrapper = mount(BuildingFormPanel, { props: { mode: 'add' } })
    wrappers.push(wrapper)

    await wrapper.get('input[type="text"]').setValue('E5')
    const file = await selectImage(wrapper)
    expect(wrapper.get('img').attributes('src')).toBe('blob:building-preview')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const data = vi.mocked(buildingService.create).mock.calls[0]?.[0]
    expect(data?.get('building_name')).toBe('E5')
    expect((data?.get('building_image') as File).name).toBe(file.name)
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('shows the existing image and sends a replacement when editing', async () => {
    vi.mocked(buildingService.update).mockResolvedValue({} as never)
    const wrapper = mount(BuildingFormPanel, { props: { mode: 'edit', building } })
    wrappers.push(wrapper)

    expect(wrapper.get('img').attributes('src')).toBe('http://localhost:3000/images/parking_building/e4.jpg')
    const file = await selectImage(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const [id, data] = vi.mocked(buildingService.update).mock.calls[0]!
    expect(id).toBe(building._id)
    expect(data.get('building_name')).toBe('E4')
    expect((data.get('building_image') as File).name).toBe(file.name)
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })
})
