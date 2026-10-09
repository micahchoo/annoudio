import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // The integration tests share one test database, and each file starts Payload,
    // which drops and pushes the schema. Run the files one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://annoudio:annoudio@127.0.0.1:5432/annoudio_test',
      PAYLOAD_DROP_DATABASE: 'true',
      ANNOUDIO_ORIGIN: 'https://org.example',
    },
  },
})
