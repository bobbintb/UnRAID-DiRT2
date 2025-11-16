const generateRightTableConfig = (dirtySock, leftTable) => ({
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
            headerHozAlign:"center",
            headerClick:function(e, column){
                if(confirm("Are you sure you want to reset all actions?")){
                    const rightTable = column.getTable();
                    const leftTableRows = leftTable.getRows();

                    leftTableRows.forEach(function(masterRow){
                        const nestedTable = masterRow.getTreeChildren()[0];
                        if(nestedTable){
                            const nestedRows = nestedTable.getRows();
                            nestedRows.forEach(function(nestedRow){
                                const rowData = nestedRow.getData();
                                if(rowData.action === 'delete' || rowData.action === 'link'){
                                    nestedRow.update({action: null});
                                    const rightTableRow = rightTable.getRow(rowData.ino);
                                    if(rightTableRow){
                                        rightTableRow.update({action: null});
                                    }
                                    dirtySock('setAction', { hash: rowData.hash, ino: rowData.ino, action: null });
                                }
                            });
                        }
                    });
                }
            }
        },
        {title:"Path", field:"path"},
    ],
});
