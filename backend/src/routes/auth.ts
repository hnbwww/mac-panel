import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middlewares/auth';
import { db } from '../services/database';
import { AuthRequest } from '../middlewares/permission';
import { logOperation } from '../middlewares/auditLog';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user in database
    const user = await db.getUserByUsername(username);

    if (!user) {
      // 记录登录失败
      await logOperation(
        'anonymous',
        username,
        'login',
        '/api/auth/login',
        { reason: 'user_not_found' },
        getClientIP(req),
        'failed'
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is active
    if (user.status !== 'active') {
      await logOperation(
        user.id,
        username,
        'login',
        '/api/auth/login',
        { reason: 'account_disabled' },
        getClientIP(req),
        'failed'
      );
      return res.status(403).json({ error: 'Account is disabled' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // 记录登录失败
      await logOperation(
        user.id,
        username,
        'login',
        '/api/auth/login',
        { reason: 'invalid_password' },
        getClientIP(req),
        'failed'
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user role
    const role = await db.getRoleById(user.role_id);

    // Generate token
    const token = generateToken(user.id, user.username);

    // 记录登录成功
    await logOperation(
      user.id,
      username,
      'login',
      '/api/auth/login',
      { role: role?.name },
      getClientIP(req),
      'success'
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: role?.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
router.get('/verify', async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

    // Get full user info
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const role = await db.getRoleById(user.role_id);

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: role?.name,
        permissions: role?.permissions || []
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user info
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const role = await db.getRoleById(user.role_id);

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: role?.name,
      permissions: role?.permissions || [],
      created_at: user.created_at
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Change password
router.post('/change-password', async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid old password' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.updateUser(user.id, { password_hash: newPasswordHash });

    // Log the operation
    await logOperation(
      user.id,
      user.username,
      'change_password',
      '/api/auth/change-password',
      {},
      getClientIP(req),
      'success'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] as string ||
         req.socket.remoteAddress ||
         'unknown';
}

export default router;
