import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notification.service.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * GET /api/notifications
 * Returns paginated notifications for the authenticated user.
 * Query params: limit (default 20), offset (default 0)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const notifs = await getUserNotifications(userId, limit, offset);
    res.status(200).json({ notifications: notifs });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Returns the count of unread notifications for the authenticated user.
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const count = await getUnreadCount(userId);
    res.status(200).json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Marks a single notification as read.
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const notificationId = req.params.id as string;

    const notification = await markAsRead(notificationId, userId);
    if (!notification) {
      res.status(404).json({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
      return;
    }

    res.status(200).json({ notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * PUT /api/notifications/read-all
 * Marks all notifications as read for the authenticated user.
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    await markAllAsRead(userId);
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});

export default router;
