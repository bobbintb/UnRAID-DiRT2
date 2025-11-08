const leftTableConfig = {
    index:"ino",
    height:"100%",
    reactiveData:true,
    groupBy:"hash",
    columns:[
        {title:"Path", field:"path", widthGrow:1},
        {title:"Size", field:"size"},
        {title:"Modified", field:"mtime"},
        {title:"Created", field:"ctime"},
    ],
};
