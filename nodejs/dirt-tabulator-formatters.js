function createGroupHeader(dirtySock) {
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

        // The event listeners are now attached in the main .page file,
        // but the radios need to be wired up to call the action handler.
        container.querySelector(`#del_${uniqueName}`).addEventListener('click', (e) => handleGroupActionClick(e, group, dirtySock));
        container.querySelector(`#link_${uniqueName}`).addEventListener('click', (e) => handleGroupActionClick(e, group, dirtySock));

        return container;
    }
}


function createRowFormatter() {
    // This function now simply adds or removes a class based on the data.
    // Tabulator's reactivity will call this whenever the row's data changes.
    return function(row) {
        const element = row.getElement();
        if (row.getData().isOriginal) {
            element.classList.add('disabled-row');
        } else {
            element.classList.remove('disabled-row');
        }
    }
}

function createIsPrimaryFormatter(dirtySock) {
    // This formatter is now purely declarative. It renders based on the
    // `isOriginal` flag and has no event handling logic itself.
    return function(cell, formatterParams, onRendered) {
        const data = cell.getRow().getData();
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "primary_group_" + data.hash;
        radio.checked = data.isOriginal;
        radio.addEventListener('click', () => handleIsPrimaryClick(cell, dirtySock));
        return radio;
    }
}

function createActionTitleFormatter() {
    // This formatter remains the same as it was purely presentational.
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

function createActionFormatter(dirtySock) {
    // This formatter is now drastically simplified. It just renders the
    // radio buttons and their state based on the `queuedAction` property.
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

        container.querySelector(`#del_${uniqueName}`).addEventListener('click', (e) => handleActionClick(e, cell, dirtySock));
        container.querySelector(`#link_${uniqueName}`).addEventListener('click', (e) => handleActionClick(e, cell, dirtySock));

        return container;
    }
}

function createActionQueueActionFormatter() {
    // The value of this cell is now the queuedAction property itself.
    return function(cell, formatterParams, onRendered) {
        const action = cell.getData().queuedAction;
        const iconClass = action === 'delete' ? 'fa-trash' : 'fa-link';
        return `<i class="fa ${iconClass}" style="cursor: pointer;" title="Remove"></i>`;
    }
}
