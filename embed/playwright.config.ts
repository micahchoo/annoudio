import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// WebKit on this machine needs two libraries that the OS does not have (see README, "WebKit").
const webkitDeps = resolve(import.meta.dirname, ".cache/webkit-deps");
if (existsSync(webkitDeps)) {
  process.env.LD_LIBRARY_PATH = [webkitDeps, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
}

const NO_PULSE = { ...process.env, PULSE_SERVER: "/nonexistent" };

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4520",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/build.mjs && node tests/fixture/server.mjs",
    url: "http://localhost:4510/embed/v1.js",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
  // The tests play a tone, and headless browsers still send sound to PulseAudio (README,
  // "Test"). Chromium and WebKit get a PulseAudio address that does not exist, so they
  // open no stream. Firefox stops playback without an audio device, so it plays at volume 0.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--mute-audio"], env: NO_PULSE } } },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], launchOptions: { firefoxUserPrefs: { "media.volume_scale": "0.0" } } },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"], launchOptions: { env: NO_PULSE } } },
  ],
});
