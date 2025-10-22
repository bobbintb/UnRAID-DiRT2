from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    # Verify Tabulator page
    page.goto(f"file:///{os.path.abspath('jules-scratch/verification/temp_tabulator.html')}")
    page.screenshot(path="jules-scratch/verification/tabulator.png")

    # Verify DataTables page
    page.goto(f"file:///{os.path.abspath('jules-scratch/verification/temp_datatables.html')}")
    page.screenshot(path="jules-scratch/verification/datatables.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
