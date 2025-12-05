import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests/integration',

    /* Run tests in files in parallel */
    fullyParallel: false,

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Opt out of parallel tests on CI. */
    workers: 1,

    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',

    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'https://localhost:5173',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Ignore HTTPS errors for local development */
        ignoreHTTPSErrors: true,

        /* Video recording for failed tests */
        video: 'retain-on-failure',
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    /* 
    webServer: [
        {
            command: 'npm run dev',
            url: 'https://localhost:5173',
            reuseExistingServer: !process.env.CI,
            ignoreHTTPSErrors: true,
            timeout: 120000,
        },
        {
            command: 'npm run dev:server',
            url: 'http://localhost:3001',
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
        },
    ],
    */

    /* Global timeout for each test */
    timeout: 60000,
});
