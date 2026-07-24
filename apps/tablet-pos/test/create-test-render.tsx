import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'

export type CreateTestRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Initial MemoryRouter entry (default `/`). */
  route?: string
}

export type TestRenderResult = RenderResult & {
  user: UserEvent
}

/**
 * Render UI under MemoryRouter with a preconfigured user-event instance.
 * Prefer this over raw `render` for hub web component / flow tests.
 */
export function createTestRender(
  ui: ReactElement,
  options: CreateTestRenderOptions = {},
): TestRenderResult {
  const { route = '/', ...renderOptions } = options

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    )
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  }
}
