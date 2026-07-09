import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'

describe('menu tags routes', () => {
  it('GET /v1/menu/tags returns empty list', async () => {
    const app = await createTestApp()
    const res = await app.inject({ method: 'GET', url: '/v1/menu/tags' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ tags: [] })
    await app.close()
  })

  it('POST duplicate tag code returns 409', async () => {
    const app = await createTestApp()

    await app.inject({
      method: 'POST',
      url: '/v1/menu/tags',
      payload: { code: 'vegan', label: 'Vegan' },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/tags',
      payload: { code: 'vegan', label: 'Vegan duplicate' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error.code).toBe('CONFLICT')
    await app.close()
  })
})
