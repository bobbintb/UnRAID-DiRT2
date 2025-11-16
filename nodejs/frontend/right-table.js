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
            headerHozAlign:"center",
            headerClick:function(e, column){
                if(confirm("Are you sure you want to reset all actions?")){
                    dirtySock('clearAllActions');
                }
            }
        },
        {title:"Path", field:"path"},
    ],
});
