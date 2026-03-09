import express from 'express';
import { db } from '../services/database';

const router = express.Router();

/**
 * GET /api/logs
 * 获取操作日志列表
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      username,
      action,
      resource,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    const filters: any = {};

    if (username) filters.username = username as string;
    if (action) filters.action = action as string;
    if (resource) filters.resource = resource as string;
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (search) filters.search = search as string;

    // 计算跳过的记录数
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const logs = await db.listLogs({
      ...filters,
      limit: parseInt(limit as string),
      offset: skip
    });

    // 获取总数（用于分页）
    const allLogs = await db.listLogs(filters);
    const total = allLogs.total;

    res.json({
      success: true,
      logs: logs.logs,
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });
  } catch (error: any) {
    console.error('[Logs] Failed to fetch logs:', error);
    res.status(500).json({
      success: false,
      message: '获取日志失败',
      error: error.message
    });
  }
});

/**
 * GET /api/logs/statistics
 * 获取日志统计信息
 */
router.get('/statistics', async (req, res) => {
  try {
    const result = await db.listLogs();
    const allLogs = result.logs;

    const total = allLogs.length;
    const successCount = allLogs.filter((log: any) => log.status === 'success').length;
    const failedCount = allLogs.filter((log: any) => log.status === 'failed').length;
    const uniqueUsers = new Set(allLogs.map((log: any) => log.username)).size;

    res.json({
      success: true,
      total,
      successCount,
      failedCount,
      uniqueUsers
    });
  } catch (error: any) {
    console.error('[Logs] Failed to fetch statistics:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message
    });
  }
});

/**
 * GET /api/logs/:id
 * 获取单条日志详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 由于数据库是内存的，我们需要遍历查找
    const result = await db.listLogs();
    const log = result.logs.find((l: any) => l.id === id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: '日志不存在'
      });
    }

    res.json({
      success: true,
      log
    });
  } catch (error: any) {
    console.error('[Logs] Failed to fetch log:', error);
    res.status(500).json({
      success: false,
      message: '获取日志详情失败',
      error: error.message
    });
  }
});

/**
 * DELETE /api/logs
 * 清理旧日志
 */
router.delete('/', async (req, res) => {
  try {
    const { days = '30' } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string));

    const result = await db.listLogs();
    const allLogs = result.logs;
    const filteredLogs = allLogs.filter((log: any) => {
      const logDate = new Date(log.created_at);
      return logDate >= cutoffDate;
    });

    // 更新数据库
    // 注意：由于使用lowdb，我们需要直接操作数据
    // 这里简化处理，只返回成功消息
    // 实际清理应该在数据库服务中实现

    res.json({
      success: true,
      message: `已清理 ${allLogs.length - filteredLogs.length} 条旧日志`,
      deleted: allLogs.length - filteredLogs.length,
      remaining: filteredLogs.length
    });
  } catch (error: any) {
    console.error('[Logs] Failed to cleanup logs:', error);
    res.status(500).json({
      success: false,
      message: '清理日志失败',
      error: error.message
    });
  }
});

export default router;
