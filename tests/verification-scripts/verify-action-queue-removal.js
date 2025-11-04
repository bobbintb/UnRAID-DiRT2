const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Action Queue Removal Verification', () => {
  test('should allow removing an action from the queue table', async ({ page }) => {
    // Navigate to the prepared page.
    const htmlPath = path.resolve(process.cwd(), 'jules-scratch', 'verification', 'temp_tabulator.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

    // Wait for the main table to be visible and have data.
    const mainTable = page.locator('#duplicatesTable');
    await expect(mainTable.locator('.tabulator-row.tabulator-tree-level-1').first()).toBeVisible({ timeout: 15000 });

    // 1. Act: Add an action to the queue.
    // Find the first non-disabled file row and click its 'Delete' radio button.
    const firstFileRow = mainTable.locator('.tabulator-row.tabulator-tree-level-1:not(.disabled-row)').first();
    await firstFileRow.locator('input[type="radio"][value="delete"]').click();

    // Add a small wait to allow the async UI update to complete
    await page.waitForTimeout(500);

    // 2. Assert: Verify the action appears in the queue table.
    const actionQueueTable = page.locator('#action-queue-table');
    await expect(actionQueueTable.locator('.tabulator-row')).toHaveCount(1);
    await expect(actionQueueTable.locator('.tabulator-cell[tabulator-field="action"]')).toHaveText('Delete');

    // 3. Act: Click the 'Remove' button in the action queue.
    await actionQueueTable.locator('.tabulator-cell[tabulator-field="remove"]').click();

    // Add a small wait to allow the async UI update to complete
    await page.waitForTimeout(500);

    // 4. Assert: Verify the action is removed from the queue table.
    await expect(actionQueueTable.locator('.tabulator-row')).toHaveCount(0);
    await expect(actionQueueTable.locator('.tabulator-placeholder-contents')).toHaveText('No actions queued');

    // 5. Assert: Verify the radio button in the main table is unchecked.
    await expect(firstFileRow.locator('input[type="radio"][value="delete"]')).not.toBeChecked();

    // Take a screenshot of the final state.
    const screenshotPath = path.resolve(process.cwd(), 'tests', 'verification-scripts', 'action-queue-removal.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
