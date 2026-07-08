import type { FastifyPluginAsync } from 'fastify'

export const streamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stream', { websocket: true }, (socket) => {
    socket.send(
      JSON.stringify({ type: 'connected', hub_id: app.hubConfig.hub_id }),
    )
    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      socket.send(JSON.stringify({ type: 'ack', received: raw.toString() }))
    })
  })
}
