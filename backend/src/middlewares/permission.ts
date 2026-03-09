import { Request, Response, NextFunction } from 'express';
import { db } from '../services/database';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
  userRole?: string;
}

// 权限检查中间件
export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await db.getUserById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ error: 'User account is disabled' });
      }

      const role = await db.getRoleById(user.role_id);
      if (!role) {
        return res.status(403).json({ error: 'Invalid user role' });
      }

      const permissions = role.permissions;

      // 检查是否有权限
      const hasPermission = permissions.some((p: string) => {
        return p === '*' ||
               p === `${resource}:${action}` ||
               p === `${resource}:*` ||
               p === '*:*';
      });

      if (!hasPermission) {
        // 记录未授权访问尝试
        await db.createLog({
          user_id: req.userId,
          username: req.username || 'unknown',
          action: 'unauthorized_access',
          resource: `${resource}:${action}`,
          details: JSON.stringify({ method: req.method, path: req.path }),
          ip: req.ip || 'unknown',
          status: 'failed'
        });

        return res.status(403).json({
          error: 'Permission denied',
          required: `${resource}:${action}`
        });
      }

      // 将用户角色添加到请求中，供后续使用
      req.userRole = role.name;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// 检查是否为管理员
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const role = await db.getRoleById(user.role_id);
    if (!role || role.name !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 可选权限检查（不抛出错误，只添加标识）
export const checkPermission = (resource: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        (req as any).hasPermission = false;
        return next();
      }

      const user = await db.getUserById(req.userId);
      if (!user) {
        (req as any).hasPermission = false;
        return next();
      }

      const role = await db.getRoleById(user.role_id);
      if (!role) {
        (req as any).hasPermission = false;
        return next();
      }

      const permissions = role.permissions;
      const hasPermission = permissions.some((p: string) => {
        return p === '*' ||
               p === `${resource}:${action}` ||
               p === `${resource}:*` ||
               p === '*:*';
      });

      (req as any).hasPermission = hasPermission;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      (req as any).hasPermission = false;
      next();
    }
  };
};
