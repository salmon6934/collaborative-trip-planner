import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

// Mock the itinerary service
vi.mock('../services/itinerary.service.js', () => ({
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  moveBlock: vi.fn(),
  deleteBlock: vi.fn(),
}));

// Mock the DB module
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

import { createBlock, updateBlock, moveBlock, deleteBlock } from '../services/itinerary.service.js';
import { db } from '../db/index.js';
import { registerBlockHandlers } from './blocks.js';

const mockedCreateBlock = vi.mocked(createBlock);
const mockedUpdateBlock = vi.mocked(updateBlock);
const mockedMoveBlock = vi.mocked(moveBlock);
const mockedDeleteBlock = vi.mocked(deleteBlock);
const mockedDb = vi.mocked(db) as any;

describe('Socket.io Block Handlers', () => {
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let port: number;
  let clientSockets: ClientSocket[] = [];

  const tripId = 'trip-test-123';
  const dayId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const blockId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const targetDayId = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  function createValidToken(userId: string = 'user-A', email: string = 'a@example.com'): string {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
  }

  function connectClient(userId: string, email: string): Promise<ClientSocket> {
    const token = createValidToken(userId, email);
    const socket = ioClient(`http://localhost:${port}`, {
      autoConnect: false,
      auth: { token },
    });
    clientSockets.push(socket);

    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(new Error(`Connection failed: ${err.message}`)));
      socket.connect();
    });
  }

  async function joinTrip(client: ClientSocket, trip: string): Promise<void> {
    client.emit('join:trip', trip);
    // Give server time to process the room join
    await new Promise((r) => setTimeout(r, 100));
  }

  beforeAll(async () => {
    const app = express();
    httpServer = createServer(app);

    // Create a simple Socket.io server with auth and block handlers (no Redis adapter)
    io = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });

    // Auth middleware (same as production)
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('AUTH_MISSING_TOKEN'));
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
        socket.data.userId = payload.userId;
        socket.data.email = payload.email;
        next();
      } catch {
        next(new Error('AUTH_INVALID_TOKEN'));
      }
    });

    io.on('connection', (socket) => {
      socket.on('join:trip', (tripId: string) => {
        if (!tripId || typeof tripId !== 'string') return;
        socket.join(`trip:${tripId}`);
        socket.data.tripId = tripId;
      });

      // Register block handlers
      registerBlockHandlers(io, socket);
    });

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
    vi.clearAllMocks();
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  describe('block:create', () => {
    it('Client A creates block → Client B receives block:created event', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      const clientB = await connectClient('user-B', 'b@example.com');

      await joinTrip(clientA, tripId);
      await joinTrip(clientB, tripId);

      const mockBlock = {
        id: blockId,
        dayId,
        tripId,
        title: 'Visit Museum',
        description: null,
        category: 'activity',
        startTime: '10:00',
        endTime: '12:00',
        locationName: 'City Museum',
        latitude: null,
        longitude: null,
        estimatedCost: null,
        currency: 'INR',
        position: 1.0,
        createdBy: 'user-A',
        updatedAt: new Date(),
      };

      mockedCreateBlock.mockResolvedValue(mockBlock as any);

      // Set up client B to listen before emitting
      const receivedPromise = new Promise<any>((resolve) => {
        clientB.on('block:created', (data) => resolve(data));
      });

      // Client A creates a block
      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit('block:create', {
          title: 'Visit Museum',
          category: 'activity',
          startTime: '10:00',
          endTime: '12:00',
          locationName: 'City Museum',
          dayId,
        }, (response: any) => resolve(response));
      });

      const [ack, received] = await Promise.all([ackPromise, receivedPromise]);

      // Check sender acknowledgement
      expect(ack.ok).toBe(true);
      expect(ack.block.id).toBe(blockId);

      // Check broadcast to client B
      expect(received.block.id).toBe(blockId);
      expect(received.block.title).toBe('Visit Museum');
      expect(received.userId).toBe('user-A');
    });

    it('should return error if not in a trip', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      // Don't join trip

      const ack = await new Promise<any>((resolve) => {
        clientA.emit('block:create', {
          title: 'Test',
          category: 'activity',
          dayId,
        }, (response: any) => resolve(response));
      });

      expect(ack.error).toBe('NOT_IN_TRIP');
    });

    it('should return validation error for invalid data', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      await joinTrip(clientA, tripId);

      const ack = await new Promise<any>((resolve) => {
        clientA.emit('block:create', {
          // Missing required fields
          title: '',
          category: 'invalid-category',
        }, (response: any) => resolve(response));
      });

      expect(ack.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('block:update', () => {
    it('Client A updates block → Client B receives block:updated event', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      const clientB = await connectClient('user-B', 'b@example.com');

      await joinTrip(clientA, tripId);
      await joinTrip(clientB, tripId);

      const mockUpdatedBlock = {
        id: blockId,
        dayId,
        tripId,
        title: 'Visit Art Museum',
        description: 'Updated description',
        category: 'activity',
        startTime: '10:00',
        endTime: '13:00',
        locationName: 'Art Museum',
        latitude: null,
        longitude: null,
        estimatedCost: 50,
        currency: 'INR',
        position: 1.0,
        createdBy: 'user-A',
        updatedAt: new Date(),
      };

      mockedUpdateBlock.mockResolvedValue(mockUpdatedBlock as any);

      // Set up client B listener before emit
      const receivedPromise = new Promise<any>((resolve) => {
        clientB.on('block:updated', (data) => resolve(data));
      });

      // Client A updates a block
      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit('block:update', {
          blockId,
          title: 'Visit Art Museum',
        }, (response: any) => resolve(response));
      });

      const [ack, received] = await Promise.all([ackPromise, receivedPromise]);

      expect(ack.ok).toBe(true);
      expect(ack.block.title).toBe('Visit Art Museum');

      expect(received.block.title).toBe('Visit Art Museum');
      expect(received.userId).toBe('user-A');
    });

    it('last-write-wins: rejects update with older timestamp', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      await joinTrip(clientA, tripId);

      const now = new Date();
      const olderTimestamp = new Date(now.getTime() - 10000); // 10 seconds ago

      // Mock DB to return a newer timestamp
      mockedDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ updatedAt: now }]),
        }),
      });

      const ack = await new Promise<any>((resolve) => {
        clientA.emit('block:update', {
          blockId,
          updatedAt: olderTimestamp.toISOString(),
          title: 'Stale update',
        }, (response: any) => resolve(response));
      });

      expect(ack.error).toBe('CONFLICT');
      expect(ack.message).toBe('A newer version exists');
    });

    it('last-write-wins: accepts update with newer timestamp', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      const clientB = await connectClient('user-B', 'b@example.com');

      await joinTrip(clientA, tripId);
      await joinTrip(clientB, tripId);

      const dbTimestamp = new Date('2024-01-01T10:00:00Z');
      const newerTimestamp = new Date('2024-01-01T10:05:00Z');

      // Mock DB for timestamp check
      mockedDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ updatedAt: dbTimestamp }]),
        }),
      });

      const mockUpdatedBlock = {
        id: blockId,
        dayId,
        tripId,
        title: 'Newer update',
        category: 'activity',
        updatedAt: newerTimestamp,
      };

      mockedUpdateBlock.mockResolvedValue(mockUpdatedBlock as any);

      const receivedPromise = new Promise<any>((resolve) => {
        clientB.on('block:updated', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit('block:update', {
          blockId,
          updatedAt: newerTimestamp.toISOString(),
          title: 'Newer update',
        }, (response: any) => resolve(response));
      });

      const [ack, received] = await Promise.all([ackPromise, receivedPromise]);

      expect(ack.ok).toBe(true);
      expect(received.block.title).toBe('Newer update');
    });
  });

  describe('block:move', () => {
    it('Client A moves block → Client B receives block:moved event', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      const clientB = await connectClient('user-B', 'b@example.com');

      await joinTrip(clientA, tripId);
      await joinTrip(clientB, tripId);

      const mockMovedBlock = {
        id: blockId,
        dayId: targetDayId,
        tripId,
        title: 'Visit Museum',
        category: 'activity',
        position: 2.0,
        updatedAt: new Date(),
      };

      mockedMoveBlock.mockResolvedValue(mockMovedBlock as any);

      const receivedPromise = new Promise<any>((resolve) => {
        clientB.on('block:moved', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit('block:move', {
          blockId,
          targetDayId,
          targetPosition: 2,
        }, (response: any) => resolve(response));
      });

      const [ack, received] = await Promise.all([ackPromise, receivedPromise]);

      expect(ack.ok).toBe(true);
      expect(ack.block.dayId).toBe(targetDayId);
      expect(ack.block.position).toBe(2.0);

      expect(received.block.id).toBe(blockId);
      expect(received.block.dayId).toBe(targetDayId);
      expect(received.userId).toBe('user-A');
    });

    it('should return error for invalid move data', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      await joinTrip(clientA, tripId);

      const ack = await new Promise<any>((resolve) => {
        clientA.emit('block:move', {
          // Missing required fields / invalid UUID
          blockId: 'not-a-uuid',
          targetDayId: 'not-a-uuid',
          targetPosition: -1,
        }, (response: any) => resolve(response));
      });

      expect(ack.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('block:delete', () => {
    it('Client A deletes block → Client B receives block:deleted event', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      const clientB = await connectClient('user-B', 'b@example.com');

      await joinTrip(clientA, tripId);
      await joinTrip(clientB, tripId);

      const mockDeletedBlock = {
        id: blockId,
        dayId,
        tripId,
        title: 'Visit Museum',
        category: 'activity',
      };

      mockedDeleteBlock.mockResolvedValue(mockDeletedBlock as any);

      const receivedPromise = new Promise<any>((resolve) => {
        clientB.on('block:deleted', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit('block:delete', {
          blockId,
        }, (response: any) => resolve(response));
      });

      const [ack, received] = await Promise.all([ackPromise, receivedPromise]);

      expect(ack.ok).toBe(true);
      expect(ack.block.id).toBe(blockId);

      expect(received.blockId).toBe(blockId);
      expect(received.userId).toBe('user-A');
    });

    it('should return error when block not found', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      await joinTrip(clientA, tripId);

      mockedDeleteBlock.mockResolvedValue(null);

      const ack = await new Promise<any>((resolve) => {
        clientA.emit('block:delete', {
          blockId: 'nonexistent-block',
        }, (response: any) => resolve(response));
      });

      expect(ack.error).toBe('BLOCK_NOT_FOUND');
    });

    it('should return error for missing blockId', async () => {
      const clientA = await connectClient('user-A', 'a@example.com');
      await joinTrip(clientA, tripId);

      const ack = await new Promise<any>((resolve) => {
        clientA.emit('block:delete', {}, (response: any) => resolve(response));
      });

      expect(ack.error).toBe('VALIDATION_ERROR');
    });
  });
});
