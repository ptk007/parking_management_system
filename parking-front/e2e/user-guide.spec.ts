import { expect, test, type Page } from '@playwright/test'

test.use({ headless: true })

const cases = [
  {
    role: 'guest',
    entrance: /^Guest User$/,
    title: 'Guest guide',
    topics: ['Find a parking space', 'Recognize the sample map'],
  },
  {
    role: 'user',
    entrance: /^Student/,
    title: 'Student guide',
    topics: [
      'Find a parking space',
      'Register a vehicle',
      'View your parking history',
      'Ask Support for help',
    ],
  },
  {
    role: 'public',
    entrance: /^Public User/,
    title: 'Public User guide',
    topics: [
      'Find a parking space',
      'Register a vehicle',
      'View your parking history',
      'Ask Support for help',
    ],
  },
  {
    role: 'staff',
    entrance: /^Staff\/Admin/,
    title: 'Staff guide',
    topics: [
      'Manage parking spaces',
      'Watch a camera',
      'Review parking and slot activity',
      'Handle a support request',
    ],
  },
  {
    role: 'admin',
    entrance: /^Staff\/Admin/,
    title: 'Admin guide',
    topics: [
      'Set up a parking location',
      'Add a CCTV preset',
      'Edit a floor map',
      'Manage staff accounts',
      'Review parking and slot activity',
    ],
  },
]

async function signIn(page: Page, entrance: RegExp, username?: string) {
  await page.getByRole('button', { name: entrance }).click()
  if (username) {
    await page.getByLabel('Username', { exact: true }).fill(username)
    await page.getByLabel('Password', { exact: true }).fill('demo-password')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
  }
  await expect(page).toHaveURL(/\/dashboard$/)
}

for (const { role, entrance, title, topics } of cases) {
  test(`shows only the ${title} and lets the user dismiss and reopen it`, async ({ page }) => {
    if (role === 'admin') await page.setViewportSize({ width: 390, height: 760 })
    await page.route('**/api/**', (route) => {
      if (route.request().url().endsWith('/auth/login')) {
        const { username } = route.request().postDataJSON()
        return route.fulfill({
          json: {
            token: 'guide-test',
            user: { _id: username, username, name: 'Demo account', role, status: 'online' },
          },
        })
      }
      return route.fulfill({ json: { floors: [], tickets: [], users: [], logs: [] } })
    })

    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Open guide' })).toHaveCount(0)
    const username = role === 'guest' ? undefined : 'demo-account'
    await signIn(page, entrance, username)
    const guide = page.getByRole('dialog', { name: title })
    await expect(guide).toBeVisible()
    await expect(guide.getByRole('button', { name: 'Close', exact: true })).toBeInViewport()
    await expect(guide.getByRole('heading', { level: 3 })).toHaveText(topics)
    await guide.getByRole('button', { name: 'Close', exact: true }).click()

    const launcher = page.getByRole('button', { name: 'Open guide', exact: true })
    await expect(launcher).toBeVisible()
    if (role !== 'admin' && role !== 'guest') {
      await expect(page.locator('.support-launcher ~ .guide-launcher')).toBeVisible()
    }
    await launcher.click()
    await expect(guide).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(guide).toBeHidden()
    await expect(launcher).toBeFocused()

    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await signIn(page, entrance, username)
    await expect(launcher).toBeVisible()
    await expect(guide).toBeHidden()

    if (role === 'user') {
      await page.getByRole('button', { name: 'Logout', exact: true }).click()
      await signIn(page, entrance, 'another-account')
      await expect(guide).toBeVisible()
    }
  })
}
