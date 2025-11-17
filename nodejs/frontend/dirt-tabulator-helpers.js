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
    const rows = table.getRows();
    const masterRow = table.element.closest('.tabulator-row');

    if (masterRow) {
        // Exclude the 'original' file from the check
        const nonOriginalRows = rows.filter(row => !row.getData().isOriginal);
        // Check if all non-original files have an action
        const allSet = nonOriginalRows.every(row => {
            const action = row.getData().action;
            return action === 'delete' || action === 'link';
        });

        if (allSet) {
            masterRow.style.backgroundColor = 'lightgreen';
        } else {
            masterRow.style.backgroundColor = '';
        }
    }
}

function processDuplicateFiles(duplicates) {
    const rightTableData = [];
    const leftTableData = [];

    duplicates.forEach(group => {
        // Sort files by path to ensure consistent ordering
        const sortedFiles = group.files.sort((a, b) => a.path.localeCompare(b.path));

        // Find if an original is already designated
        const originalFile = sortedFiles.find(file => file.isOriginal === true);

        // Process each file in the group
        const fileList = sortedFiles.map((file, index) => {
            const isOriginal = originalFile ? file.ino === originalFile.ino : !originalFile && index === 0;
            const fileData = {
                ...file,
                hash: group.hash,
                isOriginal: isOriginal,
            };
            rightTableData.push(fileData);
            return fileData;
        });

        // Calculate total size for the left table
        const totalSize = group.files.reduce((acc, file) => acc + file.size, 0);

        // Add processed group data to the left table
        leftTableData.push({
            hash: group.hash,
            count: group.files.length,
            size: totalSize,
            fileList: fileList,
        });
    });

    return { leftTableData, rightTableData };
}
