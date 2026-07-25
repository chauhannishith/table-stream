import { describe, expect, it, vi } from 'vitest'
import { HubApiError, type HubApiClient } from './api-client'
import {
  createTag,
  listTags,
  normalizeTagCode,
  updateTag,
} from './tags-api'

describe('normalizeTagCode', () => {
  it('trims and lowercases codes', () => {
    expect(normalizeTagCode('  Vegan ')).toBe('vegan')
  })

  it('rejects blank codes', () => {
    expect(() => normalizeTagCode('   ')).toThrow(/code is required/)
  })
})

describe('tags API helpers', () => {
  it('lists tags with include_inactive', async () => {
    const client = {
      get: vi.fn(async () => ({
        tags: [
          {
            id: 'tg_1',
            location_id: 'loc',
            code: 'vegan',
            label: 'Vegan',
            sort_order: 0,
            is_active: true,
            updated_at: '2026-07-24T00:00:00.000Z',
          },
        ],
      })),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(listTags(client)).resolves.toHaveLength(1)
    expect(client.get).toHaveBeenCalledWith(
      '/v1/menu/tags?include_inactive=true',
    )
  })

  it('creates and updates tags', async () => {
    const tag = {
      id: 'tg_1',
      location_id: 'loc',
      code: 'vegan',
      label: 'Vegan',
      sort_order: 0,
      is_active: true,
      updated_at: '2026-07-24T00:00:00.000Z',
    }
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({ tag })),
      patch: vi.fn(async () => ({
        tag: { ...tag, label: 'Plant-based', is_active: false },
      })),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(
      createTag({ code: 'Vegan', label: 'Vegan' }, client),
    ).resolves.toEqual(tag)
    expect(client.post).toHaveBeenCalledWith('/v1/menu/tags', {
      body: { code: 'vegan', label: 'Vegan' },
    })

    await expect(
      updateTag(
        'tg_1',
        { label: 'Plant-based', is_active: false },
        client,
      ),
    ).resolves.toMatchObject({ label: 'Plant-based', is_active: false })
  })

  it('surfaces hub CONFLICT on duplicate create', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => {
        throw new HubApiError(
          {
            code: 'CONFLICT',
            message: 'Tag code already exists',
            details: { code: 'vegan' },
          },
          409,
        )
      }),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as HubApiClient

    await expect(
      createTag({ code: 'vegan', label: 'Vegan' }, client),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      message: 'Tag code already exists',
    })
  })
})
