// tests/verification-scripts/verify-tabulator-layout.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Tabulator Page Layout Verification', () => {
  test('should render the group header with the correct layout', async ({ page }) => {
    // Navigate to the prepared Tabulator page
    await page.goto('http://localhost:41820/jules-scratch/verification/temp_tabulator.html', { waitUntil: 'networkidle' });

    // Wait for the table to be populated and the first group header to be visible.
    const firstGroupHeader = page.locator('.tabulator-group').first();
    await expect(firstGroupHeader).toBeVisible({ timeout: 15000 });

    // The group header contains a custom flex container.
    const flexContainer = firstGroupHeader.locator('.group-header-flex-container');
    await expect(flexContainer).toBeVisible();

    // Verify the toggle arrow is the first child inside the flex container as per the DOM manipulation.
    const firstChild = flexContainer.locator('> :first-child');
    await expect(firstChild).toHaveClass(/tabulator-group-toggle/);

    // Take a screenshot to visually confirm the final alignment.
    await page.screenshot({ path: '/app/jules-scratch/tabulator_layout_final.png', fullPage: true });
  });
});
