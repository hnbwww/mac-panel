import { WebSocket, WebSocketServer } from 'ws';
import * as os from 'os';
import * as pty from 'node-pty-prebuilt-multiarch';

interface TerminalSession {
  id: string;
  pty?: pty.IPty;
  ws: WebSocket;
  cwd: string;
  shell: string;
  userId?: string;
  username?: string;
}

class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  // 创建新终端会话（简化版 - 不创建 PTY）
  createSessionNoPTY(
    ws: WebSocket,
    options: {
      sessionId?: string;
      cwd?: string;
      shell?: string;
      userId?: string;
      username?: string;
      cols?: number;
      rows?: number;
    } = {}
  ): string {
    const sessionId = options.sessionId || this.generateSessionId();
    const cwd = options.cwd || process.env.HOME || process.env.USERPROFILE || os.homedir();
    const shell = options.shell || '/bin/zsh';

    console.log(`[Terminal] Creating NO-PTY session: ${sessionId}`);

    // 不创建 PTY，只记录会话
    const session: TerminalSession = {
      id: sessionId,
      ws,
      cwd,
      shell,
      userId: options.userId,
      username: options.username
    };

    this.sessions.set(sessionId, session);

    // 记录用户会话
    if (options.userId) {
      if (!this.userSessions.has(options.userId)) {
        this.userSessions.set(options.userId, new Set());
      }
      this.userSessions.get(options.userId)!.add(sessionId);
    }

    this.setupSessionHandlersNoPTY(session);

    return sessionId;
  }

  // 设置会话事件处理（简化版 - 不使用 PTY）
  private setupSessionHandlersNoPTY(session: TerminalSession): void {
    const { ws, id, userId, username } = session;

    console.log(`[Terminal] Setting up NO-PTY handlers for session: ${id}`);

    // WebSocket 消息处理（简化版）
    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());
        console.log(`[Terminal] Received message type: ${msg.type} for session ${id}`);

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
            console.log(`[Terminal] Unknown message type: ${msg.type}`);
        }
      } catch (e) {
        console.error(`[Terminal] Error handling message:`, e);
      }
    });

    // WebSocket 关闭处理
    ws.on('close', () => {
      console.log(`[Terminal] WebSocket closed for session ${id}`);
      this.removeSession(id);
    });

    // WebSocket 错误处理
    ws.on('error', (error) => {
      console.error(`[Terminal] WebSocket error for session ${id}:`, error);
    });

    // 发送欢迎消息（延迟）
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ready',
          sessionId: id,
          cwd: session.cwd,
          shell: session.shell,
          platform: os.platform(),
          hostname: os.hostname(),
          note: 'PTY disabled for testing'
        }));
        console.log(`[Terminal] Ready message sent for session: ${id}`);
      } else {
        console.log(`[Terminal] WebSocket closed before ready message for session: ${id}`);
      }
    }, 100);
  }

  // 移除会话
  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // 从用户会话中移除
      if (session.userId) {
        const userSessions = this.userSessions.get(session.userId);
        if (userSessions) {
          userSessions.delete(sessionId);
          if (userSessions.size === 0) {
            this.userSessions.delete(session.userId);
          }
        }
      }

      // 清理会话
      this.sessions.delete(sessionId);
      console.log(`[Terminal] Session removed: ${sessionId}`);
    }
  }

  // 生成会话 ID
  private generateSessionId(): string {
    return `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 创建测试服务实例
export const terminalTestService = new TerminalService();

// WebSocket 处理函数（简化版 - 不使用 PTY）
export function handleTerminalConnectionNoPTY(ws: WebSocket, req: any) {
  try {
    console.log('[Terminal WS] Connection received');

    // 从 token 获取用户信息
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      console.log('[Terminal WS] No token provided');
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: '未提供认证令牌'
        }));
      }
      ws.close();
      return;
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

      console.log(`[Terminal WS] Token verified for user: ${(decoded as any).username}`);

      // 创建无 PTY 的终端会话（仅测试 WebSocket）
      const sessionId = terminalTestService.createSessionNoPTY(ws, {
        userId: (decoded as any).userId,
        username: (decoded as any).username,
        cols: 80,
        rows: 24
      });

      if (!sessionId) {
        console.log('[Terminal WS] Session creation failed');
        ws.close();
        return;
      }

      console.log(`[Terminal WS] Session created: ${sessionId} (NO PTY mode)`);
    } catch (e: any) {
      console.error('[Terminal WS] Token verification failed:', e);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `认证失败: ${e.message}`
        }));
      }
      ws.close();
    }
  } catch (error: any) {
    console.error('[Terminal WS] Connection error:', error);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `连接错误: ${error.message}`
      }));
    }
    ws.close();
  }
}
