const { test, expect } = require('@playwright/test');

test.describe('Original File Selection Verification', () => {

  test('Tabulator: should select the first row by default and allow changing the selection', async ({ page }) => {
    await page.goto('http://localhost:41821/dirt-tabulator.php', { waitUntil: 'networkidle' });

    // Wait for the table to be visible and contain at least one group.
    const firstGroup = page.locator('.tabulator-group').first();
    await expect(firstGroup).toBeVisible({ timeout: 15000 });

    // Get the first and second rows within that group
    const firstRow = firstGroup.locator('+ .tabulator-row').first();
    const secondRow = firstGroup.locator('+ .tabulator-row').nth(1);
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    // 1. Verify the first row is selected by default.
    await expect(firstRow.locator('input[type="radio"]')).toBeChecked();
    await expect(firstRow).toHaveClass(/disabled-row/);
    await expect(secondRow.locator('input[type="radio"]')).not.toBeChecked();
    await expect(secondRow).not.toHaveClass(/disabled-row/);

    // 2. Click the radio button on the second row.
    await secondRow.locator('input[type="radio"]').click();

    // 3. Verify the second row is now selected and the first is not.
    await expect(secondRow.locator('input[type="radio"]')).toBeChecked();
    await expect(secondRow).toHaveClass(/disabled-row/);
    await expect(firstRow.locator('input[type="radio"]')).not.toBeChecked();
    await expect(firstRow).not.toHaveClass(/disabled-row/);

    await page.screenshot({ path: 'tests/verification-scripts/tabulator-selection.png' });
  });

  test('DataTables: should select the first row by default and allow changing the selection', async ({ page }) => {
    await page.goto('http://localhost:41821/dirt-datatables.php', { waitUntil: 'networkidle' });

    // Wait for the table to be visible and contain at least one group.
    const firstGroup = page.locator('tr.group').first();
    await expect(firstGroup).toBeVisible({ timeout: 15000 });

    // Get the first and second rows within that group
    const firstRow = firstGroup.locator('+ tr');
    const secondRow = firstRow.locator('+ tr');
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    // 1. Verify the first row is selected by default.
    await expect(firstRow).toHaveClass(/selected/);
    await expect(firstRow).toHaveClass(/disabled-row/);
    await expect(secondRow).not.toHaveClass(/selected/);
    await expect(secondRow).not.toHaveClass(/disabled-row/);

    // 2. Click the checkbox on the second row.
    await secondRow.locator('.select-checkbox').click();

    // 3. Verify the second row is now selected and the first is not.
    await expect(secondRow).toHaveClass(/selected/);
    await expect(secondRow).toHaveClass(/disabled-row/);
    await expect(firstRow).not.toHaveClass(/selected/);
    await expect(firstRow).not.toHaveClass(/disabled-row/);

    await page.screenshot({ path: 'tests/verification-scripts/datatables-selection.png' });
  });

});
