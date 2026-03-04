const rightTableConfig = {
    index: "path",
    height: "100%",
    reactiveData: true,
    layout: "fitColumns",
    columns: [{
        title: "Action",
        field: "action",
        width: 80,
        resizable: false,
        hozAlign: "center",
        formatter: function(cell) {
            const action = cell.getValue();
            if (!action) return '';

            const iconClass = action === "delete" ? "fa-trash" : "fa-link";
            const icon = document.createElement("i");
            icon.classList.add("fa", iconClass, "action-reset-icon");
            icon.title = "Click to reset action";

            icon.addEventListener('mouseenter', () => {
                icon.classList.remove(iconClass);
                icon.classList.add("fa-times-circle");
                icon.style.color = "red";
            });

            icon.addEventListener('mouseleave', () => {
                icon.classList.remove("fa-times-circle");
                icon.classList.add(iconClass);
                icon.style.color = "";
            });

            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const path = cell.getRow().getData().path;
                if (window.dirtySock) {
                    window.dirtySock('setAction', { path: path, action: null });
                }
            });

            return icon;
        }
    }, {
        title: "Path",
        field: "path",
        formatter: pathFormatter,
        titleFormatter: "html"
    }, ],
};
