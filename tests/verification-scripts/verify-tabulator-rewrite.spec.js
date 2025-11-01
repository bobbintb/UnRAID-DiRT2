const { test, expect } = require('@playwright/test');

/**
 * @fileoverview Verifies the functionality of the rewritten dirt-tabulator.page.
 * This script tests the two-table layout, reactive data synchronization,
 * 'original file' selection, and action queuing/dequeuing between the two tables.
 */
test.describe('Tabulator Rewrite Verification', () => {
  test('should load data, sync tables, and handle user interactions correctly', async ({ page }) => {
    // A. Navigate to the prepared page file for local testing.
    await page.goto('file:///app/jules-scratch/verification/temp_tabulator.html', { waitUntil: 'networkidle' });

    // A. Handle confirmation dialogs automatically by accepting them.
    page.on('dialog', dialog => dialog.accept());

    // A. Define locators for key elements to improve readability.
    const leftTable = page.locator('#left-table');
    const rightTable = page.locator('#right-table-element');
    const firstGroupInLeftTable = leftTable.locator('.tabulator-group').first();
    const firstRowInFirstGroup = firstGroupInLeftTable.locator('.tabulator-row').first();
    const secondRowInFirstGroup = firstGroupInLeftTable.locator('.tabulator-row').nth(1);

    // 1. Verify Layout and Initial Data Load
    // A. Check if both main table containers are visible.
    await expect(leftTable).toBeVisible();
    await expect(rightTable).toBeVisible();

    // A. Wait for data to load by checking for the first group header in the left table.
    await expect(firstGroupInLeftTable).toBeVisible();

    // A. Check that the right table is initially empty.
    await expect(rightTable.locator('.tabulator-placeholder-contents')).toHaveText('No actions queued');

    // 2. Verify Default 'Original File' State
    // A. The first row should be the default 'original' and thus be disabled.
    await expect(firstRowInFirstGroup).toHaveClass(/disabled-row/);
    await expect(firstRowInFirstGroup.locator('input[type="radio"]')).toBeChecked();

    // A. The second row should not be disabled.
    await expect(secondRowInFirstGroup).not.toHaveClass(/disabled-row/);
    await expect(secondRowInFirstGroup.locator('input[type="radio"]')).not.toBeChecked();

    // 3. Test Changing 'Original File' Selection
    // A. Click the radio button on the second row.
    await secondRowInFirstGroup.locator('input[type="radio"]').click();

    // A. Now, the second row should be disabled, and the first should be enabled.
    await expect(secondRowInFirstGroup).toHaveClass(/disabled-row/);
    await expect(firstRowInFirstGroup).not.toHaveClass(/disabled-row/);

    // 4. Test Queuing an Action (Left Table -> Right Table)
    // A. The first row is now selectable. Click its delete icon.
    await firstRowInFirstGroup.locator('.fa-trash').click();

    // A. The right table should now contain exactly one row.
    await expect(rightTable.locator('.tabulator-row')).toHaveCount(1);

    // A. Verify the row in the right table has the correct 'delete' icon.
    const queuedRowIcon = rightTable.locator('.tabulator-row .fa-trash');
    await expect(queuedRowIcon).toBeVisible();
    await expect(queuedRowIcon).toHaveCSS('color', 'rgb(255, 0, 0)'); // red

    // 5. Test De-Queuing an Action (Right Table -> Left Table)
    // A. Click the icon in the right table to remove the action.
    await queuedRowIcon.click();

    // A. The right table should become empty again.
    await expect(rightTable.locator('.tabulator-placeholder-contents')).toHaveText('No actions queued');

    // A. The delete icon in the left table for that row should revert to its default color.
    await expect(firstRowInFirstGroup.locator('.fa-trash')).not.toHaveCSS('color', 'rgb(255, 0, 0)');

    // 6. Test Header 'Clear Queue' Functionality
    // A. Add two different actions to the queue from the left table.
    await firstRowInFirstGroup.locator('.fa-trash').click();
    // The second row is original/disabled, so we use the third row
    await firstGroupInLeftTable.locator('.tabulator-row').nth(2).locator('.fa-link').click();

    // A. The right table should now have two rows.
    await expect(rightTable.locator('.tabulator-row')).toHaveCount(2);

    // A. Click the master trash icon in the right table's header.
    await rightTable.locator('.tabulator-header .fa-trash').click();

    // A. The right table should be empty once more.
    await expect(rightTable.locator('.tabulator-placeholder-contents')).toHaveText('No actions queued');

    // B. Take a screenshot of the final state for verification.
    await page.screenshot({ path: '/app/jules-scratch/verification/tabulator-rewrite-final-state.png' });
  });
});
