import { loadHubConfig } from './config.js'
import { buildApp } from './app.js'
import { createHubDb } from './db/client.js'
import { createRedisClient } from './redis/client.js'

async function main() {
  const config = loadHubConfig()
  const db = createHubDb(config)
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  const redis = createRedisClient(redisUrl)

  await redis.connect()

  const app = await buildApp({ config, db, redis })

  const host = config.lan.bind
  const port = Number(process.env.PORT ?? config.lan.port)

  await app.listen({ host, port })
  console.log(`edge-server listening on http://${host}:${port}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
