import { Request, Response, NextFunction } from 'express';
import { db } from '../services/database';
import { AuthRequest } from './permission';

// 需要记录日志的路由
const LOGGED_ROUTES = [
  { path: '/api/files', methods: ['POST', 'PUT', 'DELETE'] },
  { path: '/api/websites', methods: ['POST', 'PUT', 'DELETE'] },
  { path: '/api/database', methods: ['POST', 'PUT', 'DELETE'] },
  { path: '/api/users', methods: ['POST', 'PUT', 'DELETE'] },
  { path: '/api/tasks', methods: ['POST', 'PUT', 'DELETE'] },
];

// 不需要记录日志的路由
const EXCLUDED_ROUTES = [
  '/api/auth/login',
  '/api/auth/verify',
  '/api/system/info',
  '/api/system/processes',
  '/health',
];

// 审计日志中间件
export const auditLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // 检查是否需要记录日志
  const shouldLog = shouldLogRequest(req);

  if (!shouldLog) {
    return next();
  }

  // 记录原始的 res.send 和 res.json
  const originalSend = res.send;
  const originalJson = res.json;

  let responseData: any;

  // 拦截响应
  res.send = function(data) {
    responseData = data;
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    responseData = data;
    return originalJson.call(this, data);
  };

  // 监听响应完成事件
  res.on('finish', async () => {
    const status = res.statusCode;
    const success = status >= 200 && status < 400;

    try {
      await db.createLog({
        user_id: req.userId || 'anonymous',
        username: req.username || 'anonymous',
        action: req.method,
        resource: req.path,
        details: JSON.stringify({
          body: sanitizeBody(req.body),
          query: req.query,
          params: req.params,
          response: success ? sanitizeResponse(responseData) : undefined
        }),
        ip: getClientIP(req),
        status: success ? 'success' : 'failed'
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  });

  next();
};

// 判断是否需要记录日志
function shouldLogRequest(req: Request): boolean {
  // 检查排除列表
  if (EXCLUDED_ROUTES.some(route => req.path.startsWith(route))) {
    return false;
  }

  // 检查是否在记录列表中
  return LOGGED_ROUTES.some(route =>
    req.path.startsWith(route.path) &&
    route.methods.includes(req.method)
  );
}

// 清理请求体（移除敏感信息）
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'key', 'api_key'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

// 清理响应数据（移除敏感信息）
function sanitizeResponse(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'key', 'api_key'];
  const sanitized = Array.isArray(data) ? data : { ...data };

  function sanitize(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.includes(key)) {
          result[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          result[key] = sanitize(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    return obj;
  }

  return sanitize(sanitized);
}

// 获取客户端 IP
function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] as string ||
         req.socket.remoteAddress ||
         'unknown';
}

// 手动记录日志的辅助函数
export const logOperation = async (
  userId: string,
  username: string,
  action: string,
  resource: string,
  details: any,
  ip: string,
  status: 'success' | 'failed'
) => {
  try {
    await db.createLog({
      user_id: userId,
      username,
      action,
      resource,
      details: JSON.stringify(details),
      ip,
      status
    });
  } catch (error) {
    console.error('Failed to create manual log:', error);
  }
};
