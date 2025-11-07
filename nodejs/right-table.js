const rightTable = new Tabulator("#right-table", {
    height:"100%",
    reactiveData:true,
    columns:[
        {title:"Path", field:"path", widthGrow:1},
    ],
});
