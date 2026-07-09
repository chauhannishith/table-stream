import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import type { HubConfig } from './config.js'
import type { HubDb } from './db/client.js'
import { AppError, toProblemJson, toUnknownProblemJson } from './lib/errors.js'
import type { RedisClient } from './redis/client.js'
import { healthRoutes } from './routes/health.js'
import { statusRoutes } from './routes/status.js'
import { streamRoutes } from './routes/stream.js'
import { menuCategoryRoutes } from './routes/menu-categories.js'

export type AppDeps = {
  config: HubConfig
  db: HubDb
  redis: RedisClient
}

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  })

  await app.register(cors, { origin: true })
  await app.register(websocket)

  app.decorate('hubConfig', deps.config)
  app.decorate('hubDb', deps.db)
  app.decorate('redis', deps.redis)

  app.setErrorHandler((error, request, reply) => {
    const problem = toUnknownProblemJson(error)
    return reply.status(problem.statusCode).send({
      error: problem.error,
    })
  })

  app.setNotFoundHandler((request, reply) => {
    const problem = toProblemJson(
      new AppError('NOT_FOUND', 'Route not found', 404, {
        method: request.method,
        url: request.url,
      }),
    )
    return reply.status(404).send(problem)
  })

  await app.register(healthRoutes)
  await app.register(statusRoutes, { prefix: '/v1' })
  await app.register(streamRoutes, { prefix: '/v1' })
  await app.register(menuCategoryRoutes, { prefix: '/v1/menu' })

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    hubConfig: HubConfig
    hubDb: HubDb
    redis: RedisClient
  }
}
