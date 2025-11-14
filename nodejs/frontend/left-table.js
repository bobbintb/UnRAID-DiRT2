const leftTableConfig = {
    index: "hash",
    height: "100%",
    reactiveData: true,
    layout: "fitColumns",
    columns: [
        {
            formatter: function(cell, formatterParams, onRendered) {
                return "▶"; // Return a right-pointing arrow for the collapsed state
            },
            width: 40,
            hozAlign: "center",
            cellClick: function(e, cell) {
                const row = cell.getRow();
                const rowEl = row.getElement();
                const holderEl = rowEl.querySelector(".nested-table-container");

                if (holderEl) {
                    if (holderEl.style.display === "none") {
                        holderEl.style.display = "block";
                        cell.getElement().innerHTML = "▼"; // Change to down-pointing arrow for expanded state
                    } else {
                        holderEl.style.display = "none";
                        cell.getElement().innerHTML = "▶"; // Change back to right-pointing arrow for collapsed state
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
            title: "Total Size",
            field: "size",
            width: 120,
            resizable: false,
        },
    ],
    rowFormatter: function (row) {
        const data = row.getData();
        if (data.fileList && data.fileList.length > 0) {
            const holderEl = document.createElement("div");
            const tableEl = document.createElement("div");

            holderEl.classList.add("nested-table-container");
            holderEl.style.display = "none"; // Hide the nested table by default

            holderEl.style.boxSizing = "border-box";
            holderEl.style.padding = "10px 30px 10px 10px";
            holderEl.style.borderTop = "1px solid #333";
            holderEl.style.borderBottom = "1px solid #333";
            holderEl.style.background = "#ddd";

            tableEl.style.border = "1px solid #333";
            holderEl.appendChild(tableEl);
            row.getElement().appendChild(holderEl);

            new Tabulator(tableEl, {
                layout: "fitColumns",
                data: data.fileList,
                index: "ino",
                columns: [
                    {
                        title: "",
                        field: "isOriginal",
                        formatter: radioSelectFormatter,
                        hozAlign: "center",
                        width: 80,
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
};
