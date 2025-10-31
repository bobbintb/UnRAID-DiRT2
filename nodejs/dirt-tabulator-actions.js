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

function handleGroupActionClick(e, group, dirtySock) {
    const action = e.target.value;
    const childRows = group.getRows();

    const isDeselecting = e.target.getAttribute('data-waschecked') === 'true';
    e.target.setAttribute('data-waschecked', isDeselecting ? 'false' : 'true');

    const parent = e.target.parentElement;
    const otherRadio = parent.querySelector(`input[type="radio"]:not([value="${action}"])`);
    if (otherRadio) {
        otherRadio.setAttribute('data-waschecked', 'false');
    }

    childRows.forEach(row => {
        const rowData = row.getData();
        if (!rowData.isOriginal) {
            const newAction = isDeselecting ? null : action;
            if (rowData.queuedAction !== newAction) {
                rowData.queuedAction = newAction;
                if (newAction) {
                    dirtySock('setFileAction', { ino: rowData.ino, path: rowData.path, action: newAction });
                } else {
                    dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
                }
            }
        }
    });
}

function handleHeaderActionClick(e, table, dirtySock) {
    const action = e.target.value;
    const allRows = table.getRows();

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
            const newAction = isDeselecting ? null : action;
            if (rowData.queuedAction !== newAction) {
                rowData.queuedAction = newAction;
                if (newAction) {
                    dirtySock('setFileAction', { ino: rowData.ino, path: rowData.path, action: newAction });
                } else {
                    dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
                }
            }
        }
    });
}


function handleActionQueueRowClick(cell, dirtySock) {
    const rowData = cell.getRow().getData();
    dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
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
