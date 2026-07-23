declare const __EDGE_API_URL__: string

type RoleHomeProps = {
  title: string
  description: string
}

function RoleHome({ title, description }: RoleHomeProps) {
  return (
    <main className="shell">
      <header>
        <h1>{title}</h1>
        <p className="muted">Edge hub: {__EDGE_API_URL__}</p>
      </header>
      <section className="card">
        <p>{description}</p>
      </section>
    </main>
  )
}

export function CounterHome() {
  return (
    <RoleHome
      title="Counter"
      description="Takeaway intake, billing, and setup. Coming in Phase F1."
    />
  )
}

export function WaiterHome() {
  return (
    <RoleHome
      title="Waiter"
      description="Zone-filtered table map and dine-in orders. Coming in Phase F3."
    />
  )
}

export function KitchenHome() {
  return (
    <RoleHome
      title="Kitchen"
      description="KDS queue and line status. Coming in Phase F2."
    />
  )
}

export function CustomerHome() {
  return (
    <RoleHome
      title="Customer"
      description="Takeaway pickup display. Coming in Phase F2."
    />
  )
}
