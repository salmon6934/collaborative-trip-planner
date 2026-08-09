import express from 'express';
import cors from 'cors';
import type { ApiError } from '@trip-planner/shared';
import authRouter from './routes/auth.js';
import tripsRouter from './routes/trips.js';

const app = express();
const PORT = process.env.PORT || 4000;

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Trip Planner Server running on http://localhost:${PORT}`);
});

export default app;
