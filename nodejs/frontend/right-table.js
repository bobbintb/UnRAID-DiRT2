const generateRightTableConfig = (dirtySock) => ({
    index:"ino",
    height:"100%",
    reactiveData:true,
    layout:"fitColumns",
    columns:[
        {
            title:"<i class='fa fa-trash'></i>",
            field:"action",
            width:80,
            resizable: false,
            formatter:rightTableActionFormatter,
            hozAlign:"center",
            titleFormatter: "html",
            headerClick:function(e, column){
                if(confirm("Are you sure you want to reset all actions?")){
                    const table = column.getTable();
                    const rows = table.getRows();
                    rows.forEach(function(row){
                        const rowData = row.getData();
                        dirtySock('setAction', { hash: rowData.hash, ino: rowData.ino, action: 'none' });
                    });
                }
            }
        },
        {title:"Path", field:"path"},
    ],
});
