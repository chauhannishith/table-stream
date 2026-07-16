import type { FastifyPluginAsync } from 'fastify'
import { hubEvents, type HubStreamEvent } from '../lib/hub-events.js'

export const streamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stream', { websocket: true }, (socket) => {
    socket.send(
      JSON.stringify({ type: 'connected', hub_id: app.hubConfig.hub_id }),
    )

    const unsubscribe = hubEvents.subscribe((event: HubStreamEvent) => {
      if (event.location_id !== app.hubConfig.location_id) return
      if (socket.readyState !== 1) return
      socket.send(
        JSON.stringify({
          type: event.event_type,
          occurred_at: event.occurred_at,
          location_id: event.location_id,
          payload: event.payload,
        }),
      )
    })

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      socket.send(JSON.stringify({ type: 'ack', received: raw.toString() }))
    })

    socket.on('close', () => {
      unsubscribe()
    })
  })
}
