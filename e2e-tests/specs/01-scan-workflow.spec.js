import { browser, expect } from '@wdio/globals'

describe('01 - Scan page smoke', () => {
  it('renders Scans page', async () => {
    await browser.url('/scan')
    const heading = await browser.$('h1=Scans')
    await expect(heading).toBeDisplayed()
  })
})
