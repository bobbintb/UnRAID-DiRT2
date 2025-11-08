// broadcaster.js
let wss;

function init(webSocketServer) {
  wss = webSocketServer;
  console.log('[BROADCASTER] Broadcaster initialized.');
}

function broadcast(message) {
  if (!wss) {
    console.error('[BROADCASTER] Broadcaster not initialized. Cannot send message.');
    return;
  }

  const jsonMessage = JSON.stringify(message);

  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      client.send(jsonMessage);
    }
  });
}

module.exports = {
  init,
  broadcast,
};
