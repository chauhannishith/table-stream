import type { FastifyPluginAsync } from 'fastify'
import { readHubStreamEvents } from '../lib/hub-stream.js'

export const streamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stream', { websocket: true }, (socket) => {
    const locationId = app.hubConfig.location_id

    socket.send(
      JSON.stringify({ type: 'connected', hub_id: app.hubConfig.hub_id }),
    )

    let lastId = '$'
    let closed = false

    const pump = async () => {
      while (!closed && socket.readyState === 1) {
        try {
          const entries = await readHubStreamEvents(app.redis, lastId, 5000)
          for (const { id, event } of entries) {
            lastId = id
            if (event.location_id !== locationId) continue
            if (socket.readyState !== 1) return

            socket.send(
              JSON.stringify({
                type: event.event_type,
                occurred_at: event.occurred_at,
                location_id: event.location_id,
                payload: event.payload,
              }),
            )
          }
        } catch (error) {
          if (closed) return
          app.log.error(error)
        }
      }
    }

    void pump()

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      socket.send(JSON.stringify({ type: 'ack', received: raw.toString() }))
    })

    socket.on('close', () => {
      closed = true
    })
  })
}
