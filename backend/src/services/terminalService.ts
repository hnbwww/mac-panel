import { WebSocket, WebSocketServer } from 'ws';
import * as os from 'os';
import * as pty from 'node-pty-prebuilt-multiarch';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { terminalLogger } from './terminalLogger';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface TerminalSession {
  id: string;
  pty: pty.IPty;
  ws: WebSocket;
  cwd: string;
  shell: string;
  userId?: string;
  username?: string;
}

class TerminalService {
  private sessions: Map<string, TerminalSession>;
  private userSessions: Map<string, Set<string>>; // userId -> sessionIds

  constructor() {
    this.sessions = new Map();
    this.userSessions = new Map();
  }

  // 创建新终端会话
  createSession(
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

    // 确定工作目录
    let cwd: string = options.cwd || process.env.HOME || process.env.USERPROFILE || os.homedir();

    // 确定默认 shell
    const platform = os.platform();
    let shell: string = options.shell || '';

    if (!shell) {
      if (platform === 'win32') {
        shell = 'powershell.exe';
      } else if (platform === 'darwin') {
        // macOS 优先使用 zsh
        shell = '/bin/zsh';
      } else {
        shell = '/bin/bash';
      }
    }

    // 环境变量
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8'
    };

    // 创建 PTY 伪终端（添加错误处理）
    let ptyProcess: pty.IPty | undefined;
    try {
      // 检查 shell 是否存在
      const fs = require('fs');
      if (!fs.existsSync(shell)) {
        throw new Error(`Shell not found: ${shell}`);
      }

      console.log(`[Terminal] Creating PTY with shell: ${shell}, cwd: ${cwd}`);

      // 对于 macOS 的 zsh，使用登录 shell
      const shellArgs = platform === 'darwin' && shell.includes('zsh') ? ['-l'] : [];

      ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cwd: cwd || process.env.HOME || process.env.USERPROFILE || os.homedir(),
        env: env,
        cols: options.cols || 80,
        rows: options.rows || 24,
        // 添加一些额外的选项来提高稳定性
        encoding: 'utf8'
      });

      console.log(`[Terminal] PTY created successfully with PID: ${ptyProcess.pid}`);
    } catch (error: any) {
      console.error(`[Terminal] Failed to create PTY:`, error);
      // PTY 创建失败，发送错误消息并关闭连接
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Failed to create terminal: ${error.message}. Please check your system permissions.`
        }));
      }
      ws.close();
      return '';
    }

    const session: TerminalSession = {
      id: sessionId,
      pty: ptyProcess,
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

    this.setupSessionHandlers(session);

    return sessionId;
  }

  // 设置会话事件处理
  private setupSessionHandlers(session: TerminalSession): void {
    const { pty, ws, id, userId, username } = session;

    console.log(`[Terminal] Setting up handlers for session: ${id}`);

    // PTY 数据 -> WebSocket
    pty.onData((data) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'data',
            data: data
          }));
        }
      } catch (error) {
        console.error(`[Terminal] Error sending data for session ${id}:`, error);
      }
    });

    // PTY 退出 -> 关闭 WebSocket
    pty.onExit(({ exitCode, signal }) => {
      console.log(`[Terminal] PTY exited for session ${id}. Exit code: ${exitCode}, Signal: ${signal}`);
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'exit',
            exitCode,
            signal
          }));
          ws.close();
        }
      } catch (error) {
        console.error(`[Terminal] Error closing WebSocket for session ${id}:`, error);
      }
      this.removeSession(id);
    });

    // WebSocket 消息 -> PTY
    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());
        console.log(`[Terminal] Received message type: ${msg.type} for session ${id}`);

        switch (msg.type) {
          case 'input':
            pty.write(msg.data);

            // 记录命令日志
            if (msg.data && msg.data.trim()) {
              const command = terminalLogger.extractCommand(msg.data);
              if (command) {
                const risk = terminalLogger.isDangerousCommand(command);

                // 记录命令
                terminalLogger.logCommand({
                  timestamp: new Date().toISOString(),
                  sessionId: id,
                  userId: session.userId,
                  username: session.username,
                  command: command,
                  cwd: session.cwd,
                  shell: session.shell,
                  hostname: os.hostname(),
                  platform: os.platform()
                });

                // 如果是危险命令，记录警告
                if (risk.dangerous) {
                  console.warn(`[Terminal] ⚠️  DANGEROUS COMMAND (${risk.level}): ${command}`);
                  console.warn(`[Terminal] Reason: ${risk.reason}`);
                  console.warn(`[Terminal] User: ${session.username} (${session.userId})`);
                  console.warn(`[Terminal] Session: ${id}`);

                  // 发送警告消息到终端
                  ws.send(JSON.stringify({
                    type: 'warning',
                    message: `⚠️  警告: 检测到危险命令 (${risk.level}级)`,
                    command: command,
                    reason: risk.reason
                  }));
                }
              }
            }
            break;

          case 'resize':
            const cols = msg.cols || 80;
            const rows = msg.rows || 24;
            console.log(`[Terminal] Resizing session ${id} to ${cols}x${rows}`);
            pty.resize(cols, rows);
            break;

          case 'changeDirectory':
            // 处理目录切换请求
            const newCwd = path.resolve(session.cwd, msg.path);
            session.cwd = newCwd;
            // 重新启动 PTY，使用新目录
            pty.write(`cd ${newCwd}\n`);
            break;

          case 'ping':
            // 心跳检测
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;

          default:
            // 原始数据直接写入 PTY
            if (typeof msg === 'string') {
              pty.write(msg);
            }
        }
      } catch (e) {
        console.error(`[Terminal] Error handling message for session ${id}:`, e);
        // 如果不是 JSON，直接作为输入数据
        try {
          pty.write(message.toString());
        } catch (writeError) {
          console.error(`[Terminal] Error writing to PTY for session ${id}:`, writeError);
        }
      }
    });

    // WebSocket 关闭 -> 终止 PTY
    ws.on('close', () => {
      console.log(`[Terminal] WebSocket closed for session ${id}`);
      try {
        pty.kill();
      } catch (error) {
        console.error(`[Terminal] Error killing PTY for session ${id}:`, error);
      }
      this.removeSession(id);
    });

    // WebSocket 错误处理
    ws.on('error', (error) => {
      console.error(`[Terminal] WebSocket error for session ${id}:`, error);
    });

    // 发送欢迎消息（延迟发送，确保 PTY 已完全初始化）
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ready',
          sessionId: id,
          cwd: session.cwd,
          shell: session.shell,
          platform: os.platform(),
          hostname: os.hostname()
        }));
        console.log(`[Terminal] Ready message sent for session: ${id}`);
      } else {
        console.log(`[Terminal] WebSocket closed before ready message could be sent for session: ${id}`);
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
    }
  }

  // 获取会话
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  // 获取用户的所有会话
  getUserSessions(userId: string): TerminalSession[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) {
      return [];
    }

    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((session): session is TerminalSession => session !== undefined);
  }

  // 关闭用户的所有会话
  closeUserSessions(userId: string): void {
    const sessions = this.getUserSessions(userId);
    sessions.forEach(session => {
      session.ws.close();
      session.pty.kill();
    });
  }

  // 生成会话 ID
  private generateSessionId(): string {
    return `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取系统信息
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      release: os.release(),
      homedir: os.homedir(),
      cpus: os.cpus(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      uptime: os.uptime()
    };
  }

  // 获取可用 shells
  getAvailableShells(): string[] {
    const platform = os.platform();
    if (platform === 'win32') {
      return ['powershell.exe', 'cmd.exe', 'pwsh.exe'];
    } else if (platform === 'darwin') {
      return ['/bin/zsh', '/bin/bash', '/bin/sh', '/usr/local/bin/fish'];
    } else {
      return ['/bin/bash', '/bin/zsh', '/bin/sh', '/usr/bin/fish'];
    }
  }
}

// 创建单例
export const terminalService = new TerminalService();

// WebSocket 处理函数（启用 PTY 功能）
export function handleTerminalConnection(ws: WebSocket, req: any) {
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

      // 创建终端会话
      const sessionId = terminalService.createSession(ws, {
        userId: (decoded as any).userId,
        username: (decoded as any).username,
        cols: 80,
        rows: 24
      });

      if (!sessionId) {
        console.log('[Terminal WS] Session creation failed');
        // 会话创建失败（已在 createSession 中发送错误消息）
        return;
      }

      console.log(`[Terminal WS] Session created: ${sessionId} for user ${(decoded as any).username}`);
    } catch (e: any) {
      console.error('[Terminal WS] Token verification failed:', e);
      // Token 无效
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `认证失败: ${e.message}`
        }));
      }
      ws.close();
    }
  } catch (error: any) {
    console.error('[Terminal] Connection error:', error);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `连接错误: ${error.message}`
      }));
    }
    ws.close();
  }
}
