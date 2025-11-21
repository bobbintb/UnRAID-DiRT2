let allRowsExpanded = true; // Global state for the toggle all feature

const generateLeftTableConfig = (dirtySock) => ({
    index: "hash",
    height: "100%",
    reactiveData: true,
    layout: "fitColumns",
    renderVertical:"basic",
    columns: [
        {
            title: "▼",
            formatter: function(cell, formatterParams, onRendered) {
                return "▼"; // Default to expanded state
            },
            width: 40,
            hozAlign: "center",
            headerSort: false,
            headerClick: function(e, column) {
                allRowsExpanded = !allRowsExpanded;
                const newIcon = allRowsExpanded ? "▼" : "▶";
                column.getElement().querySelector(".tabulator-col-title").textContent = newIcon;

                const table = column.getTable();
                table.getRows().forEach(row => {
                    const cell = row.getCells()[0];
                    if (cell) {
                        const cellIcon = cell.getElement().innerHTML;
                        const isCurrentlyExpanded = cellIcon.includes("▼");

                        if (isCurrentlyExpanded !== allRowsExpanded) {
                            cell.getElement().click();
                        }
                    }
                });
            },
            cellClick: function(e, cell) {
                const row = cell.getRow();
                const holderEl = row.getElement().querySelector(".nested-table-container");

                if (holderEl) {
                    if (holderEl.style.display === "none") {
                        holderEl.style.display = "block";
                        cell.getElement().innerHTML = "▼";
                    } else {
                        holderEl.style.display = "none";
                        cell.getElement().innerHTML = "▶";
                    }
                }
            }
        },
        {
            title: "Hash",
            field: "hash",
            widthGrow: 3,
            resizable: false,
        },
        {
            title: "Count",
            field: "count",
            width: 90,
            resizable: false,
        },
        {
            title: "Freeable",
            field: "size",
            width: 120,
            resizable: false,
            formatter: function(cell) {
                const data = cell.getRow().getData();
                const freeableSize = data.size - data.fileList[0].size;
                return formatBytes(freeableSize);
            }
        },
    ],
    rowFormatter: function (row) {
        const data = row.getData();
        if (data.fileList && data.fileList.length > 0) {
            const holderEl = document.createElement("div");
            const tableEl = document.createElement("div");

            holderEl.classList.add("nested-table-container");
            holderEl.style.display = "block"; // Show the nested table by default

            holderEl.style.boxSizing = "border-box";
            holderEl.style.padding = "10px 30px 10px 10px";
            holderEl.style.borderTop = "1px solid #333";
            holderEl.style.borderBottom = "1px solid #333";
            holderEl.style.background = "#ddd";

            tableEl.style.border = "1px solid #333";
            holderEl.appendChild(tableEl);
            row.getElement().appendChild(holderEl);

            // LEVEL 2 TABLE
            const nestedTable = new Tabulator(tableEl, {
                layout: "fitColumns",
                renderVertical: "basic",
                data: data.fileList,
                index: "path",
                columns: [
                    // Removed Expander Column
                    {
                        title: "",
                        field: "isOriginal",
                        formatter: (cell, formatterParams, onRendered) => radioSelectFormatter(cell, { ...formatterParams, dirtySock }, onRendered),
                        hozAlign: "center",
                        width: 30,
                        minWidth: 30,
                        resizable: false,
                        headerSort: false
                    },
                    {
                        title: "Action",
                        field: "action",
                        formatter: (cell, formatterParams) => actionFormatter(cell, { ...formatterParams, dirtySock }),
                        hozAlign: "center",
                        width: 80,
                        minWidth: 80,
                        resizable: false,
                        headerSort: false
                    },
                    {
                        title: "Path",
                        field: "path",
                        formatter: pathFormatter,
                        resizable: false,
                        widthGrow: 3,
                        titleFormatter: "html"
                    },
                    {
                        title: "Size",
                        field: "size",
                        formatter: formatSize,
                        width: 90,
                        resizable: false
                    },
                    {
                        title: "Modified",
                        field: "mtime",
                        width: 170,
                        resizable: false
                    },
                    {
                        title: "Created",
                        field: "ctime",
                        width: 170,
                        resizable: false
                    },
                ],
                rowFormatter: function(row) {
                    const data = row.getData();

                    // If Group Row: Hide standard cells to remove "Header" look
                    if (data.type === 'group') {
                        const cells = row.getCells();
                        cells.forEach(c => {
                            const el = c.getElement();
                            if (el) el.style.display = 'none';
                        });
                        row.getElement().style.border = "none";
                        row.getElement().style.background = "transparent";
                    }

                    // LEVEL 3 TABLE (Hardlinks)
                    if (data.nestedFiles && data.nestedFiles.length > 0) {
                        const holder = document.createElement("div");
                        const tableEl3 = document.createElement("div");

                        holder.className = "level3-table-container";
                        holder.style.display = "block"; // Always Visible
                        // Indentation to distinguish group
                        holder.style.padding = "0 0 5px 0";
                        holder.style.borderLeft = "3px solid #999"; // Simple visual grouper line
                        holder.style.marginLeft = "10px"; // Indent slightly

                        tableEl3.style.border = "none"; // Clean look

                        holder.appendChild(tableEl3);
                        row.getElement().appendChild(holder);

                        const level3Table = new Tabulator(tableEl3, {
                            layout: "fitColumns",
                            renderVertical: "basic",
                            data: data.nestedFiles,
                            index: "path",
                            headerVisible: false,
                            columns: [
                                // Spacer to align with Level 2 radio?
                                // Since Level 2 Radio is Col 0 (after removing expander).
                                // Level 3 Col 0 should align with Level 2 Col 0?
                                // But Level 2 Group Row cells are hidden.
                                // Level 3 Table is indented by margin-left: 10px.
                                // Let's just render the columns naturally.
                                {
                                    title: "",
                                    field: "isOriginal",
                                    formatter: (cell, formatterParams, onRendered) => radioSelectFormatter(cell, { ...formatterParams, dirtySock }, onRendered),
                                    hozAlign: "center",
                                    width: 30,
                                    minWidth: 30,
                                    resizable: false,
                                    headerSort: false
                                },
                                {
                                    title: "Action",
                                    field: "action",
                                    formatter: (cell, formatterParams) => actionFormatter(cell, { ...formatterParams, dirtySock }),
                                    hozAlign: "center",
                                    width: 80,
                                    minWidth: 80,
                                    resizable: false,
                                    headerSort: false
                                },
                                {
                                    title: "Path",
                                    field: "path",
                                    formatter: pathFormatter,
                                    widthGrow: 3,
                                    resizable: false,
                                    titleFormatter: "html"
                                }
                            ]
                        });

                        // Store reference just in case
                        holder._tabulator = level3Table;

                         try {
                            if (level3Table && typeof level3Table.on === 'function') {
                                level3Table.on('renderComplete', function () {
                                    if (typeof checkAndUpdateMasterRow === 'function') checkAndUpdateMasterRow(level3Table);
                                });
                            }
                        } catch (e) {}

                        if (typeof checkAndUpdateMasterRow === 'function') {
                            checkAndUpdateMasterRow(level3Table);
                        }
                    }
                }
            });

            try {
                if (nestedTable && typeof nestedTable.on === 'function') {
                    nestedTable.on('renderComplete', function () {
                        if (typeof checkAndUpdateMasterRow === 'function') checkAndUpdateMasterRow(nestedTable);
                    });
                }
            } catch (e) {}

            if (typeof checkAndUpdateMasterRow === 'function') {
                checkAndUpdateMasterRow(nestedTable);
            }
        }
    },
});
