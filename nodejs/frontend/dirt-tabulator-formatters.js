
function actionFormatter(cell, formatterParams) {
    const { hash, ino, action } = cell.getRow().getData();
    const { dirtySock } = formatterParams;
    const container = document.createElement("div");

    const trashIcon = document.createElement("i");
    trashIcon.classList.add("fa", "fa-trash");
    trashIcon.style.cursor = "pointer";
    trashIcon.style.marginRight = "10px";
    if (action === "delete") {
        trashIcon.classList.add("selected");
    }

    const linkIcon = document.createElement("i");
    linkIcon.classList.add("fa", "fa-link");
    linkIcon.style.cursor = "pointer";
    if (action === "link") {
        linkIcon.classList.add("selected");
    }

    const getAction = () => cell.getRow().getData().action;

    trashIcon.addEventListener('click', () => {
        if (cell.getRow().getElement().classList.contains('original-row')) {
            return;
        }
        const currentAction = getAction();
        const newAction = currentAction === "delete" ? null : "delete";

        // Update UI immediately
        trashIcon.classList.toggle("selected", newAction === "delete");
        linkIcon.classList.remove("selected");

        // Update Tabulator and send to backend
        cell.getRow().update({ action: newAction });
        dirtySock('setAction', { hash, ino, action: newAction });
        checkAndUpdateMasterRow(cell);
    });

    linkIcon.addEventListener('click', () => {
        if (cell.getRow().getElement().classList.contains('original-row')) {
            return;
        }
        const currentAction = getAction();
        const newAction = currentAction === "link" ? null : "link";

        // Update UI immediately
        linkIcon.classList.toggle("selected", newAction === "link");
        trashIcon.classList.remove("selected");

        // Update Tabulator and send to backend
        cell.getRow().update({ action: newAction });
        dirtySock('setAction', { hash, ino, action: newAction });
        checkAndUpdateMasterRow(cell);
    });

    container.appendChild(trashIcon);
    container.appendChild(linkIcon);

    return container;
}

function radioSelectFormatter(cell, formatterParams, onRendered) {
    const { isOriginal, hash, ino } = cell.getRow().getData();
    const { dirtySock } = formatterParams;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "original-" + hash;
    radio.checked = isOriginal;

    const rowEl = cell.getRow().getElement();

    function setRowState(isOriginal) {
        if (isOriginal) {
            rowEl.classList.add('original-row');
        } else {
            rowEl.classList.remove('original-row');
        }
    }

    // Set initial state after the cell has been rendered
    onRendered(() => {
        setRowState(cell.getRow().getData().isOriginal);
        checkAndUpdateMasterRow(cell);
    });

    radio.addEventListener('change', () => {
        const table = cell.getTable();
        const selectedRow = cell.getRow();
        const { hash, ino } = selectedRow.getData();

        table.getRows().forEach(row => {
            const rowEl = row.getElement();
            const rowData = row.getData();

            if (row === selectedRow) {
                // This row is now the original
                if (rowData.isOriginal === false) {
                    row.update({ isOriginal: true, action: null });
                    if (dirtySock) {
                        dirtySock('setAction', { hash: rowData.hash, ino: rowData.ino, action: null });
                    }
                    // Deselect icons in UI
                    const icons = rowEl.querySelectorAll('.fa-trash.selected, .fa-link.selected');
                    icons.forEach(icon => icon.classList.remove('selected'));
                }
                rowEl.classList.add('original-row');
            } else {
                // All other rows are not the original
                if (rowData.isOriginal === true) {
                   row.update({ isOriginal: false });
                }
                rowEl.classList.remove('original-row');
            }
        });
        checkAndUpdateMasterRow(cell);

        // Persist the new original file choice
        if (dirtySock) {
            dirtySock('setOriginalFile', { hash, ino });
        }
    });

    return radio;
}

function rightTableActionFormatter(cell) {
    const action = cell.getValue();
    const icon = document.createElement("i");
    icon.classList.add("fa");

    if (action === "delete") {
        icon.classList.add("fa-trash");
    } else if (action === "link") {
        icon.classList.add("fa-link");
    }

    return icon;
}

function checkAndUpdateMasterRow(cell) {
    const table = cell.getTable();
    const rows = table.getRows();
    let allActionsSet = true;

    rows.forEach(row => {
        const rowData = row.getData();
        if (!rowData.isOriginal && (!rowData.action || rowData.action === null)) {
            allActionsSet = false;
        }
    });

    const masterRowEl = table.element.closest('.tabulator-row');
    if (masterRowEl) {
        if (allActionsSet) {
            masterRowEl.classList.add('all-actions-set');
        } else {
            masterRowEl.classList.remove('all-actions-set');
        }
    }
}
