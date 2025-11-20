const rightTableConfig = {
    index: "path",
    height: "100%",
    reactiveData: true,
    layout: "fitColumns",
    columns: [{
        title: "Action",
        field: "action",
        width: 80,
        resizable: false,
        hozAlign: "center",
        formatter: function(cell) {
            const action = cell.getValue();
            if (action === "delete") {
                return '<i class="fa fa-trash"></i>';
            } else if (action === "link") {
                return '<i class="fa fa-link"></i>';
            }
            return '';
        }
    }, {
        title: "Path",
        field: "path",
        formatter: pathFormatter,
    }, ],
};
