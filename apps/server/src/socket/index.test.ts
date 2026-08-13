import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';
import { initializeSocketServer } from './index.js';

describe('Socket.io Server', () => {
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let port: number;
  let clientSockets: ClientSocket[] = [];

  function createValidToken(userId: string = 'user-123', email: string = 'test@example.com'): string {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
  }

  function createExpiredToken(): string {
    return jwt.sign({ userId: 'user-123', email: 'test@example.com' }, JWT_SECRET, { expiresIn: '-1s' });
  }

  function connectClient(token?: string): ClientSocket {
    const socket = ioClient(`http://localhost:${port}`, {
      autoConnect: false,
      auth: token ? { token } : undefined,
    });
    clientSockets.push(socket);
    return socket;
  }

  beforeAll(async () => {
    const app = express();
    httpServer = createServer(app);
    io = initializeSocketServer(httpServer, 'redis://localhost:6379');
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        port = typeof address === 'object' && address ? address.port : 0;
        resolve();
      });
    });
  });

  afterEach(() => {
    for (const socket of clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    clientSockets = [];
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe('Authentication', () => {
    it('should accept connection with valid JWT token', async () => {
      const token = createValidToken();
      const client = connectClient(token);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          expect(client.connected).toBe(true);
          resolve();
        });

        client.on('connect_error', (err) => {
          reject(new Error(`Should not have received error: ${err.message}`));
        });

        client.connect();
      });
    });

    it('should reject connection without a token', async () => {
      const client = connectClient();

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          reject(new Error('Should not have connected'));
        });

        client.on('connect_error', (err) => {
          expect(err.message).toBe('AUTH_MISSING_TOKEN');
          resolve();
        });

        client.connect();
      });
    });

    it('should reject connection with invalid token', async () => {
      const client = connectClient('invalid-token-value');

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          reject(new Error('Should not have connected'));
        });

        client.on('connect_error', (err) => {
          expect(err.message).toBe('AUTH_INVALID_TOKEN');
          resolve();
        });

        client.connect();
      });
    });

    it('should reject connection with expired token', async () => {
      const token = createExpiredToken();
      const client = connectClient(token);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          reject(new Error('Should not have connected'));
        });

        client.on('connect_error', (err) => {
          expect(err.message).toBe('AUTH_SESSION_EXPIRED');
          resolve();
        });

        client.connect();
      });
    });
  });

  describe('Room Management', () => {
    it('should join a trip room when client emits join:trip', async () => {
      const token = createValidToken();
      const client = connectClient(token);
      const tripId = 'trip-abc-123';

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          client.emit('join:trip', tripId);

          setTimeout(() => {
            const rooms = io.sockets.adapter.rooms.get(`trip:${tripId}`);
            expect(rooms).toBeDefined();
            expect(rooms!.size).toBeGreaterThanOrEqual(1);
            resolve();
          }, 50);
        });

        client.on('connect_error', (err) => {
          reject(new Error(`Connection failed: ${err.message}`));
        });

        client.connect();
      });
    });

    it('should leave room on disconnect', async () => {
      const token = createValidToken();
      const client = connectClient(token);
      const tripId = 'trip-disconnect-test';

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          client.emit('join:trip', tripId);

          setTimeout(() => {
            const roomsBefore = io.sockets.adapter.rooms.get(`trip:${tripId}`);
            expect(roomsBefore).toBeDefined();
            expect(roomsBefore!.size).toBe(1);

            // Listen for server-side disconnect before asserting
            const serverSockets = io.sockets.sockets;
            const socketId = Array.from(serverSockets.keys()).find((id) => {
              const s = serverSockets.get(id);
              return s?.data.tripId === tripId;
            });

            if (socketId) {
              const serverSocket = serverSockets.get(socketId)!;
              serverSocket.on('disconnect', () => {
                // After server processes disconnect, room should be empty
                setTimeout(() => {
                  const roomsAfter = io.sockets.adapter.rooms.get(`trip:${tripId}`);
                  expect(!roomsAfter || roomsAfter.size === 0).toBe(true);
                  resolve();
                }, 20);
              });
            }

            client.disconnect();
          }, 50);
        });

        client.on('connect_error', (err) => {
          reject(new Error(`Connection failed: ${err.message}`));
        });

        client.connect();
      });
    });

    it('should handle multiple clients joining the same room', async () => {
      const tripId = 'trip-multi-join';
      const token1 = createValidToken('user-1', 'user1@example.com');
      const token2 = createValidToken('user-2', 'user2@example.com');
      const client1 = connectClient(token1);
      const client2 = connectClient(token2);

      // Connect first client and join room
      await new Promise<void>((resolve, reject) => {
        client1.on('connect', () => resolve());
        client1.on('connect_error', (err) => reject(new Error(`Client1 failed: ${err.message}`)));
        client1.connect();
      });
      client1.emit('join:trip', tripId);
      await new Promise((r) => setTimeout(r, 50));

      // Verify first client joined
      let rooms = io.sockets.adapter.rooms.get(`trip:${tripId}`);
      expect(rooms).toBeDefined();
      expect(rooms!.size).toBe(1);

      // Connect second client and join room
      await new Promise<void>((resolve, reject) => {
        client2.on('connect', () => resolve());
        client2.on('connect_error', (err) => reject(new Error(`Client2 failed: ${err.message}`)));
        client2.connect();
      });
      client2.emit('join:trip', tripId);
      await new Promise((r) => setTimeout(r, 50));

      // Verify both clients in room
      rooms = io.sockets.adapter.rooms.get(`trip:${tripId}`);
      expect(rooms).toBeDefined();
      expect(rooms!.size).toBe(2);
    });

    it('should ignore join:trip with invalid tripId', async () => {
      const token = createValidToken();
      const client = connectClient(token);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          // Emit with empty string - should be ignored
          client.emit('join:trip', '');
          // Emit with non-string - should be ignored
          client.emit('join:trip', null);

          setTimeout(() => {
            const allRooms = Array.from(io.sockets.adapter.rooms.keys());
            const tripRooms = allRooms.filter((r) => r.startsWith('trip:'));
            expect(tripRooms.length).toBe(0);
            resolve();
          }, 50);
        });

        client.on('connect_error', (err) => {
          reject(new Error(`Connection failed: ${err.message}`));
        });

        client.connect();
      });
    });
  });
});
