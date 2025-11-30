import { browser, expect } from '@wdio/globals'

describe('03 - Cost tracking smoke', () => {
  it('renders Analytics page hero', async () => {
    await browser.url('/analytics')
    const hero = await browser.$('text=LLM Spend Overview')
    await expect(hero).toBeDisplayed()
  })
})
