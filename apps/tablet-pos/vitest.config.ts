import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  define: {
    __EDGE_API_URL__: JSON.stringify('http://localhost:8443'),
  },
})
