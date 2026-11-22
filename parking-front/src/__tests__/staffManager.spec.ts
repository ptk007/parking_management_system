import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import AdminDashboardView from '@/views/admin/DashboardView.vue'
import { userService } from '@/services/api'
import type { ApiUser } from '@/types'

vi.mock('@/services/api', () => ({
  buildingService: { list: vi.fn(), cameraSummaries: vi.fn(), imageUrl: () => '' },
  floorService: { list: vi.fn(), remove: vi.fn(), sourceFiles: vi.fn() },
  userService: {
    listStaff: vi.fn(),
    createStaff: vi.fn(),
    updateStaff: vi.fn(),
    setStaffStatus: vi.fn(),
    remove: vi.fn(),
    imageUrl: vi.fn((value: string) => `/api/${value}`),
  },
}))

const staffUser = (status: ApiUser['status'] = 'offline'): ApiUser => ({
  _id: '507f1f77bcf86cd799439011',
  name: 'Alex Staff',
  username: 'alex',
  role: 'staff',
  status,
  date_updated: '2026-11-18',
  time_updated: '12:00:00',
  user_image: null,
})

let wrapper: VueWrapper

async function openStaffManager() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/staff', component: AdminDashboardView }],
  })
  await router.push('/admin/staff')
  wrapper = mount(AdminDashboardView, { global: { plugins: [createPinia(), router] } })
  await flushPromises()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(userService.listStaff).mockResolvedValue({ data: { users: [] } } as never)
})

afterEach(() => wrapper?.unmount())

describe('staff manager API integration', () => {
  it('creates a staff account with the selected profile image and reloads the staff list', async () => {
    const created = staffUser()
    vi.mocked(userService.createStaff).mockResolvedValue({ data: { user: created } } as never)
    vi.mocked(userService.listStaff)
      .mockResolvedValueOnce({ data: { users: [] } } as never)
      .mockResolvedValueOnce({ data: { users: [created] } } as never)

    await openStaffManager()
    await wrapper.get('.add-staff-button').trigger('click')
    const inputs = wrapper.findAll('.staff-form-fields input')
    await inputs[0]!.setValue('Alex Staff')
    await inputs[1]!.setValue('alex')
    await inputs[2]!.setValue('password-1')
    await inputs[3]!.setValue('password-1')
    const image = new File(['image'], 'staff.png', { type: 'image/png' })
    const imageInput = wrapper.get('.staff-image-field input').element as HTMLInputElement
    Object.defineProperty(imageInput, 'files', { value: [image], configurable: true })
    await wrapper.get('.staff-image-field input').trigger('change')
    await wrapper.get('.form-actions .green-button').trigger('click')
    await flushPromises()

    expect(userService.createStaff).toHaveBeenCalledWith({
      name: 'Alex Staff',
      username: 'alex',
      password: 'password-1',
      user_image: image,
    })
    expect(wrapper.find('.staff-card').text()).toContain('Alex Staff')
  })

  it('allows status changes and profile editing only when the staff account is disabled', async () => {
    const offline = staffUser('offline')
    const disabled = staffUser('disable')
    vi.mocked(userService.listStaff).mockResolvedValue({ data: { users: [offline] } } as never)
    vi.mocked(userService.setStaffStatus).mockResolvedValue({ data: { user: disabled } } as never)
    vi.mocked(userService.updateStaff).mockResolvedValue({ data: { user: disabled } } as never)

    await openStaffManager()
    expect(wrapper.get('[aria-label="Edit staff"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-label="Enable or disable Alex Staff"]').trigger('click')
    await flushPromises()
    expect(userService.setStaffStatus).toHaveBeenCalledWith(offline._id, 'disable')
    expect(wrapper.get('[aria-label="Edit staff"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[aria-label="Edit staff"]').trigger('click')
    const inputs = wrapper.findAll('.staff-form-fields input')
    await inputs[0]!.setValue('Alex Updated')
    await inputs[1]!.setValue('alex')
    await wrapper.get('.form-actions .blue-button').trigger('click')
    await flushPromises()
    expect(userService.updateStaff).toHaveBeenCalledWith(disabled._id, {
      name: 'Alex Updated',
      username: 'alex',
      password: undefined,
      user_image: null,
    })
  })
})
