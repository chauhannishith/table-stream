import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'

describe('AppRoutes', () => {
  it('renders each role home stub', () => {
    for (const [path, title] of [
      ['/counter', 'Counter'],
      ['/waiter', 'Waiter'],
      ['/kitchen', 'Kitchen'],
      ['/customer', 'Customer'],
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
