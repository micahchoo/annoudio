import { defineConfig, devices } from '@playwright/test'

import { E2E_DATABASE_URL, E2E_MEDIA_DIR, E2E_ORIGIN, E2E_PORT } from './tests/e2e/env'

// The end-to-end tests start their own `next dev` on port 3100, with the test
// mailbox on (ANNOUDIO_TEST_MAILBOX=1) and the test database. The test process uses the
// same database to seed and to publish through the `stories` interface.
export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The tests share one database and one server.
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      // The player tests play a tone. Headless Chromium still sends sound to PulseAudio:
      // mute it, and give it a PulseAudio address that does not exist, so it opens no stream.
      // The voice note test records from Chromium's fake microphone (a beep), with no prompt.
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: ['--mute-audio', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
          env: { ...process.env, PULSE_SERVER: '/nonexistent' },
        },
      },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${E2E_PORT}`,
    url: `${E2E_ORIGIN}/admin/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ANNOUDIO_TEST_MAILBOX: '1',
      NODE_OPTIONS: '--no-deprecation',
      NEXT_DIST_DIR: '.next-e2e',
      DATABASE_URL: E2E_DATABASE_URL,
      ANNOUDIO_ORIGIN: E2E_ORIGIN,
      SMTP_URL: '',
      MEDIA_DIR: E2E_MEDIA_DIR,
      // This server takes the media.settled reports. The test process never does.
      ANNOUDIO_MEDIA_CONSUMER: '1',
    },
  },
})
