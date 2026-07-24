import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // happy-dom's fetch is intercepted by MSW; jsdom's often is not.
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
  },
  define: {
    __EDGE_API_URL__: JSON.stringify('http://localhost:8443'),
  },
})
