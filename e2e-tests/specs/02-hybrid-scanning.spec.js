import { browser, expect } from '@wdio/globals'

describe('02b - Hybrid scanning smoke', () => {
  it('lists violations panel on scan page', async () => {
    await browser.url('/scan')
    const violationsTitle = await browser.$('text=Violations')
    await expect(violationsTitle).toBeDisplayed()
  })
})
