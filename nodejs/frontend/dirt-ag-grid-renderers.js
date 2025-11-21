
class PathRenderer {
    init(params) {
        this.eGui = document.createElement('div');
        this.params = params;
        this.render();
    }

    render() {
        const data = this.params.data;
        const value = this.params.value;

        if (data.nlink > 1) {
            this.eGui.innerHTML = `<i class="fa fa-link" style="transform: rotate(45deg); margin-right: 5px;"></i>${value}`;
        } else {
            this.eGui.textContent = value;
        }
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        this.params = params;
        this.render();
        return true;
    }
}

class ActionRenderer {
    init(params) {
        this.eGui = document.createElement('div');
        this.params = params;
        this.render();
    }

    render() {
        const { action, isOriginal } = this.params.data;

        // Reset container
        this.eGui.innerHTML = '';
        this.eGui.style.display = 'flex';
        this.eGui.style.justifyContent = 'center';
        this.eGui.style.alignItems = 'center';
        this.eGui.style.height = '100%';

        const trashIcon = document.createElement("i");
        trashIcon.classList.add("fa", "fa-trash");
        trashIcon.style.cursor = isOriginal ? "not-allowed" : "pointer";
        trashIcon.style.marginRight = "10px";
        trashIcon.style.opacity = isOriginal ? "0.5" : "1";
        if (action === "delete") {
            trashIcon.classList.add("selected");
            trashIcon.style.color = "red";
        }

        const linkIcon = document.createElement("i");
        linkIcon.classList.add("fa", "fa-link");
        linkIcon.style.cursor = isOriginal ? "not-allowed" : "pointer";
        linkIcon.style.opacity = isOriginal ? "0.5" : "1";
        if (action === "link") {
            linkIcon.classList.add("selected");
            linkIcon.style.color = "blue";
        }

        if (!isOriginal) {
            trashIcon.addEventListener('click', () => this.onActionClick('delete'));
            linkIcon.addEventListener('click', () => this.onActionClick('link'));
        }

        this.eGui.appendChild(trashIcon);
        this.eGui.appendChild(linkIcon);
    }

    onActionClick(clickedAction) {
        const currentAction = this.params.data.action;
        const newAction = currentAction === clickedAction ? null : clickedAction;
        const { path } = this.params.data;

        // Update local data (Left Grid / Nested Grid)
        this.params.node.setDataValue('action', newAction);

        // Update Right Grid
        if (window.rightGridApi) {
            const rightNode = window.rightGridApi.getRowNode(path);
            if (rightNode) {
                rightNode.setDataValue('action', newAction);
                window.rightGridApi.onFilterChanged();
            }
        }

        // Send to backend
        if (this.params.context.dirtySock) {
             this.params.context.dirtySock('setAction', { path, action: newAction });
        }

        // Update Master Row Color
        if (this.params.context.checkMasterRow) {
            this.params.context.checkMasterRow(this.params.data.hash);
        }
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        this.params = params;
        this.render();
        return true;
    }
}

class RadioSelectRenderer {
    init(params) {
        this.eGui = document.createElement('input');
        this.eGui.type = "radio";
        this.eGui.style.cursor = "pointer";
        this.params = params;
        this.render();

        this.eGui.addEventListener('change', () => this.onChange());
    }

    render() {
        const { isOriginal, hash } = this.params.data;
        this.eGui.name = "original-" + hash;
        this.eGui.checked = isOriginal;
    }

    onChange() {
        if (this.eGui.checked) {
            const { hash, path } = this.params.data;
            const gridApi = this.params.api;

            // Update all rows in this nested grid
            gridApi.forEachNode(node => {
                const data = node.data;
                if (data.path === path) {
                    if (!data.isOriginal) {
                        data.isOriginal = true;
                        data.action = null;
                        node.setData(data);

                        // Sync Right Grid
                        if (window.rightGridApi) {
                            const rightNode = window.rightGridApi.getRowNode(data.path);
                            if (rightNode) {
                                rightNode.setDataValue('isOriginal', true);
                                rightNode.setDataValue('action', null);
                            }
                        }
                    }
                } else {
                    if (data.isOriginal) {
                        data.isOriginal = false;
                        node.setData(data);

                        // Sync Right Grid
                        if (window.rightGridApi) {
                            const rightNode = window.rightGridApi.getRowNode(data.path);
                            if (rightNode) {
                                rightNode.setDataValue('isOriginal', false);
                            }
                        }
                    }
                }
            });

            if (window.rightGridApi) {
                window.rightGridApi.onFilterChanged();
            }

            // Send to backend
            if (this.params.context.dirtySock) {
                this.params.context.dirtySock('setOriginalFile', { hash, path });
                this.params.context.dirtySock('setAction', { path: path, action: null });
            }

            if (this.params.context.checkMasterRow) {
                this.params.context.checkMasterRow(hash);
            }
        }
    }

    getGui() {
        return this.eGui;
    }

    refresh(params) {
        this.params = params;
        this.render();
        return true;
    }
}

class NestedGridRenderer {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.style.width = "100%";
        this.eGui.classList.add('nested-grid-container');
        this.eGui.style.padding = "10px 30px 10px 10px";
        this.eGui.style.background = "#ddd";
        this.eGui.style.boxSizing = "border-box";

        const gridDiv = document.createElement('div');
        gridDiv.style.height = "100%";
        gridDiv.style.width = "100%";
        gridDiv.classList.add('ag-theme-alpine');
        this.eGui.appendChild(gridDiv);

        const detailData = params.data.fileList || [];

        const columnDefs = [
            {
                headerName: "", field: "isOriginal",
                cellRenderer: RadioSelectRenderer,
                width: 50, suppressMenu: true, sortable: false, resizable: false,
                cellStyle: { 'display': 'flex', 'justify-content': 'center', 'align-items': 'center' }
            },
            {
                headerName: "Action", field: "action",
                cellRenderer: ActionRenderer,
                width: 100, suppressMenu: true, sortable: false, resizable: false
            },
            {
                headerName: "Path", field: "path",
                cellRenderer: PathRenderer,
                flex: 1, suppressMenu: true, sortable: true, resizable: false
            },
            {
                headerName: "Size", field: "size",
                valueFormatter: (p) => typeof formatBytes === 'function' ? formatBytes(p.value) : p.value,
                width: 100, suppressMenu: true, sortable: true, resizable: false
            },
            { headerName: "Modified", field: "mtime", width: 170, suppressMenu: true, resizable: false },
            { headerName: "Created", field: "ctime", width: 170, suppressMenu: true, resizable: false }
        ];

        const gridOptions = {
            columnDefs: columnDefs,
            rowData: detailData,
            headerHeight: 30,
            rowHeight: 40,
            context: params.context,
            domLayout: 'autoHeight',
            getRowClass: (params) => {
                if (params.data.isOriginal) return 'original-row';
            },
            onGridReady: (apiParams) => {
               if (params.context.registerNestedGrid) {
                   params.context.registerNestedGrid(params.data.hash, apiParams.api);
               }
               setTimeout(() => this.updateHeight(), 50);
            },
            onRowDataUpdated: () => this.updateHeight(),
            onGridSizeChanged: () => this.updateHeight(),
            onModelUpdated: () => this.updateHeight()
        };

        this.gridApi = agGrid.createGrid(gridDiv, gridOptions);
    }

    updateHeight() {
        if (!this.gridApi || this.gridApi.destroyCalled) return;

        const gridBody = this.eGui.querySelector('.ag-root-wrapper');
        if (gridBody) {
            const height = gridBody.offsetHeight;
            const totalHeight = height + 20;

            if (this.params.node.rowHeight !== totalHeight) {
                this.params.node.setRowHeight(totalHeight);
                this.params.api.onRowHeightChanged();
            }
        }
    }

    getGui() {
        return this.eGui;
    }

    destroy() {
        if (this.gridApi) {
            this.gridApi.destroy();
        }
    }
}
