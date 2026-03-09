import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../services/database';
import { AuthRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/permission';
import { logOperation } from '../middlewares/auditLog';

const router = Router();

// Get all users
router.get('/', requirePermission('users', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.listUsers();
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const role = await db.getRoleById(user.role_id);
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: role?.name || 'Unknown',
          role_id: user.role_id,
          status: user.status,
          created_at: user.created_at,
          updated_at: user.updated_at
        };
      })
    );
    res.json(usersWithRoles);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get single user
router.get('/:id', requirePermission('users', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const role = await db.getRoleById(user.role_id);

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: role?.name || 'Unknown',
      role_id: user.role_id,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create user
router.post('/', requirePermission('users', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, role_id } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if username already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.createUser({
      username,
      password_hash,
      email,
      role_id: role_id || 'role_user',
      status: 'active'
    });

    // Log operation
    await logOperation(
      req.userId!,
      req.username!,
      'create_user',
      '/api/users',
      { targetUser: username, role: role_id },
      getClientIP(req),
      'success'
    );

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role_id: newUser.role_id,
      status: newUser.status,
      created_at: newUser.created_at
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', requirePermission('users', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, role_id, status } = req.body;
    const userId = req.params.id;

    // Check if user exists
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent updating own role or status
    if (userId === req.userId) {
      if (role_id && role_id !== user.role_id) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }
      if (status && status !== user.status) {
        return res.status(400).json({ error: 'Cannot change your own status' });
      }
    }

    // Build updates object
    const updates: any = {};
    if (email !== undefined) updates.email = email;
    if (role_id !== undefined) updates.role_id = role_id;
    if (status !== undefined) updates.status = status;
    updates.updated_at = new Date().toISOString();

    await db.updateUser(userId, updates);

    // Log operation
    await logOperation(
      req.userId!,
      req.username!,
      'update_user',
      `/api/users/${userId}`,
      { targetUser: user.username, updates },
      getClientIP(req),
      'success'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', requirePermission('users', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting yourself
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await db.deleteUser(userId);

    // Log operation
    await logOperation(
      req.userId!,
      req.username!,
      'delete_user',
      `/api/users/${userId}`,
      { targetUser: user.username },
      getClientIP(req),
      'success'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user password
router.post('/:id/reset-password', requirePermission('users', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.updateUser(userId, { password_hash, updated_at: new Date().toISOString() });

    // Log operation
    await logOperation(
      req.userId!,
      req.username!,
      'reset_password',
      `/api/users/${userId}/reset-password`,
      { targetUser: user.username },
      getClientIP(req),
      'success'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get all roles
router.get('/roles/all', async (req: AuthRequest, res: Response) => {
  try {
    const roles = await db.listRoles();
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

// Mark welcome wizard as completed
router.post('/welcome-completed', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db.updateUser(req.userId, {
      welcome_completed: true,
      updated_at: new Date().toISOString()
    });

    // Log operation
    await logOperation(
      req.userId!,
      req.username!,
      'welcome_completed',
      '/api/users/welcome-completed',
      {},
      getClientIP(req),
      'success'
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark welcome completed error:', error);
    res.status(500).json({ error: 'Failed to mark welcome as completed' });
  }
});

// Get welcome completion status
router.get('/welcome-status', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await db.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ welcome_completed: user.welcome_completed || false });
  } catch (error) {
    console.error('Get welcome status error:', error);
    res.status(500).json({ error: 'Failed to get welcome status' });
  }
});

function getClientIP(req: AuthRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] as string ||
         req.socket.remoteAddress ||
         'unknown';
}

export default router;
