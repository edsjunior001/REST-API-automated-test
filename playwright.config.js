const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: process.env.API_BASE_URL || 'https://compassuol.serverest.dev',
    extraHTTPHeaders: {
      accept: 'application/json'
    },
    trace: 'retain-on-failure'
  }
})
