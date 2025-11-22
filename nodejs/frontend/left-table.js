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

            const nestedTable = new Tabulator(tableEl, {
                layout: "fitColumns",
                renderVertical: "basic",
                data: data.fileList,
                index: "path",
                columns: [
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
                        sorter: function(a, b, aRow, bRow, column, dir, sorterParams) {
                            const keyA = aRow.getData().groupSortKey || "";
                            const keyB = bRow.getData().groupSortKey || "";
                            return keyA.localeCompare(keyB);
                        },
                        resizable: false,
                        widthGrow: 3,
                        titleFormatter: "html" // Just in case, usually safe
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
                ]
            });
            // Ensure master-row highlight updates when nested table finishes rendering
            try {
                if (nestedTable && typeof nestedTable.on === 'function') {
                    nestedTable.on('renderComplete', function () {
                        if (typeof checkAndUpdateMasterRow === 'function') checkAndUpdateMasterRow(nestedTable);

                        // Apply hardlink group borders
                        const rows = nestedTable.getRows("active");
                        const rowCount = rows.length;

                        for (let i = 0; i < rowCount; i++) {
                            const row = rows[i];
                            const data = row.getData();
                            const el = row.getElement();

                            // Clear previous classes
                            el.classList.remove('hardlink-group-top', 'hardlink-group-middle', 'hardlink-group-bottom', 'hardlink-group-box');

                            if (data.nlink > 1) {
                                const prevRow = i > 0 ? rows[i - 1] : null;
                                const nextRow = i < rowCount - 1 ? rows[i + 1] : null;

                                const prevIno = prevRow ? prevRow.getData().ino : null;
                                const nextIno = nextRow ? nextRow.getData().ino : null;
                                const currentIno = data.ino;

                                const isStart = currentIno !== prevIno;
                                const isEnd = currentIno !== nextIno;

                                if (isStart && isEnd) {
                                    el.classList.add('hardlink-group-box');
                                } else if (isStart) {
                                    el.classList.add('hardlink-group-top');
                                } else if (isEnd) {
                                    el.classList.add('hardlink-group-bottom');
                                } else {
                                    el.classList.add('hardlink-group-middle');
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                // Ignore: defensive in case Tabulator instance doesn't expose events
            }

            // Attempt an immediate update as a fallback (idempotent)
            if (typeof checkAndUpdateMasterRow === 'function') {
                checkAndUpdateMasterRow(nestedTable);
            }
        }
    },
});
