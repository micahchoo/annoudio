// The plugins on the running test hosts (deploy/test-hosts, install-plugins.sh first),
// against the demo stack (deploy/DEMO.md). Chromium only, muted.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    browserName: "chromium",
    launchOptions: { args: ["--mute-audio"] },
    trace: "retain-on-failure",
  },
  // The demo recording's audio (127.0.0.1:4610). An instance that already runs is used.
  webServer: {
    command: "STACK_PORT=4610 HOST_PORT=4620 node tests/fixture/server.mjs",
    cwd: "../../embed",
    url: "http://127.0.0.1:4610/media/tone.m4a",
    reuseExistingServer: true,
  },
});
