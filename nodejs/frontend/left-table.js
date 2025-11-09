const leftTableConfig = {
    index:"ino",
    height:"100%",
    reactiveData:true,
    groupBy:"hash",
    layout:"fitDataFill",
    columns:[
        {title:"Path", field:"path"},
        {title:"Size", field:"size", resizable:false},
        {title:"Modified", field:"mtime", resizable:false},
        {title:"Created", field:"ctime", resizable:false},
    ],
};
