const { test, expect } = require('@playwright/test');

test.describe('Action Queue Verification', () => {
  test('should display the main table and the action queue table side-by-side', async ({ page }) => {
    // Navigate to the prepared page. The orchestrator script handles the URL.
    await page.goto('http://localhost:41821/dirt-tabulator.php', { waitUntil: 'networkidle' });

    // Wait for the main table to be visible and contain at least one group row.
    const mainTable = page.locator('#duplicatesTable');
    await expect(mainTable).toBeVisible();
    await expect(mainTable.locator('.tabulator-row.tabulator-tree-level-0').first()).toBeVisible({ timeout: 15000 });

    // Wait for the action queue table to be visible.
    const actionQueueTable = page.locator('#action-queue-table');
    await expect(actionQueueTable).toBeVisible();

    // Take a screenshot of the entire page.
    await page.screenshot({ path: 'tests/verification-scripts/action-queue-screenshot.png', fullPage: true });
  });
});
