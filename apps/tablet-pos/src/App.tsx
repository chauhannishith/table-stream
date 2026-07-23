import { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { PairingScreen } from './features/pairing/PairingScreen'
import { getDeviceToken } from './lib/auth-storage'

export function App() {
  const [paired, setPaired] = useState(() => Boolean(getDeviceToken()))

  if (!paired) {
    return <PairingScreen onPaired={() => setPaired(true)} />
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
