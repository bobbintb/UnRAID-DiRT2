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
                data: data.fileList,
                index: "ino",
                dataChanged: function(data) {
                    checkAndUpdateMasterRow(this);
                },
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
                        resizable: false,
                        widthGrow: 3
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
        }
    },
});
