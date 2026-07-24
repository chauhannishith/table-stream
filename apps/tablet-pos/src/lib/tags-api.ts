import { api, type HubApiClient } from './api-client'

export type MenuTag = {
  id: string
  location_id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

export type TagWriteInput = {
  code?: string
  label?: string
  sort_order?: number
  is_active?: boolean
}

/** Normalize a tag code for create/update (trim + lowercase). */
export function normalizeTagCode(code: string): string {
  const trimmed = code.trim().toLowerCase()
  if (!trimmed) {
    throw new Error('code is required')
  }
  return trimmed
}

/** List tags (include inactive for setup reactivation). */
export async function listTags(
  client: HubApiClient = api,
): Promise<MenuTag[]> {
  const result = await client.get<{ tags: MenuTag[] }>(
    '/v1/menu/tags?include_inactive=true',
  )
  return result.tags
}

/** Create a menu tag (hub returns 409 CONFLICT on duplicate code). */
export async function createTag(
  input: { code: string; label: string },
  client: HubApiClient = api,
): Promise<MenuTag> {
  const result = await client.post<{ tag: MenuTag }>('/v1/menu/tags', {
    body: {
      code: normalizeTagCode(input.code),
      label: input.label.trim(),
    },
  })
  return result.tag
}

/** Patch tag fields (code, label, activate/deactivate). */
export async function updateTag(
  id: string,
  input: TagWriteInput,
  client: HubApiClient = api,
): Promise<MenuTag> {
  const body: TagWriteInput = {}
  if (input.code !== undefined) body.code = normalizeTagCode(input.code)
  if (input.label !== undefined) body.label = input.label.trim()
  if (input.sort_order !== undefined) body.sort_order = input.sort_order
  if (input.is_active !== undefined) body.is_active = input.is_active

  const result = await client.patch<{ tag: MenuTag }>(`/v1/menu/tags/${id}`, {
    body,
  })
  return result.tag
}
