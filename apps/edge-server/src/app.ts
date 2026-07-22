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
import { menuTagRoutes } from './routes/menu-tags.js'
import { menuItemRoutes } from './routes/menu-items.js'
import { menuModifierRoutes } from './routes/menu-modifiers.js'
import { zoneRoutes } from './routes/zones.js'
import { tableRoutes } from './routes/tables.js'
import { staffRoutes } from './routes/staff.js'
import { locationBillingRoutes } from './routes/location-billing.js'
import { locationPrintConfigRoutes } from './routes/location-print-config.js'
import { kdsStationRoutes } from './routes/kds-stations.js'
import { printerRoutes } from './routes/printers.js'
import { printJobRoutes } from './routes/print-jobs.js'
import { orderRoutes } from './routes/orders.js'
import { orderSubmitRoutes, kdsRoutes } from './routes/kds.js'
import { orderBillingRoutes } from './routes/order-billing.js'
import { invoiceRoutes } from './routes/invoices.js'
import { deviceRoutes } from './routes/devices.js'
import { deviceAuthPlugin } from './plugins/device-auth.js'
import { staffAuthPlugin } from './plugins/staff-auth.js'
import { authRoutes } from './routes/auth.js'

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

  // Apply on the root instance so hooks cover all routes (avoid Fastify encapsulation).
  await deviceAuthPlugin(app, {})
  await staffAuthPlugin(app, {})

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
  await app.register(menuTagRoutes, { prefix: '/v1/menu' })
  await app.register(menuItemRoutes, { prefix: '/v1/menu' })
  await app.register(menuModifierRoutes, { prefix: '/v1/menu' })
  await app.register(zoneRoutes, { prefix: '/v1' })
  await app.register(tableRoutes, { prefix: '/v1' })
  await app.register(staffRoutes, { prefix: '/v1' })
  await app.register(locationBillingRoutes, { prefix: '/v1' })
  await app.register(locationPrintConfigRoutes, { prefix: '/v1' })
  await app.register(kdsStationRoutes, { prefix: '/v1' })
  await app.register(printerRoutes, { prefix: '/v1' })
  await app.register(printJobRoutes, { prefix: '/v1' })
  await app.register(orderRoutes, { prefix: '/v1' })
  await app.register(orderBillingRoutes, { prefix: '/v1' })
  await app.register(invoiceRoutes, { prefix: '/v1' })
  await app.register(deviceRoutes, { prefix: '/v1' })
  await app.register(authRoutes, { prefix: '/v1' })
  await app.register(orderSubmitRoutes, { prefix: '/v1' })
  await app.register(kdsRoutes, { prefix: '/v1' })

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    hubConfig: HubConfig
    hubDb: HubDb
    redis: RedisClient
  }
}
