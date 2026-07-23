import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { ROLE_ROUTES } from './lib/device-type'

describe('AppRoutes', () => {
  it('renders each role home stub', () => {
    for (const [path, title] of [
      [ROLE_ROUTES.COUNTER, 'Counter'],
      [ROLE_ROUTES.WAITER, 'Waiter'],
      [ROLE_ROUTES.KITCHEN, 'Kitchen'],
      [ROLE_ROUTES.CUSTOMER, 'Customer'],
    ] as const) {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>,
      )
      expect(html).toContain(`<h1>${title}</h1>`)
    }
  })
})
