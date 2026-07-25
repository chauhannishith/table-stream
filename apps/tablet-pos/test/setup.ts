import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import {
  resetBillingStore,
  resetMenuStore,
  resetPrintersStore,
  resetStaffStore,
  resetTablesStore,
  resetZonesStore,
} from './mocks/handlers'
import { server } from './mocks/server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetZonesStore()
  resetTablesStore()
  resetMenuStore()
  resetStaffStore()
  resetBillingStore()
  resetPrintersStore()
  sessionStorage.clear()
  localStorage.clear()
})

afterAll(() => {
  server.close()
})
