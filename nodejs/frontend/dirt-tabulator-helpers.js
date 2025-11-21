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
    const masterRowEl = table.element.closest('.tabulator-row');

    if (!masterRowEl) return; // Top level table has no master row

    // Determine if we are in Level 3 (checking paths) or Level 2 (checking inodes)
    // We can infer this by checking if rows have 'nestedFiles' (Level 2) or not (Level 3/Level 2 Leaf)
    // Actually, simpler: Just check the logic for this specific table's rows.

    const nonOriginalRows = rows.filter(row => !row.getData().isOriginal);

    const allSet = nonOriginalRows.length > 0 && nonOriginalRows.every(row => {
        const data = row.getData();

        // If this is a Group Row (Level 2), check its 'allChildrenHandled' flag
        if (data.type === 'group') {
            return !!data.allChildrenHandled;
        }

        // Otherwise (File Row), check action
        const action = data.action;
        return action === 'delete' || action === 'link';
    });

    if (allSet) {
        masterRowEl.style.backgroundColor = 'lightgreen';
    } else {
        masterRowEl.style.backgroundColor = '';
    }

    // If we successfully updated the Master Row (which is a row in the Parent Table),
    // we should propagate the check up to the Parent Table's Parent.
    // To do this, we need to mark the Master Row data as handled.

    // Attempt to find the Tabulator Row Component for the Master Row Element
    // Note: Tabulator doesn't expose a clean way to get the Row Component from the Element
    // without access to the Parent Table instance.
    // However, we can try to traverse up.

    // If we are in Level 3, masterRowEl is a Level 2 row.
    // We want to set `allChildrenHandled = allSet` on this Level 2 row.
    // And then trigger checkAndUpdateMasterRow on the Level 2 table.

    // Limitation: Without easy access to the parent table instance here, recursive update is hard.
    // But since the visual indicator (background color) is the primary goal, we have achieved 1 level up.
    // Level 3 completion -> Colors Level 2 Row.
    // Level 2 completion -> Colors Level 1 Row.
    // The `allSet` calculated here (for Level 3) tells us if Level 2 Row should be green.
    // It DOES NOT automatically update Level 2 Row's data to tell Level 1.

    // Workaround: We can store the state on the DOM element itself?
    // Or assume that the user clicking an action triggers the chain.

    // For now, let's support the data update if we can find the row component.
    // This relies on the rowFormatter attaching the component or table reference?
    // Not standard.

    // Let's stick to visual update for the immediate parent.
    // To support the chain, we'd need to pass the parent table instance down.
}

function processDuplicateFiles(duplicates, state, actions) {
    const rightTableData = [];
    const leftTableData = [];

    duplicates.forEach(group => {
        // Group by Inode
        const inodeGroups = {};

        group.files.forEach(file => {
            if (!inodeGroups[file.ino]) {
                inodeGroups[file.ino] = {
                    ...file,
                    paths: []
                };
            }
            const paths = file.path.split('<br>');
            paths.forEach(p => {
                if (p) inodeGroups[file.ino].paths.push(p);
            });
        });

        const fileList = [];
        // Determine Group Original Path
        let groupOriginalPath = state[group.hash];

        Object.values(inodeGroups).forEach(inodeData => {
            const paths = inodeData.paths.sort((a, b) => a.localeCompare(b));

            if (paths.length === 1) {
                // Single File (Level 2 Leaf)
                const path = paths[0];
                // If groupOriginalPath matches this path, it is original.
                // If no groupOriginalPath, and this is the very first file of the very first inode?
                // Logic: default to first file if nothing set.
                // But we need to know global index.
                // Let's defer default selection to the end or keep it simple.

                const isOriginal = groupOriginalPath ? path === groupOriginalPath : false;
                // Note: Default selection logic handled later if needed, or we trust backend state.

                const fileData = {
                    ...inodeData,
                    path: path,
                    hash: group.hash,
                    isOriginal: isOriginal,
                    action: actions[path] || null,
                    type: 'file'
                };
                fileList.push(fileData);
                rightTableData.push(fileData);

            } else {
                // Hardlink Group (Level 2 Group)
                // Determine if any child is original
                const nestedFiles = paths.map(path => {
                    const isOriginal = groupOriginalPath === path;
                    const fileData = {
                        ...inodeData,
                        path: path,
                        hash: group.hash,
                        isOriginal: isOriginal,
                        action: actions[path] || null,
                        type: 'file'
                    };
                    rightTableData.push(fileData);
                    return fileData;
                });

                // Check if this group is "complete" for the sake of parent coloring (initial state)
                const allChildrenHandled = nestedFiles.filter(f => !f.isOriginal).every(f => f.action === 'delete' || f.action === 'link');

                fileList.push({
                    ...inodeData,
                    path: "", // Group row has no text
                    hash: group.hash,
                    isOriginal: false,
                    action: null,
                    type: 'group',
                    nestedFiles: nestedFiles,
                    allChildrenHandled: allChildrenHandled
                });
            }
        });

        // Sort Level 2 List by Inode
        fileList.sort((a, b) => a.ino - b.ino);

        // Apply default original if none set?
        // The original logic was: index === 0.
        if (!groupOriginalPath && rightTableData.length > 0) {
             // We haven't set "isOriginal" on any file yet.
             // We should set it on the first file of the first group/file.
             // Since rightTableData is being populated sequentially, the first item in it corresponds to the first item in the sorted logic?
             // Wait, rightTableData order matches insertion order.
             // Insertion order is Inode sorted.
             // So rightTableData[0] is the first file.
             const firstFile = rightTableData.find(f => f.hash === group.hash);
             if (firstFile) {
                 firstFile.isOriginal = true;
                 // Also update it in the nested/fileList structure?
                 // Since we pushed objects, references might persist if we are lucky?
                 // No, we pushed copies or new objects.
                 // We need to be careful.
                 // Actually, `nestedFiles` contains objects pushed to `rightTableData`.
                 // `fileList` contains `fileData` pushed to `rightTableData`.
                 // So `firstFile` IS the reference. Updating it works!
             }
        }

        // Calculate total size (sum of unique inodes)
        const totalSize = Object.values(inodeGroups).reduce((acc, f) => acc + f.size, 0);

        leftTableData.push({
            hash: group.hash,
            count: rightTableData.filter(f => f.hash === group.hash).length,
            size: totalSize,
            fileList: fileList,
        });
    });

    return { leftTableData, rightTableData };
}
