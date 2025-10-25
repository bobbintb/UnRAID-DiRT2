import sys
import subprocess
import os

def run_playwright_test(script_path):
    """
    Executes a specific Playwright test script using the `playwright test` command,
    calling the executable directly from node_modules to ensure it's found.
    """
    if not os.path.exists(script_path):
        print(f"Error: Test script not found at '{script_path}'")
        sys.exit(1)

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    playwright_executable = os.path.join(project_root, "node_modules", ".bin", "playwright")

    if not os.path.exists(playwright_executable):
        print(f"Error: Playwright executable not found at '{playwright_executable}'")
        print("Please ensure you have run 'npm install @playwright/test'")
        sys.exit(1)

    command = [
        playwright_executable,
        "test",
        script_path
    ]

    print(f"Executing command: {' '.join(command)}")

    try:
        # We run this from the project root to ensure consistent paths.
        process = subprocess.run(
            command,
            check=True,
            text=True,
            capture_output=True,
            cwd=project_root
        )
        print("Playwright test script executed successfully.")
        print("stdout:", process.stdout)
        if process.stderr:
            print("stderr:", process.stderr)
    except subprocess.CalledProcessError as e:
        print(f"Error executing Playwright test script: {script_path}")
        print("Return code:", e.returncode)
        print("stdout:", e.stdout)
        print("stderr:", e.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_pipeline.py <path_to_playwright_test_script>")
        sys.exit(1)

    test_script_path = sys.argv[1]
    run_playwright_test(test_script_path)
