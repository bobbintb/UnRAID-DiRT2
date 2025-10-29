function createGroupHeader() {
    return function(value, count, data, group) {
        const totalSize = data.reduce((acc, row) => acc + (row.size || 0), 0);
        const groupHash = value;
        const uniqueName = "action_group_" + groupHash;
        const container = document.createElement('div');
        container.className = 'group-header-flex-container';
        container.innerHTML = `
            <div class="group-action-container">
                <input type="radio" name="${uniqueName}" value="delete" id="del_${uniqueName}" data-nullable="true">
                <label for="del_${uniqueName}" title="Delete All"><i class="fa fa-trash"></i></label>
                <input type="radio" name="${uniqueName}" value="link" id="link_${uniqueName}" data-nullable="true">
                <label for="link_${uniqueName}" title="Hardlink All"><i class="fa fa-link"></i></label>
            </div>
            <div class="group-info-container">
                <strong>Group: ${value}</strong>
                <span>(${count} files, ${formatBytes(totalSize)})</span>
            </div>
        `;
        const delRadio = container.querySelector(`#del_${uniqueName}`);
        const linkRadio = container.querySelector(`#link_${uniqueName}`);
        const groupActionChangeHandler = function(e) {
            e.stopPropagation();
            const target = e.target;
            const action = target.value;
            if (target.checked && target.getAttribute('data-waschecked') === 'true') {
                target.checked = false;
                target.setAttribute('data-waschecked', 'false');
            } else {
                delRadio.setAttribute('data-waschecked', 'false');
                linkRadio.setAttribute('data-waschecked', 'false');
                target.setAttribute('data-waschecked', 'true');
            }
            const effectiveCheckedState = target.checked;
            const childRows = group.getRows();
            childRows.forEach(row => {
                if (row.getElement().classList.contains('disabled-row')) {
                    return;
                }
                const actionCell = row.getCell('action').getElement();
                const childRadio = actionCell.querySelector(`input[value="${action}"]`);
                if (childRadio) {
                    if ((effectiveCheckedState && !childRadio.checked) || (!effectiveCheckedState && childRadio.checked)) {
                        childRadio.click();
                    }
                }
            });
        };
        delRadio.addEventListener('click', groupActionChangeHandler);
        linkRadio.addEventListener('click', groupActionChangeHandler);
        return container;
    }
}

function createRowFormatter() {
    return function(row) {
        const data = row.getData();
        if (data.isOriginal) {
            row.getElement().classList.add('disabled-row');
        }
    }
}

function createIsPrimaryFormatter(removeFileActionFromQueue, dirtySock, actionQueueTable) {
    return function(cell, formatterParams, onRendered) {
        const data = cell.getRow().getData();
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "primary_group_" + data.hash;
        radio.checked = data.isOriginal;
        radio.addEventListener('click', function() {
            const clickedRow = cell.getRow();
            const groupRows = clickedRow.getGroup().getRows();
            groupRows.forEach(row => {
                const rowEl = row.getElement();
                const rowData = row.getData();
                if (rowData.ino === clickedRow.getData().ino) {
                    rowEl.classList.add('disabled-row');
                    const actionRadios = rowEl.querySelectorAll('.tabulator-cell[tabulator-field="action"] input[type="radio"]');
                    actionRadios.forEach(r => r.checked = false);
                    removeFileActionFromQueue(rowData.ino, rowData.path, dirtySock, actionQueueTable);
                } else {
                    rowEl.classList.remove('disabled-row');
                }
            });
            const groupHash = clickedRow.getData().hash;
            const fileIno = clickedRow.getData().ino;
            dirtySock('setOriginalFile', { hash: groupHash, ino: fileIno });
        });
        return radio;
    }
}

function createActionTitleFormatter() {
    return function(column, formatterParams, onRendered) {
        const uniqueName = "action_group_table_header";
        const container = document.createElement('div');
        container.className = 'group-header-flex-container';
        container.style.justifyContent = 'center';
        container.innerHTML = `
            <div class="group-action-container">
                <input type="radio" name="${uniqueName}" value="delete" id="del_${uniqueName}" data-nullable="true">
                <label for="del_${uniqueName}" title="Delete All"><i class="fa fa-trash"></i></label>
                <input type="radio" name="${uniqueName}" value="link" id="link_${uniqueName}" data-nullable="true">
                <label for="link_${uniqueName}" title="Hardlink All"><i class="fa fa-link"></i></label>
            </div>
        `;
        return container;
    }
}

function createActionFormatter(actionQueueData, removeFileActionFromQueue, dirtySock, actionQueueTable) {
    return function(cell, formatterParams, onRendered) {
        const data = cell.getRow().getData();
        const uniqueName = "action_" + data.ino;
        const container = document.createElement("div");
        const delRadio = document.createElement("input");
        delRadio.type = "radio";
        delRadio.name = uniqueName;
        delRadio.value = "delete";
        delRadio.id = `del_${uniqueName}`;
        delRadio.dataset.nullable = true;
        if (actionQueueData[data.path] === 'delete') {
            delRadio.checked = true;
            delRadio.setAttribute('data-waschecked', 'true');
        }
        const delLabel = document.createElement("label");
        delLabel.htmlFor = `del_${uniqueName}`;
        delLabel.title = "Delete";
        delLabel.innerHTML = `<i class="fa fa-trash"></i>`;
        const linkRadio = document.createElement("input");
        linkRadio.type = "radio";
        linkRadio.name = uniqueName;
        linkRadio.value = "link";
        linkRadio.id = `link_${uniqueName}`;
        linkRadio.dataset.nullable = true;
        if (actionQueueData[data.path] === 'link') {
            linkRadio.checked = true;
            linkRadio.setAttribute('data-waschecked', 'true');
        }
        const linkLabel = document.createElement("label");
        linkLabel.htmlFor = `link_${uniqueName}`;
        linkLabel.title = "Hardlink";
        linkLabel.innerHTML = `<i class="fa fa-link"></i>`;

        const actionChangeHandler = function(e) {
            const target = e.target;
            const rowData = cell.getRow().getData();
            const { ino, path } = rowData;

            if (target.checked && target.getAttribute('data-waschecked') === 'true') {
                // Handle DESELECT action
                target.checked = false;
                target.setAttribute('data-waschecked', 'false');
                removeFileActionFromQueue(ino, path, dirtySock, actionQueueTable);
            } else {
                // Handle SELECT action
                delRadio.setAttribute('data-waschecked', 'false');
                linkRadio.setAttribute('data-waschecked', 'false');
                target.setAttribute('data-waschecked', 'true');

                // Proactively remove any existing row for this file from the queue UI to prevent duplicates
                actionQueueTable.getRows().forEach(row => {
                    if (row.getData().file === path) {
                        row.delete();
                    }
                });

                // Send the new action to the backend and add the new row to the UI
                dirtySock('setFileAction', { ino, path, action: target.value });
                actionQueueTable.addRow({ file: path, action: target.value });
            }
        };

        delRadio.addEventListener('click', actionChangeHandler);
        linkRadio.addEventListener('click', actionChangeHandler);
        container.appendChild(delRadio);
        container.appendChild(delLabel);
        container.appendChild(linkRadio);
        container.appendChild(linkLabel);
        return container;
    }
}

function createActionQueueActionFormatter() {
    return function(cell, formatterParams, onRendered) {
        const action = cell.getValue();
        const iconClass = action === 'delete' ? 'fa-trash' : 'fa-link';
        return `<i class="fa ${iconClass}" style="cursor: pointer;" title="Remove"></i>`;
    }
}
