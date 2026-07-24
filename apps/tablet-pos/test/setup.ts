import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetMenuStore, resetStaffStore, resetZonesStore } from './mocks/handlers'
import { server } from './mocks/server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetZonesStore()
  resetMenuStore()
  resetStaffStore()
  sessionStorage.clear()
  localStorage.clear()
})

afterAll(() => {
  server.close()
})
