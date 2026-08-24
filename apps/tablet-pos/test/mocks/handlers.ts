import { floorHandlers } from './floor-handlers'
import { menuCatalogHandlers } from './menu-catalog-handlers'
import { menuModifierHandlers } from './menu-modifier-handlers'
import { orderCheckoutHandlers } from './order-checkout-handlers'
import { orderDraftHandlers } from './order-draft-handlers'
import { printerHandlers } from './printer-handlers'
import { sessionHandlers } from './session-handlers'
import { staffHandlers } from './staff-handlers'

/** Default MSW handlers for hub API happy paths used in component tests. */
export const handlers = [
  ...sessionHandlers,
  ...floorHandlers,
  ...orderDraftHandlers,
  ...orderCheckoutHandlers,
  ...menuCatalogHandlers,
  ...menuModifierHandlers,
  ...staffHandlers,
  ...printerHandlers,
]

export {
  resetBillingStore,
  resetZonesStore,
  resetTablesStore,
  resetOrdersStore,
  resetMenuStore,
  resetStaffStore,
  resetPrintersStore,
} from './stores'
