import { Navigate, Route, Routes } from 'react-router-dom'
import { NewTakeawayScreen } from './features/counter/NewTakeawayScreen'
import {
  CounterHome,
  CustomerHome,
  KitchenHome,
  WaiterHome,
} from './features/role-homes'
import { BillingSetupScreen } from './features/setup/billing/BillingSetupScreen'
import { CategoriesSetupScreen } from './features/setup/categories/CategoriesSetupScreen'
import { MenuItemsSetupScreen } from './features/setup/menu-items/MenuItemsSetupScreen'
import { ModifiersSetupScreen } from './features/setup/modifiers/ModifiersSetupScreen'
import { PrintersSetupScreen } from './features/setup/printers/PrintersSetupScreen'
import { StaffSetupScreen } from './features/setup/staff/StaffSetupScreen'
import { TablesSetupScreen } from './features/setup/tables/TablesSetupScreen'
import { TagsSetupScreen } from './features/setup/tags/TagsSetupScreen'
import { ZonePricesSetupScreen } from './features/setup/zone-prices/ZonePricesSetupScreen'
import { ZonesSetupScreen } from './features/setup/zones/ZonesSetupScreen'
import {
  COUNTER_SETUP_BILLING_PATH,
  COUNTER_SETUP_CATEGORIES_PATH,
  COUNTER_SETUP_MENU_ITEMS_PATH,
  COUNTER_SETUP_MODIFIERS_PATH,
  COUNTER_SETUP_PRINTERS_PATH,
  COUNTER_SETUP_STAFF_PATH,
  COUNTER_SETUP_TABLES_PATH,
  COUNTER_SETUP_TAGS_PATH,
  COUNTER_SETUP_ZONE_PRICES_PATH,
  COUNTER_SETUP_ZONES_PATH,
  COUNTER_TAKEAWAY_NEW_PATH,
  ROLE_ROUTES,
  resolveHomePath,
} from './lib/device-type'

function HomeRedirect() {
  return <Navigate to={resolveHomePath()} replace />
}

/** Role routes shared by BrowserRouter (prod) and MemoryRouter (tests). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path={ROLE_ROUTES.COUNTER} element={<CounterHome />} />
      <Route
        path={COUNTER_TAKEAWAY_NEW_PATH}
        element={<NewTakeawayScreen />}
      />
      <Route path={COUNTER_SETUP_ZONES_PATH} element={<ZonesSetupScreen />} />
      <Route
        path={COUNTER_SETUP_MENU_ITEMS_PATH}
        element={<MenuItemsSetupScreen />}
      />
      <Route path={COUNTER_SETUP_STAFF_PATH} element={<StaffSetupScreen />} />
      <Route
        path={COUNTER_SETUP_CATEGORIES_PATH}
        element={<CategoriesSetupScreen />}
      />
      <Route path={COUNTER_SETUP_TAGS_PATH} element={<TagsSetupScreen />} />
      <Route
        path={COUNTER_SETUP_MODIFIERS_PATH}
        element={<ModifiersSetupScreen />}
      />
      <Route
        path={COUNTER_SETUP_ZONE_PRICES_PATH}
        element={<ZonePricesSetupScreen />}
      />
      <Route
        path={COUNTER_SETUP_BILLING_PATH}
        element={<BillingSetupScreen />}
      />
      <Route
        path={COUNTER_SETUP_TABLES_PATH}
        element={<TablesSetupScreen />}
      />
      <Route
        path={COUNTER_SETUP_PRINTERS_PATH}
        element={<PrintersSetupScreen />}
      />
      <Route path={ROLE_ROUTES.WAITER} element={<WaiterHome />} />
      <Route path={ROLE_ROUTES.KITCHEN} element={<KitchenHome />} />
      <Route path={ROLE_ROUTES.CUSTOMER} element={<CustomerHome />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
