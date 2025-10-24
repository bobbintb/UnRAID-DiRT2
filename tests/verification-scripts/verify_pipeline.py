from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    base_path = os.path.join(project_root, 'jules-scratch', 'verification')

    # --- Verify Tabulator Page ---
    tabulator_path = os.path.join(base_path, 'temp_tabulator.html')
    page.goto(f"file:///{tabulator_path}")

    # Wait for the table to be populated by checking for a known file path from a duplicate group
    expect(page.get_by_text("/mnt/user/photos/vacation/IMG_001.jpg")).to_be_visible()
    print("Tabulator page successfully loaded and verified seed data.")

    page.screenshot(path=os.path.join(base_path, "screenshot-tabulator-verified.png"))
    print("Tabulator page screenshot captured.")

    # --- Verify DataTables Page ---
    datatables_path = os.path.join(base_path, 'temp_datatables.html')
    page.goto(f"file:///{datatables_path}")

    # Wait for the table to be populated
    expect(page.get_by_text("/mnt/user/downloads/document.pdf")).to_be_visible()
    print("DataTables page successfully loaded and verified seed data.")

    page.screenshot(path=os.path.join(base_path, "screenshot-datatables-verified.png"))
    print("DataTables page screenshot captured.")

    browser.close()
    print("Verification script completed successfully.")

with sync_playwright() as playwright:
    run(playwright)
