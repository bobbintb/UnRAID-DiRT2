const WebSocket = require('ws');

const port = 41820;
const wss = new WebSocket.Server({ port });

console.log(`[DIRT] WebSocket server started on port ${port}`);

wss.on('connection', ws => {
  console.log('[DIRT] Client connected.');

  ws.on('message', message => {
    try {
      const parsedMessage = JSON.parse(message);
      const { action, data, clientId } = parsedMessage;

      console.log(`[DIRT] Received action '${action}' from client '${clientId}' with data:`, data);

      switch (action) {
        case 'scan':
          // Placeholder for scan logic
          console.log(`[DIRT] Placeholder: Scan initiated for shares: ${data.join(', ')}`);
          break;
        case 'addShare':
          // Placeholder for addShare logic
          console.log(`[DIRT] Placeholder: 'addShare' action received for: ${data.join(', ')}`);
          break;
        case 'removeShare':
          // Placeholder for removeShare logic
          console.log(`[DIRT] Placeholder: 'removeShare' action received for: ${data.join(', ')}`);
          break;
        default:
          console.log(`[DIRT] Received unknown action: ${action}`);
          break;
      }
    } catch (error) {
      console.error('[DIRT] Failed to parse incoming message:', message, error);
    }
  });

  ws.on('close', () => {
    console.log('[DIRT] Client disconnected.');
  });

  ws.on('error', error => {
    console.error('[DIRT] WebSocket error:', error);
  });
});