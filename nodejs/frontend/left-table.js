const leftTableConfig = {
    index: "hash",
    height: "100%",
    reactiveData: true,
    layout: "fitColumns",
    dataTree: true,
    dataTreeStartExpanded: true,
    columns: [
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
            field: "totalSize",
            width: 120,
            resizable: false,
        },
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
    ],
};
