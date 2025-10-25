const { test, expect } = require('@playwright/test');

test.describe('Tabulator Horizontal Fit Verification', () => {
  test('should load the Tabulator page and verify the table fits horizontally', async ({ page }) => {
    // Navigate to the local file
    await page.goto('file:///app/jules-scratch/verification/dirt-tabulator.php');

    // Wait for the table to be visible
    await expect(page.locator('#duplicatesTable')).toBeVisible();

    // Get the table element
    const tableElement = page.locator('#duplicatesTable .tabulator-table');

    // Get the width of the table and its container
    const tableWidth = await tableElement.evaluate(el => el.scrollWidth);
    const containerWidth = await page.locator('#duplicatesTable').evaluate(el => el.clientWidth);

    // Assert that the table width is less than or equal to the container width
    expect(tableWidth).toBeLessThanOrEqual(containerWidth);

    // Take a screenshot for visual confirmation
    await page.screenshot({ path: 'jules-scratch/verification/verification.png' });
  });
});
