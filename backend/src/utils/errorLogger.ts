import fs from 'fs-extra';
import path from 'path';

interface ErrorLog {
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  category: string;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}

class ErrorLogger {
  private logFile: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB

  constructor() {
    this.logFile = path.join(process.cwd(), 'logs', 'errors.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    const logsDir = path.dirname(this.logFile);
    fs.ensureDirSync(logsDir);
  }

  private async rotateLogFile() {
    try {
      const stats = await fs.stat(this.logFile);
      if (stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFile = path.join(path.dirname(this.logFile), `errors-${timestamp}.log`);
        await fs.move(this.logFile, archiveFile);
      }
    } catch (error) {
      // 文件不存在，不需要轮转
    }
  }

  private formatLogEntry(errorLog: ErrorLog): string {
    const metadata = errorLog.metadata ? `\n  Metadata: ${JSON.stringify(errorLog.metadata)}` : '';
    const stack = errorLog.stack ? `\n  Stack: ${errorLog.stack}` : '';
    return `[${errorLog.timestamp}] [${errorLog.level.toUpperCase()}] [${errorLog.category}] ${errorLog.message}${metadata}${stack}`;
  }

  async log(errorLog: ErrorLog) {
    try {
      await this.rotateLogFile();

      const logEntry = this.formatLogEntry(errorLog) + '\n';
      await fs.appendFile(this.logFile, logEntry);

      // 同时输出到控制台
      const consoleMethod = errorLog.level === 'error' ? console.error :
                           errorLog.level === 'warn' ? console.warn :
                           console.log;
      consoleMethod(`[${errorLog.category}]`, errorLog.message, errorLog.metadata || '');
    } catch (error) {
      console.error('Failed to write error log:', error);
    }
  }

  async error(category: string, message: string, metadata?: Record<string, any>, error?: Error) {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'error',
      category,
      message,
      stack: error?.stack,
      metadata
    });
  }

  async warn(category: string, message: string, metadata?: Record<string, any>) {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      category,
      message,
      metadata
    });
  }

  async info(category: string, message: string, metadata?: Record<string, any>) {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      category,
      message,
      metadata
    });
  }

  async getRecentErrors(limit: number = 100): Promise<ErrorLog[]> {
    try {
      const content = await fs.readFile(this.logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const recentLines = lines.slice(-limit);

      return recentLines.map(line => {
        try {
          const parsed = JSON.parse(line.replace(/^\[[^\]]+\]\s*/, ''));
          return parsed;
        } catch {
          return null;
        }
      }).filter(log => log !== null);
    } catch (error) {
      return [];
    }
  }

  async clearOldLogs(daysToKeep: number = 7) {
    try {
      const logsDir = path.dirname(this.logFile);
      const files = await fs.readdir(logsDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge && file.startsWith('errors-')) {
          await fs.remove(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to clear old logs:', error);
    }
  }
}

// 创建单例
export const errorLogger = new ErrorLogger();

// 全局错误处理
export function setupGlobalErrorHandlers() {
  // 捕获未处理的 Promise 拒绝
  process.on('unhandledRejection', async (reason, promise) => {
    await errorLogger.error('UnhandledPromiseRejection', 'Unhandled Promise rejection', {
      reason: String(reason),
      promise: String(promise)
    });
  });

  // 捕获未捕获的异常
  process.on('uncaughtException', async (error) => {
    await errorLogger.error('UncaughtException', 'Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    // 给日志时间写入，然后退出
    setTimeout(() => process.exit(1), 1000);
  });

  // 捕获警告
  process.on('warning', async (warning) => {
    await errorLogger.warn('ProcessWarning', warning.message || String(warning), {
      name: warning.name,
      stack: warning.stack
    });
  });
}
