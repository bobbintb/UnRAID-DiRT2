
window.expandedHashes = new Set();
window.allGroupsData = []; // Source of truth for groups

function flattenGroups(groups) {
    const flat = [];
    // Initialize expandedHashes with all hashes on first load if empty?
    // Or default to expanded.
    if (!window.expandedHashesInitialized && groups.length > 0) {
         groups.forEach(g => window.expandedHashes.add(g.hash));
         window.expandedHashesInitialized = true;
    }

    groups.forEach(group => {
        const isExpanded = window.expandedHashes.has(group.hash);

        // Master Row
        flat.push({
            ...group,
            rowType: 'master',
            id: group.hash,
            isExpanded: isExpanded,
            // allSet property might need to be preserved or recalculated?
            // It's easier to recalculate on render or assume false until checked.
            allSet: group.allSet || false
        });

        // Detail Row
        if (isExpanded) {
            flat.push({
                ...group,
                rowType: 'detail',
                id: group.hash + '_detail'
            });
        }
    });
    return flat;
}

function refreshLeftGridData() {
    if (!window.leftGridApi) return;
    const flatData = flattenGroups(window.allGroupsData);
    window.leftGridApi.setGridOption('rowData', flatData);
}

function generateLeftTableConfig(dirtySock) {
    return {
        columnDefs: [
            {
                headerName: "▼",
                field: "expanded",
                width: 50,
                resizable: false,
                sortable: false,
                cellRenderer: (params) => {
                    if (params.data.rowType === 'detail') return '';

                    const eGui = document.createElement('div');
                    eGui.style.cursor = 'pointer';
                    eGui.style.textAlign = 'center';
                    eGui.style.width = '100%';
                    eGui.innerHTML = params.data.isExpanded ? '▼' : '▶';

                    eGui.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const hash = params.data.hash;
                        if (window.expandedHashes.has(hash)) {
                            window.expandedHashes.delete(hash);
                        } else {
                            window.expandedHashes.add(hash);
                        }
                        refreshLeftGridData();
                    });
                    return eGui;
                },
            },
            { headerName: "Hash", field: "hash", flex: 3 },
            { headerName: "Count", field: "count", width: 90 },
            {
                headerName: "Freeable",
                field: "size",
                width: 120,
                valueFormatter: (params) => {
                    if (params.data.rowType === 'detail') return '';
                    const data = params.data;
                    if (!data.fileList || data.fileList.length === 0) return '0 B';
                    const freeableSize = data.size - data.fileList[0].size;
                    return typeof formatBytes === 'function' ? formatBytes(freeableSize) : freeableSize;
                }
            }
        ],
        getRowId: (params) => params.data.id,
        isFullWidthRow: (params) => params.rowNode.data.rowType === 'detail',
        fullWidthCellRenderer: NestedGridRenderer,
        getRowHeight: (params) => {
            if (params.data.rowType === 'detail') {
                return params.node.rowHeight || 100;
            }
            return 40;
        },
        context: {
            dirtySock: dirtySock,
            nestedGrids: {},
            registerNestedGrid: (hash, api) => {
                window.leftGridOptions.context.nestedGrids[hash] = api;
            },
            checkMasterRow: (hash) => {
                const masterNode = window.leftGridApi.getRowNode(hash);
                if (masterNode) {
                    const nestedApi = window.leftGridOptions.context.nestedGrids[hash];
                    if (nestedApi) {
                        let allSet = true;
                        let hasNonOriginals = false;

                        nestedApi.forEachNode(node => {
                            if (!node.data.isOriginal) {
                                hasNonOriginals = true;
                                if (node.data.action !== 'link' && node.data.action !== 'delete') {
                                    allSet = false;
                                }
                            }
                        });

                        const isAllSet = hasNonOriginals && allSet;
                        if (masterNode.data.allSet !== isAllSet) {
                             masterNode.setDataValue('allSet', isAllSet);
                        }

                        // Update the group data source of truth as well
                        const group = window.allGroupsData.find(g => g.hash === hash);
                        if (group) {
                            group.allSet = isAllSet;
                        }
                    }
                }
            }
        },
        rowClassRules: {
            'all-actions-set': (params) => params.data.rowType === 'master' && params.data.allSet
        },
        onGridReady: (params) => {
            window.leftGridApi = params.api;
            window.leftGridOptions = params.api.getGridOption('context') ? { context: params.api.getGridOption('context') } : { context: params.context };
        },
        onColumnHeaderClicked: (params) => {
            if (params.column.getColDef().field === 'expanded') {
                if (!window.allGroupsData.length) return;
                const allHashes = window.allGroupsData.map(g => g.hash);
                const allExpanded = allHashes.every(h => window.expandedHashes.has(h));

                if (allExpanded) {
                    window.expandedHashes.clear();
                } else {
                    allHashes.forEach(h => window.expandedHashes.add(h));
                }
                refreshLeftGridData();

                // Update header text.
                // params.column.getColDef().headerName = allExpanded ? '▶' : '▼';
                // params.api.refreshHeader();
                // But refreshing header is simpler by re-setting defs or just ignoring visual sync for now (functional toggle works).
                // To sync visual:
                // const colDefs = params.api.getColumnDefs();
                // colDefs[0].headerName = allExpanded ? '▶' : '▼';
                // params.api.setGridOption('columnDefs', colDefs);
            }
        }
    };
}
