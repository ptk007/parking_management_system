import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
test.use({ headless: true })
async function prepare(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('token')) {
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
    }
  })
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json: {
        floors: [{ _id: 'floor4', floor: 4, veh_type: 'car', building: { building_name: 'E4' } }],
      },
    }),
  )
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto('/admin/setup/floors/floor4/parking-map')
}
async function dragCanvas(page: import('@playwright/test').Page, from: number[], to: number[]) {
  const canvas = page.getByRole('group', { name: 'Editable parking floor plan', exact: true })
  await canvas.scrollIntoViewIfNeeded()
  const b = (await canvas.boundingBox())!,
    scale = b.width / 1000
  await page.mouse.move(b.x + from[0]! * scale, b.y + from[1]! * scale)
  await page.mouse.down()
  await page.mouse.move(b.x + to[0]! * scale, b.y + to[1]! * scale, { steps: 8 })
  await page.mouse.up()
}

test('creates disabled rectangular slots, moves them in Select, and shares geometry with Parking Preview', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await prepare(page)
  await expect(page.locator('[data-layout-slot]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ellipse', exact: true })).toHaveCount(0)
  await expect(page.getByText('Use Dashboard layout', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Parking slot', exact: true }).click()
  await dragCanvas(page, [100, 100], [160, 180])
  const slot = page.locator('[data-slot="1"]')
  await expect(slot).toHaveClass(/disabled/)
  await expect(slot).toHaveAttribute('transform', 'translate(100 100)')
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('.summary-card.all strong')).toHaveText('1')
  await dragCanvas(page, [130, 140], [270, 230])
  await expect(slot).toHaveAttribute('transform', 'translate(240 190)')
  await page.getByRole('button', { name: 'Undo layout change' }).click()
  await expect(slot).toHaveAttribute('transform', 'translate(100 100)')
  await page.getByRole('button', { name: 'Redo layout change' }).click()
  await expect(slot).toHaveAttribute('transform', 'translate(240 190)')
  await page.getByLabel('Slot name', { exact: true }).fill('zoneA_slot01')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(slot).toContainText('zoneA_slot01')
  await page.getByRole('button', { name: 'Parking Preview', exact: true }).click()
  await expect(slot).toHaveAttribute('transform', 'translate(240 190)')
  await expect(slot.locator('rect')).toHaveAttribute('width', '60')
  await page.screenshot({ path: testInfo.outputPath('parking-preview.png'), fullPage: true })
  await page.reload()
  await expect(slot).toHaveAttribute('transform', 'translate(240 190)')
  await expect(slot).toContainText('zoneA_slot01')
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  await slot.click()
  await page.getByRole('button', { name: 'Duplicate selection', exact: true }).click()
  await expect(page.locator('[data-layout-slot]')).toHaveCount(2)
  await expect(page.locator('[data-slot="2"]')).toHaveClass(/disabled/)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export map', exact: true }).click()
  const file = await download
  const path = await file.path()
  await page.getByLabel('Import parking map JSON', { exact: true }).setInputFiles({
    name: file.suggestedFilename(),
    mimeType: 'application/json',
    buffer: await readFile(path!),
  })
  await expect(page.locator('.import-success')).toContainText('Imported 2 slots')
  await expect(slot).toHaveAttribute('transform', 'translate(240 190)')
  await expect(slot).toContainText('zoneA_slot01')
  await page.screenshot({ path: testInfo.outputPath('parking-editor.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('autosave is per floor and off means edits require a manual save', async ({ page }) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  await page.getByRole('switch', { name: 'Autosave this floor' }).uncheck()
  await page.getByRole('button', { name: 'Parking slot', exact: true }).click()
  await dragCanvas(page, [100, 100], [160, 180])
  expect(
    await page.evaluate(() => localStorage.getItem('parking-map-preview:v1:layout-admin:floor4')),
  ).toBeNull()
  await page.getByRole('link', { name: 'Back to Parking Setup' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await page.getByRole('button', { name: 'Save now', exact: true }).click()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('parking-map-preview:v1:layout-admin:floor4')!).slots[0]
          .status,
    ),
  ).toBe('disabled')
  await page.reload()
  await expect(page.locator('[data-layout-slot]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'Autosave this floor' })).not.toBeChecked()
})

test('resizes, duplicates, moves a group, and restores deleted slots with Undo', async ({
  page,
}) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Layout editor', exact: true }).click()
  await page.getByRole('button', { name: 'Parking slot', exact: true }).click()
  await dragCanvas(page, [100, 100], [160, 180])
  const grip = page.getByLabel('Resize selected element', { exact: true })
  const b = (await grip.boundingBox())!
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + 35, b.y + b.height / 2 + 35, { steps: 5 })
  await page.mouse.up()
  const slot1 = page.locator('[data-slot="1"]'),
    slot2 = page.locator('[data-slot="2"]')
  await expect
    .poll(async () => Number(await slot1.locator('rect').getAttribute('width')))
    .toBeGreaterThan(60)
  await page.getByRole('button', { name: 'Duplicate selection', exact: true }).click()
  await expect(slot2).toBeVisible()
  await slot1.click({ modifiers: ['Shift'], position: { x: 5, y: 5 } })
  const first = await slot1.getAttribute('transform'),
    second = await slot2.getAttribute('transform')
  await slot1.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(slot1).not.toHaveAttribute('transform', first!)
  await expect(slot2).not.toHaveAttribute('transform', second!)
  await page.getByRole('button', { name: 'Delete selection', exact: true }).click()
  await expect(page.locator('[data-layout-slot]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo layout change' }).click()
  await expect(page.locator('[data-layout-slot]')).toHaveCount(2)
  await page.reload()
  await expect(page.locator('[data-layout-slot]')).toHaveCount(2)
})
