const rightTableConfig = {
    index:"ino",
    height:"100%",
    reactiveData:true,
    layout:"fitColumns",
    initialFilter: function(data){
        return data.action === "link" || data.action === "delete";
    },
    columns:[
        {title:"Action", field:"action", width:80, resizable: false,},
        {title:"Path", field:"path"},
    ],
};
