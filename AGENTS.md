# Agent Instructions

This document provides instructions and guidelines for AI agents working in this repository.

## Development Setup

Before starting any development task, you **must** set up the Node.js environment.

1.  **Start Redis**: This project requires a Redis-compatible server with the RediSearch module. The recommended server is `redis-stack-server`. Ensure it is running before starting the backend.
    ```bash
    sudo systemctl start redis-stack-server
    ```

2.  **Prepare the environment**: Run the `prep` script to install all dependencies and seed the database. This only needs to be run once per session.
    ```bash
    npm run prep
    ```

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
    npm run stop
    ```

### Seeding the Database

To populate the Redis database with test data for development, use the seed script.
```bash
npm run seed
```

## Individual Scripts

The following scripts are available in `package.json` and can be run individually as needed.

-   `npm start`: Starts the Node.js server and logs output to `dirt_server.log`.
-   `npm run stop`: Stops any running Node.js server processes.
-   `npm run restart`: A convenience script that stops and then restarts the server.
-   `npm run seed`: Populates the Redis database with test data.
-   `npm run unraid-workaround`: Removes the Unraid-specific frontmatter from the `.page` files, creating testable `index.php` files.
-   `npm run clean`: Removes temporary files like `dirt_server.log` and `index.php`.
-   `npm run prep`: Installs all necessary dependencies (`npm install` and `playwright install`) and seeds the database. This should be run once before starting development.
-   `npm test`: Runs the entire test suite, which includes cleaning, preparing UI files, starting the server, running tests, and stopping the server.

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

### Frontend Libraries

This project uses two different table libraries on separate pages for evaluation purposes. Before implementing new features or customizations, **you must** consult the official documentation for the relevant library to see if a built-in solution exists.

-   **`dirt-tabulator.page`**:
    -   **Library**: Tabulator v6.3.1
    -   **Documentation**: [https://tabulator.info/docs/6.3](https://tabulator.info/docs/6.3)

## Testing

This project uses Playwright for Python for frontend testing.

### Running Tests

Tests should be run on request. The `npm test` command will run the entire test suite. This includes cleaning the workspace, preparing UI files, starting the server, running the tests, and stopping the server.

```bash
npm test
```

To run a specific test file, you can use the `pytest` command directly:

```bash
pytest tests/your_test_file_test.py
```

### Test File Location and Naming

-   **Test Scripts**: All test scripts are located in the `tests/` directory.
-   **File Naming**: Test files must end with `_test.py` for the test runner to discover them.
-   **Helper Modules**: Reusable test functions and helpers are stored in `tests/helpers/`.

### Scripting Standards

1.  **Documentation**: Scripts should be well-documented with comments explaining their purpose and key steps.
2.  **Reusability**: Common tasks should be abstracted into reusable functions and stored in the `tests/helpers` directory.

## Pre-commit Checklist

Before using the `submit` tool, ensure that any requested tests have been run and have passed.
