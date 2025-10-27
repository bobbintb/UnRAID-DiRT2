// tests/verification-scripts/simple-screenshot.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Tabulator Page Screenshot Verification', () => {
  test('should take a screenshot of the final layout', async ({ page }) => {
    // Navigate to the prepared Tabulator page
    await page.goto('http://localhost:41820/jules-scratch/verification/temp_tabulator.html', { waitUntil: 'networkidle' });

    // Wait for the table to be populated and the first group header to be visible.
    const firstGroupHeader = page.locator('.tabulator-group').first();
    await expect(firstGroupHeader).toBeVisible({ timeout: 15000 });

    // Take a screenshot to visually confirm the final alignment.
    await page.screenshot({ path: '/app/jules-scratch/final_tabulator_layout.png', fullPage: true });
  });
});
