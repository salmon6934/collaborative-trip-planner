import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import type { ApiError } from '@trip-planner/shared';
import authRouter from './routes/auth.js';
import tripsRouter from './routes/trips.js';
import { initializeSocketServer } from './socket/index.js';

const app = express();
const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create HTTP server (required for Socket.io to attach)
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/trips', tripsRouter);

// Initialize Socket.io with Redis adapter
const io = initializeSocketServer(httpServer, REDIS_URL);

// Start server using httpServer instead of app.listen
httpServer.listen(PORT, () => {
  console.log(`🚀 Trip Planner Server running on http://localhost:${PORT}`);
});

export { io };
export default app;
