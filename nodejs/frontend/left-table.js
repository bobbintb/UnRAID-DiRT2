const leftTableConfig = {
    index:"ino",
    height:"100%",
    reactiveData:true,
    groupBy:"hash",
    layout:"fitDataStretchPath",
    columns:[
        {title:"Path", field:"path", stretchToFit:true},
        {title:"Size", field:"size", resizable:false},
        {title:"Modified", field:"mtime", resizable:false},
        {title:"Created", field:"ctime", resizable:false},
    ],
};
