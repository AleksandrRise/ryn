import { browser, expect } from '@wdio/globals'

describe('02 - File watcher smoke', () => {
  it('shows files column on scan page', async () => {
    await browser.url('/scan')
    const filesLabel = await browser.$('text=Files')
    await expect(filesLabel).toBeDisplayed()
  })
})
