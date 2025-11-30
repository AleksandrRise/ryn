import { browser, expect } from '@wdio/globals'

describe('01 - Scan page smoke', () => {
  it('renders Scan Results page', async () => {
    await browser.url('/scan')
    const heading = await browser.$('h1=Scan Results')
    await expect(heading).toBeDisplayed()
  })
})
