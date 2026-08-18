import { Server as SocketIOServer } from 'socket.io';

/**
 * Shared reference to the Socket.io server instance.
 * Set during server initialization, used by routes and services
 * to emit events without circular dependency on index.ts.
 */
let ioInstance: SocketIOServer | null = null;

export function setIoInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getIoInstance(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('Socket.io server not initialized yet');
  }
  return ioInstance;
}
