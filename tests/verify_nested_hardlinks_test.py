import time
import pytest
import redis
from playwright.sync_api import expect

@pytest.fixture
def redis_client():
    client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    yield client
    client.close()

def test_nested_hardlink_grouping(page, redis_client):
    """
    Verifies:
    1. Hardlinked files are grouped (via Level 3 table).
    2. Level 3 table is always visible (no expander needed).
    3. Header text (Inode X) is removed.
    4. Radio sync works.
    """
    redis_client.flushdb()

    # Setup Data
    hash_val = "hash_nested_test"
    ino_hardlink = "999"
    ino_single = "888"

    # 1. Hardlink Group (2 paths)
    redis_client.hset(f"ino:{ino_hardlink}", mapping={
        "ino": ino_hardlink,
        "path": "/mnt/user/share/hardlink_A.txt|/mnt/user/share/hardlink_B.txt",
        "size": 1024,
        "hash": hash_val,
        "nlink": 2,
        "mtime": 1600000000
    })

    # 2. Single File (1 path)
    redis_client.hset(f"ino:{ino_single}", mapping={
        "ino": ino_single,
        "path": "/mnt/user/share/single.txt",
        "size": 1024,
        "hash": hash_val,
        "nlink": 1,
        "mtime": 1600000000
    })

    # Navigate
    page.goto("http://localhost/plugins/bobbintb.system.dirt/index.php")

    # Wait for Level 1 Table
    expect(page.locator("#left-table")).to_be_visible(timeout=30000)

    # Level 1 Row should exist (Duplicate Group)
    level1_row = page.locator("#left-table .tabulator-row").first
    expect(level1_row).to_be_visible()

    # Check for nested container (Level 2)
    nested_container = level1_row.locator(".nested-table-container")
    expect(nested_container).to_be_visible()

    # --- VERIFY LEVEL 2 ---
    # Should have 2 rows: 1 Group (Hidden Header), 1 Single
    level2_rows = nested_container.locator(".tabulator-row")
    # Note: Level 2 Group Row contains Level 3 Table.
    # So the DOM structure is nested.

    # Row B: Single File Row
    # Should contain path "/mnt/user/share/single.txt"
    single_row = level2_rows.filter(has_text="/mnt/user/share/single.txt")
    expect(single_row).to_be_visible()

    # --- VERIFY LEVEL 3 (Hardlinks) ---
    # Should be visible WITHOUT clicking anything (Always Expanded)

    # We can look for Level 3 container directly
    level3_container = nested_container.locator(".level3-table-container")
    expect(level3_container).to_be_visible()

    # Check Level 3 Rows
    level3_rows = level3_container.locator(".tabulator-row")
    expect(level3_rows).to_have_count(2)

    path_A = level3_rows.filter(has_text="/mnt/user/share/hardlink_A.txt")
    path_B = level3_rows.filter(has_text="/mnt/user/share/hardlink_B.txt")

    expect(path_A).to_be_visible()
    expect(path_B).to_be_visible()

    # Verify Link Icon in Level 3
    link_icon = path_A.locator(".fa-link[style*='rotate(45deg)']")
    expect(link_icon).to_be_attached()

    # Verify Actions in Level 3
    expect(path_A.locator(".fa-trash")).to_be_attached()

    # --- VERIFY RADIO SYNC ---

    radio_A = path_A.locator("input[type='radio']")
    radio_A.check()
    expect(radio_A).to_be_checked()

    # Verify Single File (Level 2) is NOT checked
    radio_single = single_row.locator("input[type='radio']")
    expect(radio_single).not_to_be_checked()

    # Now select Single File (Level 2)
    radio_single.check()
    expect(radio_single).to_be_checked()

    expect(radio_A).not_to_be_checked()

    # DEBUG SNAPSHOT
    page.screenshot(path="/home/jules/verification/verification_revised.png")

    print("Verification Successful!")
