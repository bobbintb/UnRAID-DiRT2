const { test, expect } = require('@playwright/test');

/**
 * @fileoverview This script verifies the linked table functionality on the DataTables page.
 * It checks that when an action is selected for a file in the left table, the file
 * correctly appears in the right "action queue" table, and disappears when the action
 * is deselected.
 */
test.describe('DataTables Page - Linked Tables Verification', () => {

  test('should add and remove a file from the right table when an action is toggled', async ({ page }) => {
    // Arrange: Navigate to the page and wait for the left table to be populated.
    // The test:ui:prepare script renames dirt-datatables.page to temp_datatables.html
    await page.goto('file:///app/jules-scratch/verification/temp_datatables.html', { waitUntil: 'networkidle' });

    // Wait for the first group header to be visible in the left table as a sign of data loading.
    await expect(page.locator('#datatables-table tr.group').first()).toBeVisible({ timeout: 15000 });

    // Find all non-disabled rows in the left table.
    const availableRows = page.locator('#datatables-table tbody tr:not(.disabled-row)');
    const firstActionableRow = await availableRows.first();

    // Expect to find at least one actionable row.
    await expect(firstActionableRow).toBeVisible();

    // Act: Select the 'delete' action for the first available file.
    const deleteRadioButton = firstActionableRow.locator('input[type="radio"][value="delete"]');
    const filePath = await firstActionableRow.locator('td:nth-child(4)').textContent();

    await deleteRadioButton.click();

    // Assert: The file path should now be visible in the right table.
    const rightTable = page.locator('#right-table-datatables');
    await expect(rightTable.getByText(filePath.trim())).toBeVisible();

    // Check that the action is also correct
    const actionCell = rightTable.locator(`tr:has-text("${filePath.trim()}") td:first-child`);
    await expect(actionCell).toHaveText('delete');

    // Act: Deselect the action by clicking the radio button again.
    await deleteRadioButton.click();

    // Assert: The file path should now be gone from the right table.
    await expect(rightTable.getByText(filePath.trim())).not.toBeVisible();

    // The "No actions selected" message should be visible again if it's the only action.
    const rowCount = await rightTable.locator('tbody tr').count();
    if (rowCount === 0) {
        await expect(rightTable.getByText('No actions selected.')).toBeVisible();
    }

    // Screenshot: Capture the final state for visual verification.
    await page.screenshot({ path: 'jules-scratch/verification/verification.png' });
  });
});
