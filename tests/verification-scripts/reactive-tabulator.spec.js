const { test, expect } = require('@playwright/test');

test.describe('Reactive Tabulator Functionality', () => {
    test.beforeEach(async ({ page }) => {
        const errors = [];
        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        await page.goto('file:///app/jules-scratch/verification/temp_tabulator.html');

        // Fail the test if there were any console errors during page load
        if (errors.length > 0) {
            throw new Error(`Page loaded with errors: ${errors.join('\n')}`);
        }

        // Wait for the table to be populated
        await expect(page.locator('#duplicatesTable .tabulator-row')).toHaveCount(10);
    });

    test('should load the page without console errors', async ({ page }) => {
        // This test is implicitly passed by the beforeEach hook.
        // If there were errors, the hook would have thrown an exception.
        expect(true).toBe(true);
    });

    test('should update action queue when an action is selected', async ({ page }) => {
        // Find the first non-disabled row and select the 'delete' action
        const firstRow = page.locator('#duplicatesTable .tabulator-row:not(.disabled-row)').first();
        await firstRow.locator('input[value="delete"]').click();

        // Verify the action queue table now has one row
        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(1);
        const actionQueueRow = page.locator('#action-queue-table .tabulator-row').first();
        await expect(actionQueueRow.locator('.tabulator-cell[tabulator-field="queuedAction"]')).toHaveText('delete');
    });

    test('should remove from action queue when an action is deselected', async ({ page }) => {
        const firstRow = page.locator('#duplicatesTable .tabulator-row:not(.disabled-row)').first();
        const deleteRadio = firstRow.locator('input[value="delete"]');

        // Select and then deselect the action
        await deleteRadio.click();
        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(1);
        await deleteRadio.click();

        // Verify the action queue table is now empty
        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(0);
    });

    test('should disable row and clear action when set as original', async ({ page }) => {
        const secondRow = page.locator('#duplicatesTable .tabulator-row').nth(1);
        const linkRadio = secondRow.locator('input[value="link"]');
        const primaryRadio = secondRow.locator('input[name*="primary_group"]');

        // Select an action for the second row
        await linkRadio.click();
        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(1);

        // Now, set the second row as the original file
        await primaryRadio.click();

        // Verify the row is now disabled
        await expect(secondRow).toHaveClass(/disabled-row/);

        // Verify the action queue is now empty because the action was cleared
        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(0);
    });

    test('should correctly apply group header actions', async ({ page }) => {
        const firstGroup = page.locator('#duplicatesTable .tabulator-group').first();
        await firstGroup.locator('input[value="delete"]').click();

        // The first group has 5 files, one of which is original/disabled.
        // So, 4 files should have the 'delete' action and appear in the queue.
        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(4);
    });

    test('should clear the queue when the "Remove All" header is clicked', async ({ page }) => {
        // Select all deletable files
        const headerAction = page.locator('#duplicatesTable .tabulator-header .group-action-container input[value="delete"]');
        await headerAction.click();

        // There are 10 files total, 2 are original. So 8 should be in the queue.
        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(8);

        // Now, clear the queue
        const clearQueueButton = page.locator('#action-queue-table .tabulator-header .fa-trash');
        await clearQueueButton.click();

        await expect(page.locator('#action-queue-table .tabulator-row')).toHaveCount(0);
    });
});
