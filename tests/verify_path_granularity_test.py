from playwright.sync_api import sync_playwright, expect
import re

def test_path_granularity(page):
    print("Navigating to page...")
    page.goto("http://localhost/plugins/bobbintb.system.dirt/index.php")

    # Wait for WebSocket connection and initial data load
    print("Waiting for data load...")
    page.wait_for_timeout(3000)

    # Locate the row by the hash text
    hash_text = "hardlink_hash_123"
    print(f"Looking for row with hash: {hash_text}")
    hash_cell = page.get_by_text(hash_text)
    expect(hash_cell).to_be_visible(timeout=15000)

    # Scroll into view explicitly
    hash_cell.scroll_into_view_if_needed()

    # Get the row element
    row = page.locator(".tabulator-row").filter(has=hash_cell).first

    # Check nested table visibility
    nested_table_holder = row.locator(".nested-table-container")

    # If hidden, click expand.
    if not nested_table_holder.is_visible():
        print("Nested table hidden, clicking expand...")
        expand_icon = row.locator(".tabulator-cell").first
        expand_icon.click()
    else:
        print("Nested table already visible.")

    expect(nested_table_holder).to_be_visible()

    # Get rows in the nested table.
    nested_table = nested_table_holder.locator(".tabulator-table")
    nested_rows = nested_table.locator(".tabulator-row")

    # Expect 3 rows
    expect(nested_rows).to_have_count(3)

    # Get the 3 rows
    row1 = nested_rows.nth(0)
    row2 = nested_rows.nth(1)

    # Test Action: Click Delete on Row 1
    print("Clicking Delete on Row 1...")
    trash_icon_1 = row1.locator(".fa-trash")
    trash_icon_1.click(force=True)
    # Check for 'selected' class
    expect(trash_icon_1).to_have_class(re.compile(r"selected"))

    # Test Action: Row 2 should NOT be selected
    trash_icon_2 = row2.locator(".fa-trash")
    expect(trash_icon_2).not_to_have_class(re.compile(r"selected"))

    # Test Original: Click Radio on Row 2
    print("Clicking Original on Row 2...")
    radio_2 = row2.locator("input[type='radio']")
    radio_2.click(force=True)

    # Row 2 should be 'original-row'
    expect(row2).to_have_class(re.compile(r"original-row"))

    # Row 1 should NOT be 'original-row'
    expect(row1).not_to_have_class(re.compile(r"original-row"))

    # Take final screenshot
    page.screenshot(path="test-results/verification_actions.png")
    print("Verification Complete.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 3000}) # Large viewport
        try:
            test_path_granularity(page)
            print("Test PASSED")
        except Exception as e:
            print(f"Test FAILED: {e}")
            page.screenshot(path="test-results/verification_failure.png")
        finally:
            browser.close()
