function handleIsPrimaryClick(cell, dirtySock) {
    const clickedRowData = cell.getRow().getData();
    const groupRows = cell.getRow().getGroup().getRows();

    groupRows.forEach(row => {
        const rowData = row.getData();
        const isClickedRow = rowData.ino === clickedRowData.ino;

        rowData.isOriginal = isClickedRow;

        if (isClickedRow) {
            // If a file is marked as original, it cannot have a queued action.
            if (rowData.queuedAction) {
                rowData.queuedAction = null;
                dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
            }
        }
    });

    dirtySock('setOriginalFile', { hash: clickedRowData.hash, ino: clickedRowData.ino });
}

function handleActionClick(e, cell, dirtySock) {
    const rowData = cell.getRow().getData();
    const action = e.target.value;

    // The 'nullable' radio button logic
    if (rowData.queuedAction === action) {
        rowData.queuedAction = null; // Deselect
        dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
    } else {
        rowData.queuedAction = action; // Select
        dirtySock('setFileAction', { ino: rowData.ino, path: rowData.path, action: action });
    }
}

function handleGroupActionClick(e, group) {
    const action = e.target.value;
    const childRows = group.getRows();

    // Determine if we are selecting or deselecting all
    const isDeselecting = e.target.getAttribute('data-waschecked') === 'true';

    e.target.setAttribute('data-waschecked', isDeselecting ? 'false' : 'true');
    // Ensure the other radio is not in a 'waschecked' state
    const parent = e.target.parentElement;
    const otherRadio = parent.querySelector(`input[type="radio"]:not([value="${action}"])`);
    if (otherRadio) {
        otherRadio.setAttribute('data-waschecked', 'false');
    }


    childRows.forEach(row => {
        const rowData = row.getData();
        if (!rowData.isOriginal) { // Ignore original files
            rowData.queuedAction = isDeselecting ? null : action;
        }
    });
}

function handleHeaderActionClick(e, table) {
    const action = e.target.value;
    const allRows = table.getRows();

    // Nullable radio logic for the header
    const isDeselecting = e.target.getAttribute('data-waschecked') === 'true';
    e.target.setAttribute('data-waschecked', isDeselecting ? 'false' : 'true');

    const parent = e.target.parentElement;
    const otherRadio = parent.querySelector(`input[type="radio"]:not([value="${action}"])`);
    if (otherRadio) {
        otherRadio.setAttribute('data-waschecked', 'false');
    }


    allRows.forEach(row => {
        const rowData = row.getData();
        if (!rowData.isOriginal) {
            rowData.queuedAction = isDeselecting ? null : action;
        }
    });
}

function handleActionQueueRowClick(cell) {
    const rowData = cell.getRow().getData();
    // Simply set the action to null, reactivity will handle the rest.
    rowData.queuedAction = null;
}

function handleClearQueueClick(tableData, dirtySock) {
    tableData.forEach(rowData => {
        if (rowData.queuedAction) {
            rowData.queuedAction = null;
        }
    });
    dirtySock('clearQueue', {});
}
