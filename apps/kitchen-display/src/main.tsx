import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

const EDGE_WS =
  import.meta.env.VITE_EDGE_WS_URL ?? 'ws://localhost:8443/v1/stream'

function KitchenDisplay() {
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    const ws = new WebSocket(EDGE_WS)
    ws.onmessage = (ev) => {
      setMessages((m) => [ev.data as string, ...m].slice(0, 20))
    }
    return () => ws.close()
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, background: '#111', color: '#eee', minHeight: '100vh' }}>
      <h1>Kitchen Line</h1>
      <p>Subscribed to edge-server stream</p>
      <ul>
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <KitchenDisplay />
  </StrictMode>,
)
