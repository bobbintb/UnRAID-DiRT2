function handleIsPrimaryClick(cell, dirtySock) {
    const clickedRow = cell.getRow();
    const clickedRowData = clickedRow.getData();
    const groupRows = clickedRow.getGroup().getRows();

    groupRows.forEach(row => {
        const rowData = row.getData();
        const isClickedRow = rowData.ino === clickedRowData.ino;

        if (rowData.isOriginal !== isClickedRow) {
            row.update({ isOriginal: isClickedRow });
        }

        if (isClickedRow) {
            if (rowData.queuedAction) {
                row.update({ queuedAction: null });
                dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
            }
        }
    });

    dirtySock('setOriginalFile', { hash: clickedRowData.hash, ino: clickedRowData.ino });
}

function handleActionClick(e, cell, dirtySock) {
    const row = cell.getRow();
    const rowData = row.getData();
    const action = e.target.value;

    if (rowData.queuedAction === action) {
        row.update({ queuedAction: null });
        dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
    } else {
        row.update({ queuedAction: action });
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
                row.update({ queuedAction: newAction });
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
                row.update({ queuedAction: newAction });
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
    const row = cell.getRow();
    const rowData = row.getData();
    dirtySock('removeFileAction', { ino: rowData.ino, path: rowData.path });
    row.update({ queuedAction: null });
}

function handleClearQueueClick(tableData, dirtySock, table) {
    const rows = table.getRows();
    rows.forEach(row => {
        if (row.getData().queuedAction) {
            row.update({ queuedAction: null });
        }
    });
    dirtySock('clearQueue', {});
}
