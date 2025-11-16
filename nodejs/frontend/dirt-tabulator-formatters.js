
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
