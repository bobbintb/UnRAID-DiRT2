
const rightTableConfig = {
    columnDefs: [
        {
            headerName: "Action", field: "action",
            width: 80,
            cellRenderer: (params) => {
                const action = params.value;
                const div = document.createElement('div');
                div.style.textAlign = 'center';
                div.style.width = '100%';
                if (action === 'delete') {
                    div.innerHTML = '<i class="fa fa-trash"></i>';
                } else if (action === 'link') {
                    div.innerHTML = '<i class="fa fa-link"></i>';
                }
                return div;
            },
            sortable: false,
            resizable: false
        },
        {
            headerName: "Path", field: "path",
            cellRenderer: PathRenderer,
            flex: 1,
            sortable: true,
            resizable: true
        }
    ],
    getRowId: (params) => params.data.path,
    isExternalFilterPresent: () => true,
    doesExternalFilterPass: (node) => {
        return node.data.action === 'link' || node.data.action === 'delete';
    },
    onGridReady: (params) => {
         window.rightGridApi = params.api;
    }
};
