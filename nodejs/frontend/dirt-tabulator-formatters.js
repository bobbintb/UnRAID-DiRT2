
function radioSelectFormatter(cell, formatterParams) {
    const isOriginal = cell.getRow().getData().isOriginal;
    const hash = cell.getRow().getData().hash;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "original-" + hash;
    radio.checked = isOriginal;

    radio.addEventListener('change', () => {
        const row = cell.getRow();
        const table = row.getTable();

        table.getRows().forEach(tableRow => {
            if (tableRow !== row) {
                tableRow.update({isOriginal: false});
            }
        });

        row.update({isOriginal: true});
    });

    return radio;
}
