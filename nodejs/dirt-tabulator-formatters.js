function createGroupHeader(dirtySock, actionQueueTable) {
    return function(value, count, data, group) {
        const totalSize = data.reduce((acc, row) => acc + (row.size || 0), 0);
        const groupHash = value;
        const uniqueName = "action_group_" + groupHash;

        const container = document.createElement('div');
        container.className = 'group-header-flex-container';
        container.innerHTML = `
            <div class="group-action-container">
                <input type="radio" name="${uniqueName}" value="delete" id="del_${uniqueName}">
                <label for="del_${uniqueName}" title="Delete All"><i class="fa fa-trash"></i></label>
                <input type="radio" name="${uniqueName}" value="link" id="link_${uniqueName}">
                <label for="link_${uniqueName}" title="Hardlink All"><i class="fa fa-link"></i></label>
            </div>
            <div class="group-info-container">
                <strong>Group: ${value}</strong>
                <span>(${count} files, ${formatBytes(totalSize)})</span>
            </div>
        `;

        container.querySelector(`#del_${uniqueName}`).addEventListener('click', (e) => handleGroupActionClick(e, group, dirtySock, actionQueueTable));
        container.querySelector(`#link_${uniqueName}`).addEventListener('click', (e) => handleGroupActionClick(e, group, dirtySock, actionQueueTable));

        return container;
    }
}


function createRowFormatter() {
    return function(row) {
        const element = row.getElement();
        if (row.getData().isOriginal) {
            element.classList.add('disabled-row');
        } else {
            element.classList.remove('disabled-row');
        }
    }
}

function createIsPrimaryFormatter(dirtySock, actionQueueTable) {
    return function(cell, formatterParams, onRendered) {
        const data = cell.getRow().getData();
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "primary_group_" + data.hash;
        radio.checked = data.isOriginal;
        radio.addEventListener('click', () => handleIsPrimaryClick(cell, dirtySock, actionQueueTable));
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
                <input type="radio" name="${uniqueName}" value="delete" id="del_${uniqueName}">
                <label for="del_${uniqueName}" title="Delete All"><i class="fa fa-trash"></i></label>
                <input type="radio" name="${uniqueName}" value="link" id="link_${uniqueName}">
                <label for="link_${uniqueName}" title="Hardlink All"><i class="fa fa-link"></i></label>
            </div>
        `;
        return container;
    }
}

function createActionFormatter(dirtySock, actionQueueTable) {
    return function(cell, formatterParams, onRendered) {
        const data = cell.getRow().getData();
        const uniqueName = "action_" + data.ino;
        const container = document.createElement("div");

        container.innerHTML = `
            <input type="radio" name="${uniqueName}" value="delete" id="del_${uniqueName}" ${data.queuedAction === 'delete' ? 'checked' : ''}>
            <label for="del_${uniqueName}" title="Delete"><i class="fa fa-trash"></i></label>
            <input type="radio" name="${uniqueName}" value="link" id="link_${uniqueName}" ${data.queuedAction === 'link' ? 'checked' : ''}>
            <label for="link_${uniqueName}" title="Hardlink"><i class="fa fa-link"></i></label>
        `;

        container.querySelector(`#del_${uniqueName}`).addEventListener('click', (e) => handleActionClick(e, cell, dirtySock, actionQueueTable));
        container.querySelector(`#link_${uniqueName}`).addEventListener('click', (e) => handleActionClick(e, cell, dirtySock, actionQueueTable));

        return container;
    }
}

function createActionQueueActionFormatter() {
    return function(cell, formatterParams, onRendered) {
        const action = cell.getData().queuedAction;
        const iconClass = action === 'delete' ? 'fa-trash' : 'fa-link';
        return `<i class="fa ${iconClass}" style="cursor: pointer;" title="Remove"></i>`;
    }
}
