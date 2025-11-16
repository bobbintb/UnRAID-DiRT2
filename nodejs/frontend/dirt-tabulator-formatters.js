
function actionFormatter(cell, formatterParams) {
    const { hash, ino, action } = cell.getRow().getData();
    const { dirtySock } = formatterParams;
    const container = document.createElement("div");

    const trashIcon = document.createElement("i");
    trashIcon.classList.add("fas", "fa-trash");
    trashIcon.style.cursor = "pointer";
    trashIcon.style.marginRight = "10px";
    if (action === "delete") {
        trashIcon.classList.add("selected");
    }

    const linkIcon = document.createElement("i");
    linkIcon.classList.add("fas", "fa-link");
    linkIcon.style.cursor = "pointer";
    if (action === "link") {
        linkIcon.classList.add("selected");
    }

    const getAction = () => cell.getRow().getData().action;

    trashIcon.addEventListener('click', () => {
        const currentAction = getAction();
        const newAction = currentAction === "delete" ? "none" : "delete";

        // Update UI immediately
        trashIcon.classList.toggle("selected", newAction === "delete");
        linkIcon.classList.remove("selected");

        // Update Tabulator and send to backend
        cell.getRow().update({ action: newAction });
        dirtySock('setAction', { hash, ino, action: newAction });
    });

    linkIcon.addEventListener('click', () => {
        const currentAction = getAction();
        const newAction = currentAction === "link" ? "none" : "link";

        // Update UI immediately
        linkIcon.classList.toggle("selected", newAction === "link");
        trashIcon.classList.remove("selected");

        // Update Tabulator and send to backend
        cell.getRow().update({ action: newAction });
        dirtySock('setAction', { hash, ino, action: newAction });
    });

    container.appendChild(trashIcon);
    container.appendChild(linkIcon);

    return container;
}

function radioSelectFormatter(cell, formatterParams) {
    const isOriginal = cell.getRow().getData().isOriginal;
    const hash = cell.getRow().getData().hash;
    const ino = cell.getRow().getData().ino;
    const { dirtySock } = formatterParams;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "original-" + hash;
    radio.checked = isOriginal;

    radio.addEventListener('change', () => {
        const row = cell.getRow();
        const group = row.getGroup();
        if (group) {
            group.getRows().forEach(groupRow => {
                groupRow.update({isOriginal: false});
            });
        }
        row.update({isOriginal: true});

        if (dirtySock) {
            dirtySock('setOriginalFile', { hash, ino });
        }
    });

    return radio;
}
