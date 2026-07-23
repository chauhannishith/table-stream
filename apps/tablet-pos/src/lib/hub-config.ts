declare const __EDGE_API_URL__: string

/** Hub REST base URL from Vite define / VITE_EDGE_API_URL. */
export function getEdgeApiUrl(): string {
  return __EDGE_API_URL__.replace(/\/$/, '')
}
