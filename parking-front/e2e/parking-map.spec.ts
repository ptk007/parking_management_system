import { test, expect } from '@playwright/test'

test.use({ headless: true })

test('opens a floor map from setup, edits a local preview, and preserves dashboard', async ({
  page,
}, testInfo) => {
  const building = {
    _id: 'e4',
    building_name: 'E4',
    building_image: null,
    date_add: '2026-10-19',
    time_add: '12:00',
  }
  const floor = {
    _id: 'floor4',
    building,
    floor: 4,
    veh_type: 'car',
    status: 'available',
    date_add: '2026-10-19',
    time_add: '12:00',
  }
  await page.addInitScript(() => {
    localStorage.setItem('token', 'parking-map-e2e')
    localStorage.setItem(
      'user',
      JSON.stringify({
        _id: 'test-admin',
        username: 'admin',
        name: 'Test Admin',
        role: 'admin',
        status: 'online',
      }),
    )
  })
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const data = url.includes('camera-summary')
      ? { summaries: {} }
      : url.endsWith('/buildings')
        ? { buildings: [building] }
        : url.endsWith('/floors')
          ? { floors: [floor] }
          : {}
    await route.fulfill({ json: data })
  })
  await page.setViewportSize({ width: 1500, height: 1000 })
  await page.goto('/admin/setup')
  await page.getByRole('button', { name: 'View Floor' }).click()
  await page.getByRole('link', { name: 'Parking Map for floor 4 (Cars)', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/setup\/floors\/floor4\/parking-map$/)
  await expect(page.locator('.floor-context')).toContainText('E4 / Floor 4 / Cars')
  await expect(page.locator('.parking-tile')).toHaveCount(26)
  await page.locator('[data-slot="1"]').click()
  await page.locator('[data-slot="2"]').click()
  await page.screenshot({ path: testInfo.outputPath('parking-map-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Disable slots', exact: true }).click()
  await expect(page.locator('[data-slot="1"]')).toHaveClass(/disabled/)
  await page.reload()
  await expect(page.locator('[data-slot="1"]')).toHaveClass(/disabled/)
  const jsonInput = page.getByLabel('Import parking map JSON', { exact: true })
  await jsonInput.setInputFiles([
    {
      name: 'north.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ slots: [{ number: 1, zone: 'North', status: 'available' }] }),
      ),
    },
    {
      name: 'south.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ slots: [{ number: 1, zone: 'South', status: 'occupied' }] }),
      ),
    },
  ])
  await expect(page.locator('.import-success')).toContainText('Imported 2 slots in 2 zones')
  await expect(page.locator('.parking-tile')).toHaveCount(2)
  await page.getByRole('button', { name: 'Slot 1, Zone North, Available', exact: true }).click()
  await page.getByRole('button', { name: 'Disable slots', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Slot 1, Zone South, Occupied', exact: true }),
  ).toBeVisible()
  await jsonInput.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"slots":[{"number":1,"status":"broken"}]}'),
  })
  await expect(page.locator('.import-error')).toContainText('The current map has not changed')
  await expect(page.locator('.parking-tile')).toHaveCount(2)
  await page.reload()
  await expect(page.locator('.import-source')).toContainText('north.json, south.json')
  await expect(
    page.getByRole('button', { name: 'Slot 1, Zone North, Disabled', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'All zones 2', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Slot 1, Zone South, Occupied', exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.screenshot({ path: testInfo.outputPath('parking-map-tablet.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.goto('/admin/dashboard')
  await expect(page.locator('.scene-board .slot-cell')).toHaveCount(124)
  await expect(page.getByRole('button', { name: 'Slot 1 available', exact: true })).toBeVisible()
})
