import { browser, expect } from '@wdio/globals'

describe('04b - Scan progress smoke', () => {
  it('shows Scans CTA button', async () => {
    await browser.url('/scan')
    const startButton = await browser.$('button=Start scan')
    await expect(startButton).toBeDisplayed()
  })
})
