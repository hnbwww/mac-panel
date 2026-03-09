import * as fs from 'fs';
import * as path from 'path';

interface TerminalCommandLog {
  timestamp: string;
  sessionId: string;
  userId?: string;
  username?: string;
  command: string;
  cwd: string;
  shell: string;
  hostname: string;
  platform: string;
}

class TerminalLogger {
  private logDir: string;
  private logFile: string;
  private buffer: TerminalCommandLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 设置日志目录
    this.logDir = path.join(process.cwd(), 'logs', 'terminal');
    this.logFile = path.join(this.logDir, 'commands.log');

    // 确保日志目录存在
    this.ensureLogDirectory();

    // 每5秒刷新一次缓冲区
    this.startFlushInterval();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 5000);
  }

  /**
   * 记录终端命令
   */
  logCommand(log: TerminalCommandLog): void {
    // 添加到缓冲区
    this.buffer.push({
      ...log,
      timestamp: log.timestamp || new Date().toISOString()
    });

    // 如果缓冲区太大，立即刷新
    if (this.buffer.length >= 10) {
      this.flush();
    }
  }

  /**
   * 从终端输入中提取命令
   */
  extractCommand(input: string): string {
    // 移除 ANSI 转义序列
    const ansiRegex = /\x1b\[[0-9;]*[mGKH]/g;
    let clean = input.replace(ansiRegex, '');

    // 移除终端提示符
    clean = clean.replace(/^.*?%\s*/, '');
    clean = clean.replace(/^.*?\$\s*/, '');
    clean = clean.replace(/^.*?#\s*/, '');

    // 移除控制字符
    clean = clean.replace(/[\x00-\x1F\x7F]/g, '');

    // 提取命令（处理多行输入）
    const lines = clean.split('\n').filter(line => line.trim());

    // 返回最后一个非空行作为命令
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      // 过滤掉一些明显的非命令输入
      if (lastLine && !lastLine.startsWith('[') && lastLine.length > 0) {
        return lastLine;
      }
    }

    return clean.trim();
  }

  /**
   * 判断是否是危险命令
   */
  isDangerousCommand(command: string): { dangerous: boolean; level: 'low' | 'medium' | 'high'; reason: string } {
    const cmd = command.toLowerCase().trim();

    // 高危命令
    const highRisk = [
      { pattern: /^rm\s+-rf\s+/, reason: '强制删除文件/目录' },
      { pattern: /^dd\s+if=/, reason: '磁盘直接写入操作' },
      { pattern: /^mkfs\./, reason: '格式化文件系统' },
      { pattern: /:\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;/, reason: 'Fork bomb（进程炸弹）' },
      { pattern: /^chmod\s+000\s+/, reason: '移除所有权限' },
      { pattern: /^shutdown\b/, reason: '关机命令' },
      { pattern: /^reboot\b/, reason: '重启命令' },
    ];

    // 中危命令
    const mediumRisk = [
      { pattern: /^rm\s+/, reason: '删除文件/目录' },
      { pattern: /^mv\s+.*\s+\/dev\//, reason: '移动到设备文件' },
      { pattern: /^curl.*\|\s*(sh|bash|python|node)/, reason: '下载并执行脚本' },
      { pattern: /^wget.*\|\s*(sh|bash|python|node)/, reason: '下载并执行脚本' },
      { pattern: /:\>\s*\/dev\/\w+/, reason: '覆盖设备文件' },
    ];

    // 检查高危
    for (const risk of highRisk) {
      if (risk.pattern.test(cmd)) {
        return { dangerous: true, level: 'high', reason: risk.reason };
      }
    }

    // 检查中危
    for (const risk of mediumRisk) {
      if (risk.pattern.test(cmd)) {
        return { dangerous: true, level: 'medium', reason: risk.reason };
      }
    }

    return { dangerous: false, level: 'low', reason: '' };
  }

  /**
   * 将日志写入文件
   */
  private flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    try {
      const logEntries = this.buffer.map(log => {
        return JSON.stringify(log);
      }).join('\n') + '\n';

      fs.appendFileSync(this.logFile, logEntries, 'utf8');
      this.buffer = [];

      console.log(`[TerminalLogger] Flushed ${logEntries.split('\n').filter(l => l).length} log entries`);
    } catch (error) {
      console.error('[TerminalLogger] Failed to flush logs:', error);
    }
  }

  /**
   * 读取命令历史
   */
  readCommandHistory(options: {
    sessionId?: string;
    username?: string;
    limit?: number;
    since?: Date;
  } = {}): TerminalCommandLog[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      let logs: TerminalCommandLog[] = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter((log): log is TerminalCommandLog => log !== null);

      // 过滤
      if (options.sessionId) {
        logs = logs.filter(log => log.sessionId === options.sessionId);
      }

      if (options.username) {
        logs = logs.filter(log => log.username === options.username);
      }

      if (options.since) {
        const sinceTime = options.since.getTime();
        logs = logs.filter(log => new Date(log.timestamp).getTime() >= sinceTime);
      }

      // 限制数量
      if (options.limit) {
        logs = logs.slice(-options.limit);
      }

      return logs;
    } catch (error) {
      console.error('[TerminalLogger] Failed to read logs:', error);
      return [];
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalCommands: number;
    uniqueUsers: number;
    topCommands: Array<{ command: string; count: number }>;
    dangerousCommands: number;
  } {
    const logs = this.readCommandHistory();

    // 统计命令频率
    const commandCounts = new Map<string, number>();
    let dangerousCount = 0;

    logs.forEach(log => {
      const cmd = log.command.split(' ')[0]; // 只取命令名
      commandCounts.set(cmd, (commandCounts.get(cmd) || 0) + 1);

      const assessment = this.isDangerousCommand(log.command);
      if (assessment.dangerous) {
        dangerousCount++;
      }
    });

    // 排序
    const topCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const uniqueUsers = new Set(logs.map(log => log.username)).size;

    return {
      totalCommands: logs.length,
      uniqueUsers,
      topCommands,
      dangerousCommands: dangerousCount
    };
  }

  /**
   * 清理旧日志
   */
  cleanupOldLogs(daysToKeep: number = 30): void {
    try {
      const logs = this.readCommandHistory();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const filteredLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate;
      });

      // 重写日志文件
      const content = filteredLogs.map(log => JSON.stringify(log)).join('\n') + '\n';
      fs.writeFileSync(this.logFile, content, 'utf8');

      console.log(`[TerminalLogger] Cleaned up ${logs.length - filteredLogs.length} old log entries`);
    } catch (error) {
      console.error('[TerminalLogger] Failed to cleanup logs:', error);
    }
  }

  /**
   * 关闭日志服务
   */
  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
    console.log('[TerminalLogger] Shutdown complete');
  }
}

// 创建单例
export const terminalLogger = new TerminalLogger();

// 进程退出时刷新日志
process.on('exit', () => {
  terminalLogger.shutdown();
});

process.on('SIGINT', () => {
  terminalLogger.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  terminalLogger.shutdown();
  process.exit(0);
});
