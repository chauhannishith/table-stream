import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/fixtures.js'
import { createCategory } from '../services/menu-catalog.js'

describe('modifier group routes', () => {
  it('rejects CATEGORY scope without category_id', async () => {
    const app = await createTestApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/menu/modifier-groups',
      payload: { scope: 'CATEGORY', name: 'Crust' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toContain('category_id')
    await app.close()
  })

  it('creates modifier option with price_cents', async () => {
    const app = await createTestApp()
    const category = createCategory(app.hubDb, app.hubConfig.location_id, {
      name: 'Pizza',
    })

    const groupRes = await app.inject({
      method: 'POST',
      url: '/v1/menu/modifier-groups',
      payload: {
        scope: 'CATEGORY',
        category_id: category.id,
        name: 'Crust',
      },
    })
    const groupId = groupRes.json().modifier_group.id

    const optionRes = await app.inject({
      method: 'POST',
      url: `/v1/menu/modifier-groups/${groupId}/options`,
      payload: {
        code: 'thin',
        label: 'Thin crust',
        price_cents: 0,
      },
    })

    expect(optionRes.statusCode).toBe(201)
    expect(optionRes.json().option.price_cents).toBe(0)

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/menu/modifier-groups/${groupId}/options`,
    })
    expect(listRes.json().options).toHaveLength(1)

    await app.close()
  })
})
