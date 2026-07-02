import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  define: {
    __EDGE_API_URL__: JSON.stringify(
      process.env.VITE_EDGE_API_URL ?? 'http://localhost:8443',
    ),
  },
})
