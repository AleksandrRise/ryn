import { browser, expect } from '@wdio/globals'

describe('03b - Fix workflow smoke', () => {
  it('renders violation page shell', async () => {
    await browser.url('/violation?id=1')
    const text = await browser.$('main')
    await expect(text).toBeDisplayed()
  })
})
