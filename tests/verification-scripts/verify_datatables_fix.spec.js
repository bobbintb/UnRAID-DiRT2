
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Function to prepare the HTML file for Playwright
function preparePageFile(pagePath) {
    const tempDir = path.join(__dirname, '../../jules-scratch/verification');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    let content = fs.readFileSync(pagePath, 'utf8');

    // Remove Unraid-specific frontmatter
    const frontmatterEnd = content.indexOf('---');
    if (frontmatterEnd !== -1) {
        content = content.substring(frontmatterEnd + 4);
    }

    // Replace absolute paths with relative paths for local testing
    content = content.replace(/\/plugins\/bobbintb\.system\.dirt/g, '../..');

    const tempFileName = `temp_${path.basename(pagePath, '.page')}.html`;
    const tempFilePath = path.join(tempDir, tempFileName);
    fs.writeFileSync(tempFilePath, content);

    return `file://${tempFilePath}`;
}

test.describe('DataTables Row State Synchronization', () => {
    let fileUrl;

    test.beforeAll(() => {
        const pagePath = path.join(__dirname, '../../dirt-datatables.page');
        fileUrl = preparePageFile(pagePath);
    });

    test('should deselect action radio when a new original file is chosen', async ({ page }) => {
        await page.goto(fileUrl);

        // Wait for the table to be populated by the WebSocket data.
        // We look for a group row as a sign that the data is loaded.
        await page.waitForSelector('tr.group');

        // Find the first non-original row
        const firstNonOriginalRow = page.locator('tr:not(.disabled-row)').first();
        await expect(firstNonOriginalRow).toBeVisible();

        // 1. Select the 'delete' action for this row
        const deleteRadio = firstNonOriginalRow.locator('input[type="radio"][value="delete"]');
        await deleteRadio.check();
        await expect(deleteRadio).toBeChecked();

        // 2. Now, select this same row as the new 'original' file
        const originalRadio = firstNonOriginalRow.locator('input.original-file-radio');
        await originalRadio.check();

        // 3. Assert that the 'delete' radio is now unchecked
        await expect(deleteRadio).not.toBeChecked();

        // 4. Take a screenshot for visual confirmation
        await page.screenshot({ path: 'jules-scratch/verification/datatables-fix-verification.png' });
    });
});
