import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import type { HubConfig } from './config.js'
import type { HubDb } from './db/client.js'
import type { RedisClient } from './redis/client.js'

export type AppDeps = {
  config: HubConfig
  db: HubDb
  redis: RedisClient
}

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: true,
  })

  await app.register(cors, { origin: true })
  await app.register(websocket)

  app.decorate('hubConfig', deps.config)
  app.decorate('hubDb', deps.db)
  app.decorate('redis', deps.redis)

  app.get('/health', async () => ({
    status: 'ok',
    hub_id: deps.config.hub_id,
    location_id: deps.config.location_id,
    org_id: deps.config.org_id,
  }))

  app.get('/v1/status', async () => {
    const entitled = process.env.HUB_ENTITLED !== 'false'
    return {
      hub_status: entitled ? 'ACTIVE' : 'SUSPENDED',
      cloud_sync_enabled: deps.config.cloud_sync_enabled,
      subscription_status: process.env.SUBSCRIPTION_STATUS ?? 'ACTIVE',
    }
  })

  app.get('/v1/stream', { websocket: true }, (socket) => {
    socket.send(JSON.stringify({ type: 'connected', hub_id: deps.config.hub_id }))
    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      socket.send(JSON.stringify({ type: 'ack', received: raw.toString() }))
    })
  })

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    hubConfig: HubConfig
    hubDb: HubDb
    redis: RedisClient
  }
}
