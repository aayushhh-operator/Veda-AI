import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { WSMessage } from '@vedaai/shared';
import { isOriginAllowed } from '../middleware/cors';

// assignmentId -> set of connected WebSocket clients
const clients = new Map<string, Set<WebSocket>>();

/**
 * Register a WebSocket client for a specific assignment
 */
function registerClient(assignmentId: string, ws: WebSocket): void {
  if (!clients.has(assignmentId)) {
    clients.set(assignmentId, new Set());
  }
  clients.get(assignmentId)!.add(ws);
  console.log(
    `🔌 WebSocket client registered for assignment ${assignmentId} (${clients.get(assignmentId)!.size} total)`,
  );
}

/**
 * Broadcast a message to all clients subscribed to a given assignment
 */
export function broadcast(assignmentId: string, message: WSMessage): void {
  const sockets = clients.get(assignmentId);
  if (!sockets || sockets.size === 0) {
    return;
  }

  const data = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/**
 * Remove a WebSocket client from all assignment subscriptions
 */
function cleanup(ws: WebSocket): void {
  for (const [assignmentId, sockets] of clients.entries()) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      clients.delete(assignmentId);
    }
  }
}

/**
 * Attach a WebSocket server to the existing HTTP server.
 * Clients connect with ?assignmentId=xxx to subscribe to job updates.
 */
export function initWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const origin = req.headers.origin;

    if (!isOriginAllowed(origin)) {
      ws.close(4003, 'Origin not allowed by CORS');
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const assignmentId = url.searchParams.get('assignmentId');

    if (!assignmentId) {
      ws.close(4000, 'Missing assignmentId query parameter');
      return;
    }

    registerClient(assignmentId, ws);

    ws.on('close', () => {
      cleanup(ws);
      console.log(`🔌 WebSocket client disconnected for assignment ${assignmentId}`);
    });

    ws.on('error', (err: Error) => {
      console.error(`❌ WebSocket error for assignment ${assignmentId}:`, err.message);
      cleanup(ws);
    });
  });

  wss.on('error', (err: Error) => {
    console.error('❌ WebSocket server error:', err.message);
  });

  console.log('🔌 WebSocket server attached');
}
