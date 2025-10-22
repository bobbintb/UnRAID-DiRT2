# Agent Instructions

This document provides instructions and guidelines for AI agents working in this repository.

## Development Setup

Before starting any development task, you **must** set up the Node.js environment.

1.  **Start Redis**: This project requires a Redis-compatible server with the RediSearch module. The recommended server is `redis-stack-server`. Ensure it is running before starting the backend.
    ```bash
    sudo systemctl start redis-stack-server
    ```

2.  **Install Node.js Dependencies**: Navigate to the `nodejs` directory and install the dependencies.
    ```bash
    cd nodejs
    npm install
    ```
    *Note*: This project uses an override for the `blake3` package due to a dependency issue in v3.0.0. The necessary configuration is already in `package.json`.

3.  **Prerequisite: Playwright**: The frontend verification process uses Playwright. It should already be installed in your environment. The `postinstall` script in `nodejs/package.json` will attempt to install the necessary browsers.

## Running the Application

### Starting the Server

The Node.js server is the backend for the Unraid plugin.

-   **To start the server for development (with logging):**
    ```bash
    (cd nodejs && node dirt.js > ../dirt_server.log 2>&1 &)
    ```

-   **To kill a running server process:**
    The server can become a zombie process if it crashes. Use the following command to find and kill any running instances before restarting.
    ```bash
    ps aux | grep 'node dirt.js' | grep -v grep | awk '{print $2}' | xargs kill -9 || true
    ```

-   **Recommended combined command for restarting the server:**
    This command ensures any old server process is killed before starting a new one.
    ```bash
    ps aux | grep 'node dirt.js' | grep -v grep | awk '{print $2}' | xargs kill -9 || true; (cd nodejs && npm install && npm run start > ../dirt_server.log 2>&1 &)
    ```

### Seeding the Database

To populate the Redis database with test data for development, use the seed script located at `nodejs/seed-redis.js`.

```bash
cd nodejs && npm run seed
```
*Note*: The seed script can be prone to timeouts. If it fails, it may be an intermittent environmental issue.

## Frontend Verification

**Prerequisite**: Before running any verification scripts, ensure you have completed the **Development Setup** and that the application server is running.

The frontend for this Unraid plugin consists of `.page` files, which are essentially PHP files containing a mix of HTML, JavaScript, and a custom frontmatter header required by the Unraid OS.

### Page File Frontmatter

The frontmatter is a block at the very top of the file that must be stripped for local testing with tools like Playwright. The preparation script described below handles this automatically. It looks like this:
```
Menu="pluginSettings:2"
Title="DataTables"
---
```
-   **Structure**: It consists of one or more key-value pairs, followed by a line with exactly three dashes (`---`).
-   **Key Explanations**:
    -   `Menu`: Defines the parent page and the tab order. For example, `pluginSettings:2` means it's the second tab under the `pluginSettings` page.
    -   `Title`: Sets the text that appears on the tab in the Unraid UI (e.g., "Tabulator", "DataTables"). This is how you identify which page uses which library.

### Verification Process

To prepare the `.page` files for local testing with Playwright, run the following script from the `nodejs` directory:

```bash
npm run test:ui:prepare
```

This script will:
1.  Create a `jules-scratch/verification` directory to hold temporary test artifacts.
2.  Strip the Unraid frontmatter from `dirt-tabulator.page` and `dirt-datatables.page`.
3.  Replace `window.location.hostname` with a hardcoded `localhost` to allow the WebSocket to connect when loaded via a `file://` URL.
4.  Save the processed files as `temp_tabulator.html` and `temp_datatables.html` in the verification directory.

After preparing the files, use a Playwright script from the `tests/verification-scripts/` directory to open the temporary files and verify functionality.

### Frontend Libraries

This project uses two different table libraries on separate pages for evaluation purposes. Before implementing new features or customizations, **you must** consult the official documentation for the relevant library to see if a built-in solution exists.

-   **`dirt-tabulator.page`**:
    -   **Library**: Tabulator v6.3.1
    -   **Documentation**: [https://tabulator.info/docs/6.3](https://tabulator.info/docs/6.3)
-   **`dirt-datatables.page`**:
    -   **Library**: DataTables v2.3.4
    -   **Documentation**: [https://datatables.net/](https://datatables.net/)


## Pre-commit Checklist

Before using the `submit` tool, you **must** clean the workspace.

1.  **Save Verification Scripts**:
    -   Ensure any new or modified Playwright verification scripts are saved in the `tests/verification-scripts/` directory.
2.  **Remove Temporary Artifacts**:
    -   Delete any temporary files generated during verification, such as `dirt_server.log`, screenshots, and the entire `jules-scratch/` directory.
3.  **Revert Unintentional Changes**:
    -   Ensure `nodejs/package-lock.json` has not been unintentionally modified. If it has, restore it.

## Known Issues & Environment

-   **Lua Scripts**: Redis Lua scripts are located in `nodejs/lua/`.
