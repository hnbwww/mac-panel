import express from 'express';
import { terminalLogger } from '../services/terminalLogger';
import { authMiddleware } from '../middlewares/auth';

const router = express.Router();

/**
 * GET /api/terminal-logs/history
 * 获取终端命令历史
 */
router.get('/history', authMiddleware, (req, res) => {
  try {
    const {
      sessionId,
      username,
      limit = '100',
      since
    } = req.query;

    const options: {
      sessionId?: string;
      username?: string;
      limit?: number;
      since?: Date;
    } = {};

    if (sessionId) options.sessionId = sessionId as string;
    if (username) options.username = username as string;
    if (limit) options.limit = parseInt(limit as string, 10);
    if (since) options.since = new Date(since as string);

    const logs = terminalLogger.readCommandHistory(options);

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (error: any) {
    console.error('[TerminalLogs] Failed to fetch history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch command history',
      error: error.message
    });
  }
});

/**
 * GET /api/terminal-logs/statistics
 * 获取终端命令统计信息
 */
router.get('/statistics', authMiddleware, (req, res) => {
  try {
    const stats = terminalLogger.getStatistics();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('[TerminalLogs] Failed to fetch statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

/**
 * POST /api/terminal-logs/cleanup
 * 清理旧日志
 */
router.post('/cleanup', authMiddleware, (req, res) => {
  try {
    const { days = 30 } = req.body;

    terminalLogger.cleanupOldLogs(days);

    res.json({
      success: true,
      message: `Cleaned up logs older than ${days} days`
    });
  } catch (error: any) {
    console.error('[TerminalLogs] Failed to cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup logs',
      error: error.message
    });
  }
});

/**
 * GET /api/terminal-logs/dangerous
 * 获取危险命令列表
 */
router.get('/dangerous', authMiddleware, (req, res) => {
  try {
    const logs = terminalLogger.readCommandHistory();

    const dangerousCommands = logs.filter(log => {
      const risk = terminalLogger.isDangerousCommand(log.command);
      return risk.dangerous;
    });

    res.json({
      success: true,
      data: dangerousCommands,
      count: dangerousCommands.length
    });
  } catch (error: any) {
    console.error('[TerminalLogs] Failed to fetch dangerous commands:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dangerous commands',
      error: error.message
    });
  }
});

export default router;
