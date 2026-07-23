import { Navigate, Route, Routes } from 'react-router-dom'
import {
  CounterHome,
  CustomerHome,
  KitchenHome,
  WaiterHome,
} from './features/role-homes'
import { resolveHomePath } from './lib/device-type'

function HomeRedirect() {
  return <Navigate to={resolveHomePath()} replace />
}

/** Role routes shared by BrowserRouter (prod) and MemoryRouter (tests). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/counter" element={<CounterHome />} />
      <Route path="/waiter" element={<WaiterHome />} />
      <Route path="/kitchen" element={<KitchenHome />} />
      <Route path="/customer" element={<CustomerHome />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
