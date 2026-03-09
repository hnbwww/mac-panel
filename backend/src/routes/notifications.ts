import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { requirePermission, AuthRequest } from '../middlewares/permission';

const router = Router();

// 获取所有通知
router.get('/', requirePermission('notifications', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = parseInt(req.query.limit as string) || 50;

    const notifications = await db.listNotifications(unreadOnly, limit);

    // 获取未读数量
    const allUnread = await db.listNotifications(true, 1000);

    res.json({
      notifications,
      unread_count: allUnread.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个通知
router.get('/:id', requirePermission('notifications', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await db.listNotifications(false, 1000);
    const notification = notifications.find(n => n.id === req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 标记通知为已读
router.put('/:id/read', requirePermission('notifications', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    await db.markNotificationAsRead(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 标记所有通知为已读
router.post('/read-all', requirePermission('notifications', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    await db.markAllNotificationsAsRead();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除通知
router.delete('/:id', requirePermission('notifications', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    // 这里需要在 database service 中添加 deleteNotification 方法
    const notifications = await db.listNotifications(false, 1000);
    const exists = notifications.find(n => n.id === req.params.id);

    if (!exists) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.deleteNotification(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 清空所有通知
router.delete('/', requirePermission('notifications', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    // 删除所有通知
    const notifications = await db.listNotifications(false, 1000);
    for (const notification of notifications) {
      await db.deleteNotification(notification.id);
    }
    res.json({ success: true, deleted: notifications.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取未读数量
router.get('/count/unread', requirePermission('notifications', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const unread = await db.listNotifications(true, 1000);
    res.json({ count: unread.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
