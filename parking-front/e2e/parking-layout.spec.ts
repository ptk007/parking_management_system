import { test, expect } from '@playwright/test'

test.use({ headless: true })

test('draws, resizes, moves and restores a custom floor plan without changing slot counts', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('token', 'layout-test')
    localStorage.setItem(
      'user',
      JSON.stringify({
        _id: 'layout-admin',
        name: 'Layout Admin',
        role: 'admin',
        status: 'online',
      }),
    )
  })
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: {
        floors: [{ _id: 'floor4', floor: 4, veh_type: 'car', building: { building_name: 'E4' } }],
      },
    }),
  )
  await page.setViewportSize({ width: 1500, height: 1100 })
  await page.goto('/admin/setup/floors/floor4/parking-map')
  await page.getByLabel('Import parking map JSON', { exact: true }).setInputFiles({
    name: 'six-slots.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        slots: Array.from({ length: 6 }, (_, index) => ({
          number: index + 1,
          zone: 'A',
          status: index === 2 ? 'occupied' : 'available',
        })),
      }),
    ),
  })
  await expect(page.locator('.import-success')).toContainText('Imported 6 slots')
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  const canvas = page.getByRole('group', { name: 'Editable parking floor plan', exact: true })
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click()
  await canvas.scrollIntoViewIfNeeded()
  const bounds = (await canvas.boundingBox())!
  const scale = bounds.width / 1000
  await page.mouse.move(bounds.x + 180 * scale, bounds.y + 180 * scale)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 450 * scale, bounds.y + 300 * scale, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('[data-shape]')).toHaveCount(1)
  await expect(page.getByLabel('Shape width', { exact: true })).toHaveValue('270')
  await page.getByLabel('Shape width', { exact: true }).fill('320')
  await page.getByLabel('Shape width', { exact: true }).press('Tab')
  await expect(page.locator('[data-shape] > rect').first()).toHaveAttribute('width', '320')
  await page.getByRole('button', { name: 'Undo layout change' }).click()
  await expect(page.locator('[data-shape] > rect').first()).toHaveAttribute('width', /270/)
  await page.getByRole('button', { name: 'Redo layout change' }).click()
  await expect(page.locator('[data-shape] > rect').first()).toHaveAttribute('width', '320')
  const rectangle = page.locator('[data-shape] > rect').first()
  await rectangle.click()
  let shapeBounds = (await rectangle.boundingBox())!
  await page.mouse.move(shapeBounds.x + 20, shapeBounds.y + 20)
  await page.mouse.down()
  await page.mouse.move(shapeBounds.x + 40, shapeBounds.y + 40, { steps: 4 })
  await page.mouse.up()
  await expect.poll(async () => Number(await rectangle.getAttribute('x'))).toBeGreaterThan(180)
  const grip = page.locator('.resize-grip')
  shapeBounds = (await grip.boundingBox())!
  await page.mouse.move(shapeBounds.x + 5, shapeBounds.y + 5)
  await page.mouse.down()
  await page.mouse.move(shapeBounds.x + 35, shapeBounds.y + 25, { steps: 4 })
  await page.mouse.up()
  await expect.poll(async () => Number(await rectangle.getAttribute('width'))).toBeGreaterThan(320)
  await page.getByRole('button', { name: 'Text', exact: true }).click()
  await canvas.click({ position: { x: 260 * scale, y: 240 * scale } })
  await page.getByLabel('Shape text', { exact: true }).fill('Entrance / ทางเข้า')
  await page.getByLabel('Shape text', { exact: true }).press('Tab')
  await expect(canvas.locator('text', { hasText: 'Entrance / ทางเข้า' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Delete shape', exact: true }).click()
  await expect(page.locator('[data-shape]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Undo layout change' }).click()
  await expect(page.locator('[data-shape]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Move slots', exact: true }).click()
  const slot = page.getByRole('button', { name: 'Layout slot A / 1, Available', exact: true })
  await slot.scrollIntoViewIfNeeded()
  const slotBounds = (await slot.boundingBox())!
  await page.mouse.move(slotBounds.x + 20, slotBounds.y + 20)
  await page.mouse.down()
  await page.mouse.move(slotBounds.x + 170, slotBounds.y + 100, { steps: 5 })
  await page.mouse.up()
  await expect(slot).not.toHaveAttribute('transform', 'translate(24 28)')
  const movedTransform = await slot.getAttribute('transform')
  await page.getByLabel('Upload floor plan image', { exact: true }).setInputFiles({
    name: 'floor.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
      'base64',
    ),
  })
  await expect(canvas.locator('image')).toHaveCount(1)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('parking-layout-editor.png'), fullPage: true })
  await page.reload()
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  await expect(page.locator('[data-shape]')).toHaveCount(2)
  await expect(slot).toHaveAttribute('transform', movedTransform!)
  await expect(canvas.locator('image')).toHaveCount(1)
  await expect(page.locator('.summary-card.all strong')).toHaveText('6')
  await page.getByRole('button', { name: 'POS view', exact: true }).click()
  await expect(page.locator('.parking-tile')).toHaveCount(6)
  await expect(
    page.getByRole('button', { name: 'Slot 3, Zone A, Occupied', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Import parking map JSON', { exact: true }).setInputFiles({
    name: 'replacement.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"slots":[{"number":7,"zone":"Z"}]}'),
  })
  await expect(page.locator('.import-success')).toContainText('Imported 1 slots')
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  await expect(page.locator('[data-shape]')).toHaveCount(2)
  await expect(canvas.locator('image')).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Layout slot Z / 7, Available', exact: true }),
  ).toHaveAttribute('transform', 'translate(24 28)')
  expect(errors).toEqual([])
})
