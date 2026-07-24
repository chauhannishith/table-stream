import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetMenuStore, resetZonesStore } from './mocks/handlers'
import { server } from './mocks/server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetZonesStore()
  resetMenuStore()
  sessionStorage.clear()
  localStorage.clear()
})

afterAll(() => {
  server.close()
})
