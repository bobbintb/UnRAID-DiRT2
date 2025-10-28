// Helper function to remove an action from the queue (backend only)
function removeFileActionFromQueue(filePath, dirtySock) {
    // Send message to backend to remove from Redis
    dirtySock('removeFileAction', { path: filePath });
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper function to format dates
function formatDate(cell) {
    const value = cell.getValue();
    return value ? new Date(value).toLocaleString() : '';
}

// Helper function to format size
function formatSize(cell) {
    const value = cell.getValue();
    return formatBytes(value);
}

// Helper function to update the action queue table based on the main table's state
function updateActionQueueTable(table, actionQueueTable) {
    if (!table) return;
    const tableRows = table.getRows();
    const queuedActions = [];
    tableRows.forEach(row => {
        const rowData = row.getData();
        const actionCell = row.getCell('action').getElement();
        if (!actionCell) return;

        const checkedRadio = actionCell.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
            queuedActions.push({
                action: checkedRadio.value,
                file: rowData.path
            });
        }
    });
    actionQueueTable.setData(queuedActions);
}
