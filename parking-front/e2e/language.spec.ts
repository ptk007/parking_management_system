import { expect, test } from '@playwright/test'

test.use({ headless: true })

test('keeps the selected language from sign-in through the admin workspace', async ({ page }) => {
  const timestamps = { date_updated: '2026-11-04', time_updated: '10:00:00' }
  const building = { _id: 'b1', building_name: 'E4', ...timestamps }
  const floor = { _id: 'f1', building, floor: 4, veh_type: 'car', status: 'Disable', ...timestamps }
  const user = { _id: 'admin1', username: 'test-admin', name: 'Admin', role: 'admin', status: 'online' }
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/login')) return route.fulfill({ json: { user, token: 'language-test' } })
    return route.fulfill({
      json: {
        user,
        buildings: [building],
        floor,
        floors: [floor],
        summaries: {},
        floorSummaries: {},
        users: [],
        logs: [],
        files: [],
        vehicles: [],
      },
    })
  })

  await page.goto('/login')
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('th')
  await expect(page.getByRole('heading', { name: 'ระบบจัดการที่จอดรถ มฟล.' })).toBeVisible()
  await page.getByRole('button', { name: /^เจ้าหน้าที่ \/ ผู้ดูแลระบบ/ }).click()
  await page.getByLabel('ชื่อผู้ใช้', { exact: true }).fill('test-admin')
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('password')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  const guide = page.getByRole('dialog', { name: 'คู่มือสำหรับผู้ดูแลระบบ' })
  await expect(guide).toBeVisible()
  await guide.getByRole('button', { name: 'ปิด', exact: true }).click()
  const languagePicker = page.locator('.app-topbar select')
  await expect(languagePicker).toHaveValue('th')
  await expect(page.locator('.app-topbar .language-picker + .avatar')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await expect(page.getByRole('button', { name: 'ช่องจอด', exact: true })).toBeVisible()

  const navigation = page.locator('.sidebar-nav')
  await navigation.getByRole('link', { name: 'ประวัติสถานะช่องจอด' }).click()
  await expect(page.getByRole('heading', { name: 'ประวัติสถานะช่องจอด' })).toBeVisible()
  await navigation.getByRole('link', { name: 'รถของฉัน' }).click()
  await expect(page.getByRole('button', { name: 'ประวัติการจอด' })).toBeVisible()
  await navigation.getByRole('link', { name: 'จัดการเจ้าหน้าที่' }).click()
  await expect(page.getByRole('heading', { name: 'จัดการเจ้าหน้าที่' })).toBeVisible()
  await navigation.getByRole('link', { name: 'ตั้งค่าที่จอดรถ' }).click()
  await page.getByRole('button', { name: 'ดูชั้นของอาคาร E4' }).click()
  await page.getByRole('link', { name: 'ผังที่จอดรถชั้น 4 (รถยนต์)' }).click()
  await expect(page.getByRole('button', { name: 'ใช้ผังช่องจอดเริ่มต้น' })).toBeVisible()
  await expect(page.locator('.language-picker')).toHaveCount(1)
  await page.getByRole('link', { name: 'ไปหน้ากล้อง CCTV' }).click()
  await expect(page.getByRole('heading', { name: 'กล้อง CCTV อาคาร E4 ชั้น 4' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ไฟล์แหล่งข้อมูลกล้อง CCTV' })).toBeVisible()
  await page.reload()
  await expect(languagePicker).toHaveValue('th')
  await expect(page.getByRole('heading', { name: 'กล้อง CCTV อาคาร E4 ชั้น 4' })).toBeVisible()
  await languagePicker.selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Original CCTV source files' })).toBeVisible()
})

test('translates the user dashboard and support chat from the top bar', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'language-test')
    localStorage.setItem(
      'user',
      JSON.stringify({ _id: 'u1', name: 'User', role: 'user', status: 'online' }),
    )
  })
  await page.route('**/api/**', (route) => route.fulfill({ json: { floors: [], tickets: [] } }))
  await page.setViewportSize({ width: 480, height: 900 })
  await page.goto('/dashboard')
  const languagePicker = page.getByRole('combobox', { name: 'Language', exact: true })
  await expect(languagePicker).toBeInViewport()
  await languagePicker.selectOption('th')
  await expect(page.locator('.sample-badge')).toHaveText('ผังตัวอย่าง')
  await page.getByRole('button', { name: 'เปิดแชต Support', exact: true }).click()
  const support = page.locator('dialog.support-panel')
  await expect(support.getByRole('heading', { name: 'ศูนย์ช่วยเหลือ มฟล.' })).toBeVisible()
  await support.getByRole('button', { name: 'ปิดแชต', exact: true }).click()
  await page.getByRole('combobox', { name: 'ภาษา', exact: true }).selectOption('en')
  await page.getByRole('button', { name: 'Open support chat', exact: true }).click()
  await expect(support.getByRole('heading', { name: 'MFU Support' })).toBeVisible()
})
