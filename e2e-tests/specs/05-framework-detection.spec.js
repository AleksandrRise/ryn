import { browser, expect } from '@wdio/globals'

describe('05 - Settings smoke', () => {
  it('renders Settings heading', async () => {
    await browser.url('/settings')
    const heading = await browser.$('h1=Settings')
    await expect(heading).toBeDisplayed()
  })
})
