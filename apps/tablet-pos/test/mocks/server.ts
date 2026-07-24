import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Shared MSW server for vitest (started from test/setup.ts). */
export const server = setupServer(...handlers)
