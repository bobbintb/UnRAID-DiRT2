import time
import pytest
import redis
import re
from playwright.sync_api import expect

@pytest.fixture
def redis_client():
    client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    yield client
    client.close()

def test_path_granularity_and_link_icon(page, redis_client):
    """
    Verifies:
    1. Hardlinked files (same inode, multiple paths) are exploded into individual rows in the UI.
    2. Actions can be set on individual paths.
    3. Hardlinked files display the visual link indicator.
    """

    redis_client.flushdb()

    hash_val = "hash_hardlink_test"
    ino_hardlink = "999"

    # File 1: Hardlink A & B (Ino 999)
    redis_client.hset(f"ino:{ino_hardlink}", mapping={
        "ino": ino_hardlink,
        "path": "/mnt/user/share/hardlink1.txt|/mnt/user/share/hardlink2.txt",
        "size": 1024,
        "hash": hash_val,
        "nlink": 2,
        "mtime": 1600000000
    })

    # File 2: Duplicate (Ino 888)
    redis_client.hset("ino:888", mapping={
        "ino": "888",
        "path": "/mnt/user/share/duplicate.txt",
        "size": 1024,
        "hash": hash_val,
        "nlink": 1,
        "mtime": 1600000000
    })

    # Navigate to page
    page.goto("http://localhost/plugins/bobbintb.system.dirt/index.php")

    # Wait for table to load
    expect(page.locator("#left-table")).to_be_visible(timeout=30000)

    # Level 1 Row
    level1_row = page.locator("#left-table .tabulator-row").first

    # Level 2 Group Row (Identified by presence of Level 3 container, since text is hidden)
    # We can just search for Level 3 container directly
    level3_container = level1_row.locator(".level3-table-container")
    expect(level3_container).to_be_visible()

    # Locate the row for hardlink1 (inside Level 3)
    row1 = level3_container.locator(".tabulator-row").filter(has_text="/mnt/user/share/hardlink1.txt")
    expect(row1).to_be_visible(timeout=10000)

    # Locate the row for hardlink2
    row2 = level3_container.locator(".tabulator-row").filter(has_text="/mnt/user/share/hardlink2.txt")
    expect(row2).to_be_visible(timeout=10000)

    # Locate the row for duplicate (Level 2)
    row3 = level1_row.locator(".nested-table-container .tabulator-row").filter(has_text="/mnt/user/share/duplicate.txt")
    expect(row3).to_be_visible(timeout=10000)

    # Verify Link Icon on hardlinks (Level 3)
    icon1 = row1.locator(".fa-link[style*='rotate(45deg)']")
    expect(icon1).to_be_attached()

    icon2 = row2.locator(".fa-link[style*='rotate(45deg)']")
    expect(icon2).to_be_attached()

    # Check row3 (duplicate, nlink=1) - Should NOT have the rotated icon
    icon3 = row3.locator(".fa-link[style*='rotate(45deg)']")
    expect(icon3).not_to_be_attached()

    # Verify Actions on Individual Paths
    # Click delete on hardlink1
    delete_btn1 = row1.locator(".fa-trash")
    delete_btn1.evaluate("element => element.click()")

    # Verify it is selected
    expect(delete_btn1).to_have_class(re.compile("selected"))

    # Check that hardlink2 delete button is NOT selected (independence)
    delete_btn2 = row2.locator(".fa-trash")
    expect(delete_btn2).not_to_have_class(re.compile("selected"))
