import { WebSocket } from 'ws';
import * as os from 'os';

// 最小化终端测试 - 不使用 PTY
export function handleTerminalConnectionMinimal(ws: WebSocket, req: any) {
  console.log('[Terminal Minimal] Connection received');
  console.log('[Terminal Minimal] Ready state:', ws.readyState);

  // 从 token 获取用户信息
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    console.log('[Terminal Minimal] No token provided');
    ws.send(JSON.stringify({ type: 'error', message: 'No token' }));
    ws.close();
    return;
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    console.log('[Terminal Minimal] Token verified for user:', (decoded as any).username);
  } catch (e: any) {
    console.log('[Terminal Minimal] Token verification failed:', e.message);
    ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
    ws.close();
    return;
  }

  // 不创建 PTY，只设置基本的 WebSocket 事件处理
  console.log('[Terminal Minimal] Setting up WebSocket handlers');

  // WebSocket 消息处理
  ws.on('message', (message: Buffer) => {
    try {
      const msg = JSON.parse(message.toString());
      console.log('[Terminal Minimal] Received:', msg.type);

      switch (msg.type) {
        case 'input':
          // 回显输入
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'data',
              data: msg.data
            }));
          }
          break;

        case 'ping':
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
          break;

        default:
          console.log('[Terminal Minimal] Unknown message type:', msg.type);
      }
    } catch (e) {
      console.error('[Terminal Minimal] Message handling error:', e);
    }
  });

  // WebSocket 关闭处理
  ws.on('close', () => {
    console.log('[Terminal Minimal] WebSocket closed naturally');
  });

  // WebSocket 错误处理
  ws.on('error', (error) => {
    console.error('[Terminal Minimal] WebSocket error:', error);
  });

  // 发送欢迎消息（延迟发送，确保连接稳定）
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log('[Terminal Minimal] Sending ready message');
      ws.send(JSON.stringify({
        type: 'ready',
        sessionId: 'test_minimal',
        cwd: process.env.HOME,
        shell: '/bin/zsh',
        platform: os.platform(),
        hostname: os.hostname(),
        note: 'Minimal test - no PTY - delayed'
      }));
    } else {
      console.log('[Terminal Minimal] WebSocket closed before ready message');
    }
  }, 500);
}

// 导出原始的完整版本（暂时禁用）
export function handleTerminalConnection(ws: WebSocket, req: any) {
  handleTerminalConnectionMinimal(ws, req);
}
