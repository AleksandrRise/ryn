import { browser, expect } from '@wdio/globals'

describe('04 - Analytics totals smoke', () => {
  it('shows Total Cost card', async () => {
    await browser.url('/analytics')
    const totalCostCard = await browser.$('text=Total Cost')
    await expect(totalCostCard).toBeDisplayed()
  })
})
