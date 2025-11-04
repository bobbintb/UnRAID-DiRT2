# Agent Instructions

This document provides instructions and guidelines for AI agents working in this repository.

## Development Setup

Before starting any development task, you **must** set up the Node.js environment.

1.  **Start Redis**: This project requires a Redis-compatible server with the RediSearch module. The recommended server is `redis-stack-server`. Ensure it is running before starting the backend.
    ```bash
    sudo systemctl start redis-stack-server
    ```

2.  **Install Node.js Dependencies**: All dependencies are managed in the root `package.json` file.
    ```bash
    npm install
    ```

3.  **Prerequisite: Playwright**: The frontend verification process uses Playwright.
    *   The `@playwright/test` package is included as a `devDependency`.
    *   The environment should have the necessary system dependencies pre-installed.
    *   If browser binaries are missing, run the following command to install them:
        ```bash
        npx playwright install
        ```
    *   If you encounter a browser executable error pointing to a `/home/jules/.cache` directory, it means the necessary browser binaries are missing. Run `npx playwright install` to download them.

## Running the Application

### Starting the Server

The Node.js server is the backend for the Unraid plugin.

-   **To start the server for development:**
    Run this command from the project root. It's recommended to run it in the background (`&`) and redirect output to a log file.
    ```bash
    npm start > dirt_server.log &
    ```

-   **To kill a running server process:**
    A dedicated script is provided to find and kill any running instances of the server.
    ```bash
    npm run kill-dirt
    ```

### Seeding the Database

To populate the Redis database with test data for development, use the seed script.
```bash
npm run seed
```

## Frontend Verification

**Prerequisite**: Before running any verification scripts, ensure you have completed the **Development Setup** and that the application server is running.

The frontend for this Unraid plugin consists of `.page` files, which are essentially PHP files containing a mix of HTML, JavaScript, and a custom frontmatter header required by the Unraid OS.

### Page File Frontmatter

The frontmatter is a block at the very top of the file that must be stripped for local testing. The `unraid-workaround` script handles this automatically. It looks like this:
```
Menu="pluginSettings:2"
Title="DataTables"
---
```

### Manual Verification Process

For any given UI task, you must follow this manual process:

1.  **Ensure a clean state**: Stop any running server processes.
    ```bash
    npm run kill-dirt
    ```
2.  **Start the server**: Run the server in the background.
    ```bash
    npm start > dirt_server.log &
    ```
3.  **Seed the database**: Populate Redis with test data.
    ```bash
    npm run seed
    ```
4.  **Prepare UI files**: Run the workaround script to convert the Unraid `.page` files into testable `.html` files.
    ```bash
    npm run unraid-workaround
    ```
5.  **Run Playwright tests**: Execute the Playwright test runner. You can run all tests or specify a single file.
    ```bash
    # Run all tests
    npx playwright test

    # Run a specific test
    npx playwright test tests/verification-scripts/simple-screenshot.spec.js
    ```
6.  **Stop the server**: Once testing is complete, kill the server process.
    ```bash
    npm run kill-dirt
    ```

### Frontend Libraries

This project uses two different table libraries on separate pages for evaluation purposes. Before implementing new features or customizations, **you must** consult the official documentation for the relevant library to see if a built-in solution exists.

-   **`dirt-tabulator.page`**:
    -   **Library**: Tabulator v6.3.1
    -   **Documentation**: [https://tabulator.info/docs/6.3](https://tabulator.info/docs/6.3)

## Playwright Scripts

This section outlines the standards and best practices for creating, managing, and maintaining Playwright verification scripts in this repository.

### Storage Location

-   **Test Scripts**: `tests/verification-scripts/`
-   **Helper Modules**: `tests/helpers/`

### Naming Conventions

-   **Tests**: Test files must match Playwright's default test patterns (e.g., `*.spec.js`).
-   **Helpers**: To prevent the test runner from accidentally executing helper files, all helper scripts must use the `.helper` suffix (e.g., `my-helper.helper.js`).

### Scripting Standards

1.  **Documentation**: Scripts should be well-documented with comments explaining their purpose and key steps.
2.  **Reusability**: Common tasks should be abstracted into reusable functions and stored in the `tests/helpers` directory.

## Pre-commit Checklist

Before using the `submit` tool, you **must** clean the workspace.

1.  **Save Verification Scripts**:
    -   Ensure any new or modified Playwright verification scripts are permanently saved in the `tests/verification-scripts/` directory.
2.  **Clean the Workspace**:
    -   Run the automated cleanup script to remove temporary artifacts. The screenshot and log file are now considered artifacts and should be submitted.
    ```bash
    npm run clean
    ```
3.  **Revert Unintentional Changes**:
    -   Ensure `package-lock.json` has not been unintentionally modified. If it has, restore it.
