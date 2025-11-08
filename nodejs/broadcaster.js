const { WebSocketServer } = require('ws');

let wss;
const clients = new Map();

function init(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `ws://${req.headers.host}`);
        const clientId = url.searchParams.get('clientId');

        console.log(`[BROADCASTER] Client '${clientId}' connected.`);
        clients.set(ws, clientId);

        ws.on('close', () => {
            console.log(`[BROADCASTER] Client '${clientId}' disconnected.`);
            clients.delete(ws);
        });
    });
    console.log('[BROADCASTER] Broadcaster initialized.');
}

function broadcast(message) {
    const serializedMessage = JSON.stringify(message);
    clients.forEach((id, client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(serializedMessage);
        }
    });
}

module.exports = {
    init,
    broadcast,
};
