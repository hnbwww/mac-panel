import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { taskScheduler } from '../services/taskScheduler';
import { requirePermission, AuthRequest } from '../middlewares/permission';
import { sendTaskFailureNotification } from '../services/notificationService';
import { logOperation } from '../middlewares/auditLog';

const router = Router();

// 获取所有任务
router.get('/', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await db.listTasks();
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个任务
router.get('/:id', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 创建任务
router.post('/', requirePermission('tasks', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      type,
      cron_expression,
      enabled = true,
      command,
      url,
      method = 'GET',
      notify_email,
      webhook_url,
      retry_times = 0,
      timeout = 300000,
      timezone = 'Asia/Shanghai'
    } = req.body;

    // 验证必填字段
    if (!name || !type || !cron_expression) {
      return res.status(400).json({
        error: 'Missing required fields: name, type, cron_expression'
      });
    }

    // 验证 cron 表达式
    const cron = require('node-cron');
    if (!cron.validate(cron_expression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    // 根据类型验证必填字段
    if (type === 'shell' && !command) {
      return res.status(400).json({ error: 'Command is required for shell tasks' });
    }
    if (type === 'http' && !url) {
      return res.status(400).json({ error: 'URL is required for HTTP tasks' });
    }
    if (type === 'backup' && !command) {
      return res.status(400).json({ error: 'Backup target is required for backup tasks' });
    }

    // 创建任务
    const task = await db.createTask({
      name,
      type,
      cron_expression,
      enabled,
      command,
      url,
      method,
      notify_email,
      webhook_url,
      retry_times,
      timeout,
      timezone
    });

    // 如果启用，调度任务
    if (enabled) {
      taskScheduler.scheduleTask(task);
    }

    // 记录操作
    await logOperation(
      req.userId || 'unknown',
      req.username || 'unknown',
      'create',
      'tasks',
      { taskId: task.id, taskName: name },
      req.ip || 'unknown',
      'success'
    );

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 更新任务
router.put('/:id', requirePermission('tasks', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = req.body;

    // 如果更新了 cron 表达式，验证它
    if (updates.cron_expression) {
      const cron = require('node-cron');
      if (!cron.validate(updates.cron_expression)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    }

    // 更新任务
    await db.updateTask(req.params.id, updates);

    // 重新调度任务
    const updatedTask = { ...task, ...updates };
    taskScheduler.rescheduleTask(updatedTask);

    // 记录操作
    await logOperation(
      req.userId || 'unknown',
      req.username || 'unknown',
      'update',
      'tasks',
      { taskId: req.params.id, updates },
      req.ip || 'unknown',
      'success'
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除任务
router.delete('/:id', requirePermission('tasks', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 取消调度
    taskScheduler.unscheduleTask(req.params.id);

    // 删除任务
    await db.deleteTask(req.params.id);

    // 记录操作
    await logOperation(
      req.userId || 'unknown',
      req.username || 'unknown',
      'delete',
      'tasks',
      { taskId: req.params.id, taskName: task.name },
      req.ip || 'unknown',
      'success'
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 立即执行任务
router.post('/:id/execute', requirePermission('tasks', 'execute'), async (req: AuthRequest, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // 异步执行任务
    taskScheduler.executeTask(task).catch(error => {
      console.error(`Failed to execute task ${req.params.id}:`, error);
    });

    // 记录操作
    await logOperation(
      req.userId || 'unknown',
      req.username || 'unknown',
      'execute',
      'tasks',
      { taskId: req.params.id, taskName: task.name },
      req.ip || 'unknown',
      'success'
    );

    res.json({ success: true, message: 'Task execution started' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取任务执行记录
router.get('/:id/executions', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const executions = await db.listExecutions(req.params.id, limit);
    res.json(executions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 切换任务启用状态
router.post('/:id/toggle', requirePermission('tasks', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const newStatus = !task.enabled;

    await db.updateTask(req.params.id, { enabled: newStatus });

    // 重新调度任务
    const updatedTask = { ...task, enabled: newStatus };
    taskScheduler.rescheduleTask(updatedTask);

    // 记录操作
    await logOperation(
      req.userId || 'unknown',
      req.username || 'unknown',
      'toggle',
      'tasks',
      { taskId: req.params.id, enabled: newStatus },
      req.ip || 'unknown',
      'success'
    );

    res.json({ success: true, enabled: newStatus });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有执行记录
router.get('/executions/all', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const executions = await db.listExecutions(undefined, limit);
    res.json(executions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 验证 cron 表达式
router.post('/validate-cron', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { cron_expression } = req.body;

    if (!cron_expression) {
      return res.status(400).json({ error: 'Cron expression is required' });
    }

    const cron = require('node-cron');
    const isValid = cron.validate(cron_expression);

    if (isValid) {
      // 获取下一次执行时间
      const parser = require('cron-parser').parseExpression(cron_expression);
      const nextRuns = [];
      for (let i = 0; i < 5; i++) {
        nextRuns.push(parser.next().toString());
        if (i < 4) parser.next();
      }

      res.json({
        valid: true,
        next_runs: nextRuns
      });
    } else {
      res.json({ valid: false });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取最新的执行记录（全局）
router.get('/executions/latest', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 10;
    const executions = await db.getLatestExecutions(count);
    res.json(executions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取执行统计
router.get('/executions/stats', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.query.taskId as string;
    const stats = await db.getExecutionStats(taskId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个执行记录的详细输出
router.get('/executions/detail/:executionId', requirePermission('tasks', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const executions = await db.listExecutions(undefined, 1000); // 获取更多记录以查找
    const execution = executions.find(e => e.id === req.params.executionId);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
