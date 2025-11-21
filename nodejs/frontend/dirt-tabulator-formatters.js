
function pathFormatter(cell, formatterParams) {
    const data = cell.getRow().getData();

    // Level 2 Group Row
    if (data.type === 'group') {
        return data.path; // Text: "Inode X (N files)"
    }

    // Level 3 File or Level 2 File
    // Show link icon for hardlinks (nlink > 1), but simple text for others
    if (data.nlink > 1) {
        return `<i class="fa fa-link" style="transform: rotate(45deg); margin-right: 5px;"></i>${data.path}`;
    }
    return data.path;
}

function actionFormatter(cell, formatterParams) {
    const data = cell.getRow().getData();

    // Hide actions for Group rows
    if (data.type === 'group') return "";

    const { path, action } = data;
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
        // Use DOM check for original status to be safe
        const rowEl = cell.getRow().getElement();
        const radio = rowEl.querySelector('input[type="radio"]');
        if (radio && radio.checked) return; // Cannot delete original

        const currentAction = getAction();
        const newAction = currentAction === "delete" ? null : "delete";

        trashIcon.classList.toggle("selected", newAction === "delete");
        linkIcon.classList.remove("selected");

        cell.getRow().update({ action: newAction }).then(() => {
            checkAndUpdateMasterRow(cell.getTable());
        });
        dirtySock('setAction', { path, action: newAction });
    });

    linkIcon.addEventListener('click', () => {
        const rowEl = cell.getRow().getElement();
        const radio = rowEl.querySelector('input[type="radio"]');
        if (radio && radio.checked) return;

        const currentAction = getAction();
        const newAction = currentAction === "link" ? null : "link";

        linkIcon.classList.toggle("selected", newAction === "link");
        trashIcon.classList.remove("selected");

        cell.getRow().update({ action: newAction }).then(() => {
            checkAndUpdateMasterRow(cell.getTable());
        });
        dirtySock('setAction', { path, action: newAction });
    });

    container.appendChild(trashIcon);
    container.appendChild(linkIcon);

    return container;
}

function radioSelectFormatter(cell, formatterParams, onRendered) {
    const data = cell.getRow().getData();

    // Hide radio for Group rows
    if (data.type === 'group') return "";

    const { isOriginal, hash } = data;
    const { dirtySock } = formatterParams;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "original-" + hash; // Shared name across Level 2 and Level 3 for this group
    radio.checked = isOriginal;
    radio.style.cursor = "pointer";

    const rowEl = cell.getRow().getElement();

    // Helper to update row styling
    function updateRowStyle() {
        if (radio.checked) {
            rowEl.classList.add('original-row');
        } else {
            rowEl.classList.remove('original-row');
        }
    }

    // Initial style
    onRendered(() => {
        updateRowStyle();
    });

    radio.addEventListener('change', () => {
        // 1. Update Backend
        const selectedRow = cell.getRow();
        const { hash, path } = selectedRow.getData();

        if (dirtySock) {
            dirtySock('setOriginalFile', { hash, path });
        }

        // 2. Update Local Data for THIS row (to prevent revert on redraw)
        selectedRow.update({ isOriginal: true, action: null });

        // 3. Clear actions visually on this row
        const icons = rowEl.querySelectorAll('.fa-trash.selected, .fa-link.selected');
        icons.forEach(icon => icon.classList.remove('selected'));

        // 4. Trigger Style Update for ALL rows in this group (Level 2 and Level 3)
        // Since we don't have easy access to other tables, we rely on the 'change' event
        // propagating or we assume the browser handled the checkbox state.
        // But we need to update the 'original-row' class on other rows.

        // We can find all rows with the same radio name and update their classes.
        const allRadios = document.querySelectorAll(`input[name="original-${hash}"]`);
        allRadios.forEach(r => {
            const rRow = r.closest('.tabulator-row');
            if (rRow) {
                if (r.checked) {
                    rRow.classList.add('original-row');
                } else {
                    rRow.classList.remove('original-row');
                    // Note: We strictly should update data here too (isOriginal: false),
                    // but as discussed, we rely on renderVertical:basic + browser state for now.
                }
            }
        });

        // 5. Update Master Row Color
        checkAndUpdateMasterRow(cell.getTable());
    });

    return radio;
}
