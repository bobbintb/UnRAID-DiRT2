const { test, expect } = require('@playwright/test');

test.describe('DIRT Tabulator Page Screenshot', () => {
  test('should load the page and take a screenshot', async ({ page }) => {
    await page.goto('http://localhost:8000/dirt-tabulator.php');

    // Wait for 10 seconds to allow the page to load, even if assets are missing.
    await page.waitForTimeout(10000);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results/screenshot-${timestamp}.png`;

    await page.screenshot({ path: filename, fullPage: true });
  });
});
