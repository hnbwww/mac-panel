import { WebSocket } from 'ws';

// 完全静默测试 - 不发送任何消息
export function handleTerminalConnectionNoop(ws: WebSocket, req: any) {
  console.log('[Terminal Noop] Connection received');

  // 从 token 获取用户信息
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    console.log('[Terminal Noop] No token provided');
    ws.close();
    return;
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    console.log('[Terminal Noop] Token verified for user:', (decoded as any).username);
  } catch (e: any) {
    console.log('[Terminal Noop] Token verification failed:', e.message);
    ws.close();
    return;
  }

  console.log('[Terminal Noop] Authenticated, keeping connection open...');

  // 不发送任何消息，不回显，保持连接打开
  ws.on('message', (message: Buffer) => {
    console.log('[Terminal Noop] Received message, ignoring');
    // 完全忽略，不回复
  });

  ws.on('close', (code, reason) => {
    console.log('[Terminal Noop] WebSocket closed');
    console.log('[Terminal Noop] Code:', code);
    console.log('[Terminal Noop] Reason:', reason?.toString() || 'none');
  });

  ws.on('error', (error) => {
    console.error('[Terminal Noop] WebSocket error:', error);
    // 不要调用 ws.close()，让错误自然处理
  });

  // 关键：不发送任何消息
  console.log('[Terminal Noop] Setup complete, connection should stay open');
}
