import { WebSocket } from 'ws';

// 极简测试 - 只回显，不主动发送任何消息
export function handleTerminalConnectionEcho(ws: WebSocket, req: any) {
  console.log('[Terminal Echo] Connection received');
  console.log('[Terminal Echo] Ready state:', ws.readyState);

  // 从 token 获取用户信息
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    console.log('[Terminal Echo] No token provided');
    ws.send(JSON.stringify({ type: 'error', message: 'No token' }));
    ws.close();
    return;
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    console.log('[Terminal Echo] Token verified for user:', (decoded as any).username);
  } catch (e: any) {
    console.log('[Terminal Echo] Token verification failed:', e.message);
    ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
    ws.close();
    return;
  }

  console.log('[Terminal Echo] Authentication successful, waiting for client message...');

  // WebSocket 消息处理 - 只回显
  ws.on('message', (message: Buffer) => {
    try {
      const msg = JSON.parse(message.toString());
      console.log('[Terminal Echo] Received:', msg.type);

      switch (msg.type) {
        case 'input':
          // 回显输入
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'data',
              data: msg.data
            }), { compress: false }); // 禁用压缩
            console.log('[Terminal Echo] Echoed back:', msg.data);
          }
          break;

        case 'ping':
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }), { compress: false }); // 禁用压缩
            console.log('[Terminal Echo] Sent pong');
          }
          break;

        default:
          console.log('[Terminal Echo] Unknown message type:', msg.type);
      }
    } catch (e) {
      console.error('[Terminal Echo] Message handling error:', e);
    }
  });

  // WebSocket 关闭处理
  ws.on('close', (code, reason) => {
    console.log('[Terminal Echo] WebSocket closed');
    console.log('[Terminal Echo] Code:', code);
    console.log('[Terminal Echo] Reason:', reason?.toString() || 'none');
  });

  // WebSocket 错误处理
  ws.on('error', (error) => {
    console.error('[Terminal Echo] WebSocket error:', error);
  });

  // 【关键改动】不发送任何欢迎消息，等待客户端先发送消息
  console.log('[Terminal Echo] Setup complete, NOT sending ready message');
  console.log('[Terminal Echo] Waiting for client to send first message...');
}
