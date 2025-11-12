import '@testing-library/jest-dom'
import { beforeAll } from 'vitest'

beforeAll(() => {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (buffer: any) => {
        return crypto.getRandomValues(buffer)
      },
    },
  })
})
