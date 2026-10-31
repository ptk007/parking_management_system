import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BuildingCameraSummary from '@/views/admin/BuildingCameraSummary.vue'

const summary = { total: 8, online: 4, offline: 2, disabled: 1, unknown: 1 }

describe('building camera summary', () => {
  it('shows total and every reported status', () => {
    const wrapper = mount(BuildingCameraSummary, { props: { summary, loading: false, error: '' } })
    expect(wrapper.text()).toContain('8 cameras')
    expect(wrapper.get('.online').text()).toContain('4')
    expect(wrapper.get('.offline').text()).toContain('2')
    expect(wrapper.get('.disabled').text()).toContain('1')
    expect(wrapper.get('.unknown').text()).toContain('1')
    wrapper.unmount()
  })

  it('distinguishes an empty building from unavailable data and allows retry', async () => {
    const wrapper = mount(BuildingCameraSummary, { props: { summary: { total: 0, online: 0, offline: 0, disabled: 0, unknown: 0 }, loading: false, error: '' } })
    expect(wrapper.text()).toContain('No cameras assigned')
    expect(wrapper.find('.unknown').exists()).toBe(false)
    await wrapper.setProps({ error: 'Network error' })
    expect(wrapper.text()).toContain('Camera data unavailable')
    expect(wrapper.text()).not.toContain('0 cameras')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.setProps({ loading: true })
    expect(wrapper.text()).toContain('Loading cameras...')
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not invent zero counts when a building summary is missing', () => {
    const wrapper = mount(BuildingCameraSummary, { props: { loading: false, error: '' } })
    expect(wrapper.text()).toContain('Camera data unavailable')
    expect(wrapper.text()).not.toContain('0 cameras')
    wrapper.unmount()
  })
})
