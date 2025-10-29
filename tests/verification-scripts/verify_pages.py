from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # The script is run from the `nodejs` directory, so we need to go up one level
    # to find the `jules-scratch` directory at the project root.
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    base_path = os.path.join(project_root, 'jules-scratch', 'verification')

    # Verify Tabulator page
    tabulator_path = os.path.join(base_path, 'temp_tabulator.html')
    page.goto(f"file:///{tabulator_path}")
    page.screenshot(path=os.path.join(base_path, "screenshot-tabulator.png"))
    print("Tabulator page screenshot captured.")


    browser.close()

with sync_playwright() as playwright:
    run(playwright)
