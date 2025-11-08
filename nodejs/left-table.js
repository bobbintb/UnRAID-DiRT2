const leftTableConfig = {
    height:"100%",
    reactiveData:true,
    index: "ino",
    groupBy:"hash",
    columns:[
        {title:"ID", field:"ino", width:100},
        {title:"Path", field:"path", widthGrow:1},
        {title:"Size", field:"size"},
        {title:"Modified", field:"mtime"},
        {title:"Created", field:"ctime"},
    ],
};
