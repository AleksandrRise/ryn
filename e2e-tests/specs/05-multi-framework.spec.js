import { browser, expect } from '@wdio/globals'

describe('05b - Audit page smoke', () => {
  it('renders Audit Trail heading', async () => {
    await browser.url('/audit')
    const heading = await browser.$('h1=Audit Trail')
    await expect(heading).toBeDisplayed()
  })
})
