const { test, expect } = require('@playwright/test');

/**
 * @fileoverview Verifies the full end-to-end functionality of the rewritten dirt-tabulator.page.
 * This script tests the two-table layout, reactive data synchronization,
 * 'original file' selection, action queuing/dequeuing, and backend persistence.
 */
test.describe('Tabulator Rewrite E2E Verification', () => {
  test('should correctly save and restore state from the backend', async ({ page }) => {
    // A. Navigate to the page and handle dialogs.
    await page.goto('file:///app/jules-scratch/verification/temp_tabulator.html', { waitUntil: 'networkidle' });
    page.on('dialog', dialog => dialog.accept());

    // A. Define locators for key elements.
    const leftTable = page.locator('#left-table');
    const rightTable = page.locator('#right-table-element');
    const firstGroup = leftTable.locator('.tabulator-group').first();
    const firstRow = firstGroup.locator('.tabulator-row').first();
    const secondRow = firstGroup.locator('.tabulator-row').nth(1);

    // 1. Initial State Verification
    // A. Wait for the left table to populate.
    await expect(firstRow).toBeVisible();
    // A. Ensure the right table is initially empty.
    await expect(rightTable.locator('.tabulator-placeholder-contents')).toHaveText('No actions queued');

    // 2. Add an Action and Verify UI Update + Backend Persistence
    // A. The first row is the default "original", so click the second row's radio to enable the first.
    await secondRow.locator('input[type="radio"]').click();
    await expect(firstRow).not.toHaveClass(/disabled-row/);

    // A. Click the 'delete' icon on the now-enabled first row.
    await firstRow.locator('.fa-trash').click();

    // A. Assert that the action appears immediately in the right table.
    await expect(rightTable.locator('.tabulator-row')).toHaveCount(1);
    await expect(rightTable.locator('.tabulator-row .fa-trash')).toBeVisible();

    // A. Reload the page to test if the action was saved by the backend.
    await page.reload({ waitUntil: 'networkidle' });

    // A. After reload, the action should still be present in the right table.
    // We must re-define locators after a page reload.
    const rightTableAfterAdd = page.locator('#right-table-element');
    await expect(rightTableAfterAdd.locator('.tabulator-row')).toBeVisible(); // Wait for data to load
    await expect(rightTableAfterAdd.locator('.tabulator-row')).toHaveCount(1);
    const queuedActionIcon = rightTableAfterAdd.locator('.tabulator-row .fa-trash');
    await expect(queuedActionIcon).toBeVisible();

    // 3. Remove the Action and Verify UI Update + Backend Persistence
    // A. Click the 'delete' icon in the right table to remove the action.
    await queuedActionIcon.click();

    // A. Assert that the right table becomes empty immediately.
    await expect(rightTableAfterAdd.locator('.tabulator-placeholder-contents')).toHaveText('No actions queued');

    // A. Reload the page one more time to test if the removal was saved.
    await page.reload({ waitUntil: 'networkidle' });

    // A. After the second reload, the right table should still be empty.
    const rightTableAfterRemove = page.locator('#right-table-element');
    await expect(rightTableAfterRemove.locator('.tabulator-placeholder-contents')).toHaveText('No actions queued');

    // 4. Final Screenshot
    // A. Capture the final, correct state for visual verification.
    await page.screenshot({ path: '/app/jules-scratch/verification/tabulator-final-e2e-state.png' });
  });
});
