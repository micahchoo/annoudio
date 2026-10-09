import { defineConfig } from 'vitest/config'

// The global setup and the test files read this. The database is on the annoudio-dev stack.
process.env.TEST_DATABASE_URL ??= 'postgres://annoudio:annoudio@127.0.0.1:5432/annoudio_worker_test'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // The jobs tests share one test database. Run the files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
