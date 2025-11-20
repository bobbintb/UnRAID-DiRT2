from playwright.sync_api import sync_playwright, expect

def test_link_icon(page):
    print("Navigating...")
    page.goto("http://localhost/plugins/bobbintb.system.dirt/index.php")
    page.wait_for_timeout(3000)

    hash_text = "hardlink_hash_123"
    hash_cell = page.get_by_text(hash_text)
    expect(hash_cell).to_be_visible(timeout=15000)
    hash_cell.scroll_into_view_if_needed()

    # Expand
    row = page.locator(".tabulator-row").filter(has=hash_cell).first
    if not row.locator(".nested-table-container").is_visible():
         row.locator(".tabulator-cell").first.click()

    nested_table = row.locator(".nested-table-container .tabulator-table")
    expect(nested_table).to_be_visible()

    # The hardlinked files (nlink > 1) should have the icon.
    print("Looking for hardlink icon...")
    icon = nested_table.locator("i.fa.fa-link[title='Hardlink']").first

    # Use attached instead of visible because icons might be 0-size if fonts fail or offscreen
    expect(icon).to_be_attached()

    style = icon.get_attribute("style")
    print(f"Icon style: {style}")
    assert "rotate(45deg)" in style
    print("Style verified.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 3000})
        try:
            test_link_icon(page)
            print("Test PASSED")
        except Exception as e:
            print(f"Test FAILED: {e}")
            page.screenshot(path="test-results/icon_failure.png")
        finally:
            browser.close()
