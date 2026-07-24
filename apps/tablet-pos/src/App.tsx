import { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { StaffLoginScreen } from './features/auth/StaffLoginScreen'
import { PairingScreen } from './features/pairing/PairingScreen'
import { HubStatusBar } from './features/status/HubStatusBar'
import { getDeviceToken, getStaffToken } from './lib/auth-storage'
import { deviceRequiresStaffLogin } from './lib/staff-login'

export function App() {
  const [paired, setPaired] = useState(() => Boolean(getDeviceToken()))
  const [staffLoggedIn, setStaffLoggedIn] = useState(() =>
    Boolean(getStaffToken()),
  )

  if (!paired) {
    return (
      <PairingScreen
        onPaired={() => {
          setPaired(true)
          setStaffLoggedIn(Boolean(getStaffToken()))
        }}
      />
    )
  }

  if (deviceRequiresStaffLogin() && !staffLoggedIn) {
    return <StaffLoginScreen onLoggedIn={() => setStaffLoggedIn(true)} />
  }

  return (
    <BrowserRouter>
      <div className="app-frame">
        <HubStatusBar />
        <AppRoutes />
      </div>
    </BrowserRouter>
  )
}
