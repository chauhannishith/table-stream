import { EventEmitter } from 'node:events'

export type HubStreamEvent = {
  event_type: string
  occurred_at: string
  location_id: string
  payload: Record<string, unknown>
}

class HubEventBus extends EventEmitter {
  publish(event: HubStreamEvent) {
    this.emit('event', event)
  }

  subscribe(listener: (event: HubStreamEvent) => void) {
    this.on('event', listener)
    return () => {
      this.off('event', listener)
    }
  }
}

export const hubEvents = new HubEventBus()

export function publishHubEvent(
  locationId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  hubEvents.publish({
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    location_id: locationId,
    payload,
  })
}
