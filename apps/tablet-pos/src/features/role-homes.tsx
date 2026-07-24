import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  COUNTER_SETUP_MENU_ITEMS_PATH,
  COUNTER_SETUP_ZONES_PATH,
} from '../lib/device-type'

declare const __EDGE_API_URL__: string

type RoleHomeProps = {
  title: string
  description: string
  children?: ReactNode
}

function RoleHome({ title, description, children }: RoleHomeProps) {
  return (
    <main className="shell">
      <header>
        <h1>{title}</h1>
        <p className="muted">Edge hub: {__EDGE_API_URL__}</p>
      </header>
      <section className="card">
        <p>{description}</p>
        {children}
      </section>
    </main>
  )
}

export function CounterHome() {
  return (
    <RoleHome
      title="Counter"
      description="Takeaway intake, billing, and setup."
    >
      <nav className="setup-nav">
        <Link to={COUNTER_SETUP_ZONES_PATH}>Setup: Zones</Link>
        <Link to={COUNTER_SETUP_MENU_ITEMS_PATH}>Setup: Menu items</Link>
      </nav>
    </RoleHome>
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
