import { test, expect } from '@playwright/test'
test.use({ headless: true })

test('imports camera names, validates maps, edits names, and stays usable on a narrow screen', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'map-test')
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'map-admin', name: 'Admin', role: 'admin', status: 'online' }),
    )
  })
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: {
        floors: [{ _id: 'f1', floor: 1, veh_type: 'car', building: { building_name: 'E5' } }],
      },
    }),
  )
  await page.goto('/admin/setup/floors/f1/parking-map')
  const input = page.getByLabel('Import parking map JSON', { exact: true })
  await input.setInputFiles({
    name: 'slots.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        slots: [
          { name: 'zoneA_slot01', status: 'available' },
          { name: 'Camera B bay', status: 'occupied' },
        ],
      }),
    ),
  })
  await expect(page.locator('.import-success')).toContainText('Imported 2 slots')
  await expect(page.locator('[data-layout-slot]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Slot Camera B bay, Occupied', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeDisabled()
  await input.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })
  await expect(page.locator('.import-error')).toContainText('current map has not changed')
  await expect(page.locator('[data-layout-slot]')).toHaveCount(2)
  await page.setViewportSize({ width: 750, height: 1000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('parking-map-narrow.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
