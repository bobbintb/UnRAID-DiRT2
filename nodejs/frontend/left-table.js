const leftTableConfig = {
    index:"ino",
    height:"100%",
    reactiveData:true,
    groupBy:"hash",
    layout:"fitColumns",
    columns:[
        {title:"", field:"isOriginal", formatter:radioSelectFormatter, hozAlign:"center", width:80, resizable:false, headerSort:false},
        {title:"Path", field:"path", resizable:false},
        {title:"Size", field:"size", width:90, resizable:false},
        {title:"Modified", field:"mtime", width:170, resizable:false},
        {title:"Created", field:"ctime", width:170, resizable:false},
    ],
};
