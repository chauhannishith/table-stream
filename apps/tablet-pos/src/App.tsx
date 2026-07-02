import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

declare const __EDGE_API_URL__: string

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/waiter" element={<WaiterHome apiUrl={__EDGE_API_URL__} />} />
        <Route path="*" element={<Navigate to="/waiter" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function WaiterHome({ apiUrl }: { apiUrl: string }) {
  return (
    <main className="shell">
      <header>
        <h1>Waiter — Tablet POS</h1>
        <p className="muted">Edge hub: {apiUrl}</p>
      </header>
      <section className="card">
        <p>Local SQLite via PowerSync sync (client) + edge-server API.</p>
      </section>
    </main>
  )
}
