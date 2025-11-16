<link href="https://unpkg.com/tabulator-tables@6.3.1/dist/css/tabulator.min.css" rel="stylesheet">
<link href="/plugins/bobbintb.system.dirt/nodejs/frontend/css/dirt-tabulator.css" rel="stylesheet">
<script type="text/javascript" src="https://unpkg.com/tabulator-tables@6.3.1/dist/js/tabulator.min.js"></script>
<script src="/plugins/bobbintb.system.dirt/nodejs/frontend/dirt-tabulator-formatters.js"></script>
<script src="/plugins/bobbintb.system.dirt/nodejs/frontend/dirt-tabulator-helpers.js"></script>
<script src="/plugins/bobbintb.system.dirt/nodejs/frontend/left-table.js"></script>
<script src="/plugins/bobbintb.system.dirt/nodejs/frontend/right-table.js"></script>
<script src="https://unpkg.com/split.js/dist/split.min.js"></script>

<div class="table-container">
    <div id="left-table" class="table-wrapper"></div>
    <div id="right-table" class="table-wrapper"></div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    let socket;

    Split(['#left-table', '#right-table'], {
        sizes: [70, 30],
        gutterSize: 8,
        cursor: 'col-resize'
    });

    const leftTable = new Tabulator("#left-table", generateLeftTableConfig(dirtySock));
    const rightTable = new Tabulator("#right-table", generateRightTableConfig(dirtySock, leftTable));

    rightTable.setFilter(function(data){
        return data.action === "link" || data.action === "delete";
    });

    rightTable.on("dataChanged", () => {
        rightTable.refreshFilter();
    });

    function connect() {
        socket = new WebSocket(`ws://${window.location.hostname}:41820?clientId=dirt-tables.page`);

        socket.onopen = function() {
            console.log("Tabulator Tab: WebSocket connection established.");
            dirtySock('findDuplicates', null);
        };

        socket.onmessage = function(event) {
            const parsedMessage = JSON.parse(event.data);
            const { action, data } = parsedMessage;

            if (action === 'duplicateFiles') {
                console.log("Tabulator Tab: Received duplicateFiles data package.");
                const { duplicates } = data;
                const { leftTableData, rightTableData } = processDuplicateFiles(duplicates);
                rightTable.setData(rightTableData);
                leftTable.setData(leftTableData);
            } else if (action === 'addOrUpdateFile') {
                console.log(`Tabulator Tab: Received addOrUpdateFile for ino ${data.ino}`);
                rightTable.updateOrAddData([data]);
                const subTable = findSubTableByHash(data.hash);
                if (subTable) {
                    subTable.updateOrAddData([data]);
                }
            } else if (action === 'removeFile') {
                console.log(`Tabulator Tab: Received removeFile for ino ${data.ino}`);
                rightTable.deleteRow(data.ino);
                const subTable = findSubTableByHash(data.hash);
                if (subTable) {
                    subTable.deleteRow(data.ino);
                }
            }

        };

        function findSubTableByHash(hash) {
            const row = leftTable.getRow(hash);
            if (row) {
                const rowEl = row.getElement();
                const subTableEl = rowEl.querySelector(".tabulator-table");
                if (subTableEl) {
                    const table = Tabulator.findTable(subTableEl);
                    return table ? table[0] : null;
                }
            }
            return null;
        }

        socket.onclose = function(event) {
            console.log("Tabulator Tab: WebSocket connection closed. Reconnecting...");
            setTimeout(connect, 1000);
        };

        socket.onerror = function(error) {
            console.error("Tabulator Tab: WebSocket error: ", error);
            socket.close();
        };
    }

    function dirtySock(action, data) {
        const message = {
            clientId: "dirt-tables.page",
            action: action,
            data: data
        };
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        } else {
            console.error("Tabulator Tab: WebSocket is not connected.");
        }
    }

    connect();
});
</script>
