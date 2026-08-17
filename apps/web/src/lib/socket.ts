import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.io client instance.
 * Passes the JWT token in the handshake auth for server-side authentication.
 * Auto-connect is disabled so the consumer controls when to connect.
 */
export function getSocket(token: string): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    // Update token for reconnection attempts
    socket.auth = { token };
    return socket;
  }

  socket = io(API_URL, {
    auth: { token },
    autoConnect: false,
    reconnection: false, // We handle reconnection manually with exponential backoff
    transports: ['websocket', 'polling'],
  });

  return socket;
}

/**
 * Disconnects and destroys the singleton socket instance.
 * Call this on logout or when leaving the app.
 */
export function destroySocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
