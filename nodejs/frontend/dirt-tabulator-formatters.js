
function radioSelectFormatter(cell, formatterParams) {
    const isOriginal = cell.getRow().getData().isOriginal;
    const hash = cell.getRow().getData().hash;
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
    });

    return radio;
}
