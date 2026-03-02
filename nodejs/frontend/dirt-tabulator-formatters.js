
function pathFormatter(cell, formatterParams) {
    const path = cell.getValue();
    const data = cell.getRow().getData();
    if (data.nlink > 1) {
        return `<i class="fa fa-link" style="transform: rotate(45deg); margin-right: 5px;"></i>${path}`;
    }
    return path;
}

function deleteActionFormatter(cell, formatterParams, onRendered) {
    const { path, action, isOriginal } = cell.getRow().getData();
    const { dirtySock } = formatterParams;
    const icon = document.createElement("i");
    icon.classList.add("fa", "fa-trash");
    icon.style.cursor = "pointer";
    icon.title = "Delete";

    if (action === "delete") {
        icon.classList.add("selected");
    }

    if (isOriginal) {
        icon.style.display = "none";
    }

    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cell.getRow().getData().isOriginal) return;

        const currentAction = cell.getRow().getData().action;
        const newAction = currentAction === "delete" ? null : "delete";

        cell.getRow().update({ action: newAction }).then(() => {
            checkAndUpdateMasterRow(cell.getTable());
        });
        dirtySock('setAction', { path, action: newAction });
    });

    return icon;
}

function linkActionFormatter(cell, formatterParams, onRendered) {
    const { path, action, isOriginal } = cell.getRow().getData();
    const { dirtySock } = formatterParams;
    const icon = document.createElement("i");
    icon.classList.add("fa", "fa-link");
    icon.style.cursor = "pointer";
    icon.title = "Link";

    if (action === "link") {
        icon.classList.add("selected");
    }

    if (isOriginal) {
        icon.style.display = "none";
    }

    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cell.getRow().getData().isOriginal) return;

        const currentAction = cell.getRow().getData().action;
        const newAction = currentAction === "link" ? null : "link";

        cell.getRow().update({ action: newAction }).then(() => {
            checkAndUpdateMasterRow(cell.getTable());
        });
        dirtySock('setAction', { path, action: newAction });
    });

    return icon;
}

function radioSelectFormatter(cell, formatterParams, onRendered) {
    const { isOriginal, hash, path } = cell.getRow().getData();
    const { dirtySock } = formatterParams;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "original-" + hash;
    radio.checked = isOriginal;
    radio.title = "Original";

    const rowEl = cell.getRow().getElement();

    function setRowState(isOriginal) {
        if (isOriginal) {
            rowEl.classList.add('original-row');
        } else {
            rowEl.classList.remove('original-row');
        }
    }

    onRendered(() => {
        setRowState(cell.getRow().getData().isOriginal);
    });

    radio.addEventListener('change', () => {
        const table = cell.getTable();
        const selectedRow = cell.getRow();

        table.getRows().forEach(row => {
            const rowData = row.getData();
            if (row === selectedRow) {
                if (rowData.isOriginal === false) {
                    row.update({ isOriginal: true, action: null });
                    if (dirtySock) {
                        dirtySock('setAction', { path: rowData.path, action: null });
                        dirtySock('setOriginalFile', { hash: rowData.hash, path: rowData.path });
                    }
                }
                row.getElement().classList.add('original-row');
            } else {
                if (rowData.isOriginal === true) {
                   row.update({ isOriginal: false });
                }
                row.getElement().classList.remove('original-row');
            }
        });

        checkAndUpdateMasterRow(table);
    });

    return radio;
}
