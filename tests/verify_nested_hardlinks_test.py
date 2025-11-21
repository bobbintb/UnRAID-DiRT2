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
    1. Hardlinked files are grouped into a single row in Level 2 (Nested Table).
    2. Single files are shown as normal rows in Level 2.
    3. Hardlink Group Row can be expanded to show Level 3 (individual paths).
    4. Correct visual indicators (Expander, Link Icon) are present.
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

    # Capture console logs
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

    # Navigate
    page.goto("http://localhost/plugins/bobbintb.system.dirt/index.php")

    # Wait for Level 1 Table
    expect(page.locator("#left-table")).to_be_visible(timeout=30000)

    # Level 1 Row should exist (Duplicate Group)
    level1_row = page.locator("#left-table .tabulator-row").first
    expect(level1_row).to_be_visible()

    # Expand Level 1 (if not expanded? Default is expanded?)
    # Currently Level 1 defaults to expanded (▼).
    # Check for nested container
    nested_container = level1_row.locator(".nested-table-container")
    expect(nested_container).to_be_visible()

    # --- VERIFY LEVEL 2 ---

    # Should have 2 rows: 1 Group, 1 Single
    level2_rows = nested_container.locator(".tabulator-row")
    # Wait for rows to render
    expect(level2_rows).to_have_count(2, timeout=5000)

    # Row A: Group Row
    # Should contain text "Inode 999 (2 files)"
    group_row = level2_rows.filter(has_text="Inode 999 (2 files)")
    expect(group_row).to_be_visible()

    # Row B: Single File Row
    # Should contain path "/mnt/user/share/single.txt"
    single_row = level2_rows.filter(has_text="/mnt/user/share/single.txt")
    expect(single_row).to_be_visible()

    # Check Expander Icon on Group Row
    # First column cell should contain "▶" (Collapsed by default)
    expander_cell = group_row.locator(".tabulator-cell").first
    expect(expander_cell).to_have_text("▶")

    # Check Expander Icon on Single Row (Should be empty)
    single_expander = single_row.locator(".tabulator-cell").first
    expect(single_expander).to_have_text("")

    # Check Actions on Group Row (Should be empty)
    # Action column is index 2 (Expander, Radio, Action)
    action_cell_group = group_row.locator(".tabulator-cell").nth(2)
    # Should not have icons
    expect(action_cell_group.locator(".fa-trash")).not_to_be_attached()

    # Check Actions on Single Row (Should exist)
    action_cell_single = single_row.locator(".tabulator-cell").nth(2)
    expect(action_cell_single.locator(".fa-trash")).to_be_attached()

    # --- VERIFY LEVEL 3 ---

    # Expand Group Row
    expander_cell.click()

    # Check Level 3 Container
    level3_container = group_row.locator(".level3-table-container")
    expect(level3_container).to_be_visible()

    # Check Level 3 Rows
    level3_rows = level3_container.locator(".tabulator-row")

    # DEBUG SNAPSHOT
    page.screenshot(path="/home/jules/verification/verification.png")

    expect(level3_rows).to_have_count(2)

    path_A = level3_rows.filter(has_text="/mnt/user/share/hardlink_A.txt")
    path_B = level3_rows.filter(has_text="/mnt/user/share/hardlink_B.txt")

    expect(path_A).to_be_visible()
    expect(path_B).to_be_visible()

    # Verify Link Icon in Level 3
    # Look for rotated link icon
    link_icon = path_A.locator(".fa-link[style*='rotate(45deg)']")
    expect(link_icon).to_be_attached()

    # Verify Actions in Level 3
    expect(path_A.locator(".fa-trash")).to_be_attached()

    # --- VERIFY RADIO SYNC ---

    # Originally, neither might be selected, or first one.
    # Let's select Path A in Level 3.
    radio_A = path_A.locator("input[type='radio']")
    radio_A.check()
    expect(radio_A).to_be_checked()

    # Verify Single File (Level 2) is NOT checked
    radio_single = single_row.locator("input[type='radio']")
    expect(radio_single).not_to_be_checked()

    # Now select Single File (Level 2)
    radio_single.check()
    expect(radio_single).to_be_checked()

    # Verify Path A (Level 3) is UNCHECKED
    # Note: This relies on browser 'name' attribute behavior or our custom sync.
    expect(radio_A).not_to_be_checked()

    print("Verification Successful!")
