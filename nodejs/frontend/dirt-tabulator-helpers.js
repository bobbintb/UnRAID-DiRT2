// Helper function to remove an action from the queue (UI and backend)
function removeFileActionFromQueue(ino, filePath, dirtySock, actionQueueTable, mainTable, updateQueueFooter) {
    // 1. Send message to backend to remove from Redis
    dirtySock('removeFileAction', { path: filePath });

    // 2. Remove the row from the action queue table
    const rows = actionQueueTable.getRows();
    const rowToDelete = rows.find(row => row.getData().file === filePath);
    if (rowToDelete) {
        rowToDelete.delete().then(() => {
            if (mainTable && updateQueueFooter) {
                updateQueueFooter(actionQueueTable, mainTable);
            }
        });
    }
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

function checkAndUpdateMasterRow(table) {
    // Defensive: ensure table is valid and has rows
    if (!table || typeof table.getRows !== 'function' || !table.element) return;

    const rows = table.getRows();
    const masterRow = table.element.closest('.tabulator-row');

    if (!masterRow) return;

    // Exclude the 'original' file from the check
    const nonOriginalRows = rows.filter(row => !row.getData().isOriginal);
    // Check if all non-original files have an action
    const allSet = nonOriginalRows.length > 0 && nonOriginalRows.every(row => {
        const action = row.getData().action;
        return action === 'delete' || action === 'link';
    });

    if (allSet) {
        masterRow.style.backgroundColor = 'lightgreen';
    } else {
        masterRow.style.backgroundColor = '';
    }
}

function processDuplicateFiles(duplicates, state, actions) {
    const rightTableData = [];
    const leftTableData = [];

    duplicates.forEach(group => {
        const inodeGroups = [];
        const uniqueInodes = group.files;

        // 1. Group files by inode and explode paths
        uniqueInodes.forEach(file => {
            const paths = file.path.split('<br>');
            // Filter empty paths and create file objects
            const groupFiles = paths
                .filter(p => p)
                .map(p => ({
                    ...file,
                    path: p
                }));

            // Sort files within the inode group by path
            groupFiles.sort((a, b) => a.path.localeCompare(b.path));

            if (groupFiles.length > 0) {
                inodeGroups.push(groupFiles);
            }
        });

        // 2. Sort the inode groups based on the first path in each group
        inodeGroups.sort((groupA, groupB) => {
            return groupA[0].path.localeCompare(groupB[0].path);
        });

        // 3. Flatten into a single list and assign group sort keys
        const sortedFiles = [];
        inodeGroups.forEach(group => {
            // The key for the entire group is the path of the first file
            const groupKey = group[0].path;

            group.forEach(file => {
                // Determine the groupSortKey: GroupKey + separator + CurrentPath
                // This ensures groups stay together, and sort by path within the group
                file.groupSortKey = groupKey + '\0' + file.path;
                sortedFiles.push(file);
            });
        });

        // Find if an original is already designated
        const originalPath = state[group.hash];

        // Process each file in the group
        const fileList = sortedFiles.map((file, index) => {
            const isOriginal = originalPath ? file.path === originalPath : (!originalPath && index === 0);
            const fileData = {
                ...file,
                hash: group.hash,
                isOriginal: isOriginal,
                action: actions[file.path] || null
            };
            rightTableData.push(fileData);
            return fileData;
        });

        // Calculate total size for the left table using unique inodes to avoid double-counting hardlinks
        const totalSize = uniqueInodes.reduce((acc, file) => acc + file.size, 0);

        // Add processed group data to the left table
        leftTableData.push({
            hash: group.hash,
            count: fileList.length,
            size: totalSize,
            fileList: fileList,
        });
    });

    return { leftTableData, rightTableData };
}
