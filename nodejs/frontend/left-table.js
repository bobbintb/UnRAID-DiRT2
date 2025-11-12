const leftTableConfig = {
    index:"ino",
    height:"100%",
    reactiveData:true,
    groupBy:"hash",
    layout:"fitColumns",
    selectableRows:1,
    columns:[
        {formatter:"rowSelection", title:"", resizable:false, width:40, headerSort:false, cellClick:function(e, cell){
            cell.getRow().toggleSelect();
        }},
        {title:"Path", field:"path", resizable:false},
        {title:"Size", field:"size", width:90, resizable:false},
        {title:"Modified", field:"mtime", width:170, resizable:false},
        {title:"Created", field:"ctime", width:170, resizable:false},
    ],
};
