import { Navigate, Route, Routes } from 'react-router-dom'
import {
  CounterHome,
  CustomerHome,
  KitchenHome,
  WaiterHome,
} from './features/role-homes'
import { ROLE_ROUTES, resolveHomePath } from './lib/device-type'

function HomeRedirect() {
  return <Navigate to={resolveHomePath()} replace />
}

/** Role routes shared by BrowserRouter (prod) and MemoryRouter (tests). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path={ROLE_ROUTES.COUNTER} element={<CounterHome />} />
      <Route path={ROLE_ROUTES.WAITER} element={<WaiterHome />} />
      <Route path={ROLE_ROUTES.KITCHEN} element={<KitchenHome />} />
      <Route path={ROLE_ROUTES.CUSTOMER} element={<CustomerHome />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
