import { test, expect } from '@playwright/test'
test.use({ headless: true })
test('selects saved maps, collapses the filter overlay and shows zero for floors without a map', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'dashboard-test')
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'u1', name: 'User', role: 'user', status: 'online' }),
    )
  })
  const layout = {
    background: null,
    shapes: [],
    positions: { '["default",1]': { x: 400, y: 100, width: 60, height: 80 } },
  }
  const floors = [
    {
      _id: 'f1',
      building: { _id: 'b1', building_name: 'E4' },
      floor: 4,
      veh_type: 'car',
      parking_map: {
        version: 2,
        sourceName: 'Map',
        layout,
        slots: [{ number: 1, zone: 'default', name: '1', status: 'available' }],
      },
    },
    {
      _id: 'f2',
      building: { _id: 'b2', building_name: 'E5' },
      floor: 1,
      veh_type: 'motorcycle',
      parking_map: null,
    },
  ]
  await page.route('**/api/**', (route) => route.fulfill({ json: { floors, tickets: [] } }))
  await page.goto('/dashboard')
  await expect(page.getByText('Select a parking location', { exact: true })).toBeVisible()
  await expect(page.locator('[data-slot]')).toHaveCount(0)
  const selects = page.locator('.filter-overlay select')
  await selects.nth(0).selectOption('b1')
  await selects.nth(1).selectOption('4')
  await expect(page.locator('[data-slot]')).toHaveCount(0)
  await selects.nth(2).selectOption('car')
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('1')
  await page.getByRole('button', { name: 'Collapse filters' }).click()
  await expect(page.locator('.location')).toHaveText('E4 / Floor 4 / Cars')
  await expect(page.locator('[data-slot="1"]')).toBeVisible()
  await expect(page.locator('.map-actions')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('dashboard-saved-map.png'), fullPage: true })
  await page.getByRole('button', { name: 'Expand filters' }).click()
  await selects.nth(0).selectOption('b2')
  await selects.nth(1).selectOption('1')
  await selects.nth(2).selectOption('motorcycle')
  await expect(page.getByText('No parking map yet', { exact: true })).toBeVisible()
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('0')
  await page.setViewportSize({ width: 750, height: 1000 })
  await page.screenshot({ path: info.outputPath('dashboard-default-narrow.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('choosing a vehicle type opens the form directly and history uses the shared columns', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'vehicle-test')
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'u1', name: 'User', role: 'user', status: 'online' }),
    )
  })
  await page.route('**/api/**', (route) => route.fulfill({ json: { vehicles: [], tickets: [] } }))
  await page.goto('/my-vehicle')
  await expect(page.getByText('My Vehicles', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click()
  await expect(page.locator('.confirm-type')).toHaveCount(0)
  await page.getByRole('button', { name: 'Car', exact: true }).click()
  await expect(page.locator('dialog.vehicle-form-dialog, dialog[open]')).toBeVisible()
  await expect(page.getByText('Province', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Parking History', exact: true }).click()
  await expect(page.locator('.parking-log-card')).toHaveCount(1)
  const text = await page.locator('.parking-log-card').innerText()
  expect(text).toContain('Date Enter')
  expect(text).toContain('Parking Slot Number')
  expect(text).not.toContain('Name :')
})

test('shows a complete sample parking map when the backend is unavailable', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'sample-test')
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'sample-admin', name: 'Admin', role: 'admin', status: 'online' }),
    )
  })
  await page.route('**/api/**', (route) => route.abort())
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/admin/dashboard')
  await expect(page.locator('.sample-badge')).toHaveText('Sample map')
  await expect(page.locator('[data-layout-slot]')).toHaveCount(124)
  await expect(page.locator('.stat-card').first().locator('strong')).toHaveText('124')
  await expect(page.locator('.location')).toHaveText('E4 (Sample) / Floor 4 / Cars')
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 750, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await expect
      .poll(() =>
        page
          .locator('.canvas-scroll')
          .evaluate(
            (el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
          ),
      )
      .toBe(true)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1))
      .toBe(true)
    const map = await page.locator('.layout-canvas').boundingBox()
    const lastSlot = await page.locator('[data-slot="124"]').boundingBox()
    expect(lastSlot!.y + lastSlot!.height).toBeLessThanOrEqual(map!.y + map!.height + 1)
    await page.screenshot({
      path: info.outputPath(`dashboard-fit-${viewport.width}.png`),
      fullPage: true,
    })
  }
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Fit map to screen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fit map to screen', exact: true })).toHaveText(
    '100%',
  )
})

test('fits the dashboard map without distortion and keeps Support clear of content', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'layout-user')
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'u1', name: 'User', role: 'user', status: 'online' }),
    )
  })
  await page.route('**/api/**', (route) => route.fulfill({ json: { floors: [], tickets: [] } }))
  await page.goto('/dashboard')
  await expect(page.locator('.sample-badge')).toBeVisible()
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 750, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await expect
      .poll(() =>
        page.locator('.canvas-scroll').evaluate((el) => {
          const canvas = el.querySelector('svg')!
          const svg = canvas.getBoundingClientRect()
          const matrix = canvas.getScreenCTM()!
          const proportional =
            Math.abs(matrix.a - matrix.d) < 0.0001 &&
            Math.abs(matrix.b) < 0.0001 &&
            Math.abs(matrix.c) < 0.0001
          return (
            proportional &&
            svg.width >= el.clientWidth - 1 &&
            svg.height >= el.clientHeight - 1 &&
            el.scrollHeight <= el.clientHeight + 1 &&
            el.scrollWidth <= el.clientWidth + 1
          )
        }),
      )
      .toBe(true)
    const launcher = (await page.locator('.support-launcher').boundingBox())!
    const dashboard = (await page.locator('.dashboard-map').boundingBox())!
    expect(launcher.width).toBeLessThanOrEqual(44)
    expect(launcher.x + launcher.width).toBeLessThan(dashboard.x)
    await page.screenshot({
      path: info.outputPath(`dashboard-full-map-${viewport.width}.png`),
      fullPage: true,
    })
  }
  await page.getByRole('button', { name: 'เปิดแชต Support', exact: true }).click()
  await expect(page.locator('dialog.support-panel')).toBeVisible()
})
