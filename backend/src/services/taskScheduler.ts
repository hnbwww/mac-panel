import cron from 'node-cron';
import { spawn, exec } from 'child_process';
import { db } from './database';
import { sendNotification } from './notificationService';

interface ScheduledTask {
  id: string;
  name: string;
  type: 'shell' | 'http' | 'backup';
  cron_expression: string;
  enabled: boolean;
  command?: string;
  url?: string;
  method?: 'GET' | 'POST';
  notify_email?: string;
  webhook_url?: string;
  retry_times?: number;
  timeout?: number;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

interface TaskExecution {
  id: string;
  task_id: string;
  task_name: string;
  status: 'running' | 'success' | 'failed';
  start_time: string;
  end_time?: string;
  output?: string;
  error?: string;
  retry_count?: number;
}

class TaskScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask>;
  private runningExecutions: Map<string, NodeJS.Timeout>;

  constructor() {
    this.scheduledTasks = new Map();
    this.runningExecutions = new Map();
  }

  // 初始化 - 加载所有启用的任务
  async initialize(): Promise<void> {
    try {
      const tasks = await db.listTasks();
      const enabledTasks = tasks.filter(task => task.enabled);

      for (const task of enabledTasks) {
        this.scheduleTask(task);
      }

      console.log(`Task scheduler initialized with ${enabledTasks.length} tasks`);
    } catch (error) {
      console.error('Failed to initialize task scheduler:', error);
    }
  }

  // 调度任务
  scheduleTask(task: ScheduledTask): void {
    try {
      // 如果任务已存在，先停止
      if (this.scheduledTasks.has(task.id)) {
        this.unscheduleTask(task.id);
      }

      // 验证 cron 表达式
      if (!cron.validate(task.cron_expression)) {
        console.error(`Invalid cron expression for task ${task.id}: ${task.cron_expression}`);
        return;
      }

      // 创建定时任务
      const scheduledTask = cron.schedule(
        task.cron_expression,
        () => {
          this.executeTask(task).catch(error => {
            console.error(`Failed to execute task ${task.id}:`, error);
          });
        },
        {
          scheduled: false,
          timezone: task.timezone || 'Asia/Shanghai'
        }
      );

      this.scheduledTasks.set(task.id, scheduledTask);

      // 如果任务启用，启动调度
      if (task.enabled) {
        scheduledTask.start();
      }

      console.log(`Task ${task.id} scheduled: ${task.cron_expression}`);
    } catch (error) {
      console.error(`Failed to schedule task ${task.id}:`, error);
    }
  }

  // 取消调度任务
  unscheduleTask(taskId: string): void {
    const scheduledTask = this.scheduledTasks.get(taskId);
    if (scheduledTask) {
      scheduledTask.stop();
      this.scheduledTasks.delete(taskId);
    }
  }

  // 重新调度任务（用于更新）
  rescheduleTask(task: ScheduledTask): void {
    this.unscheduleTask(task.id);
    this.scheduleTask(task);
  }

  // 立即执行任务
  async executeTask(task: ScheduledTask): Promise<void> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 创建执行记录
      const execution: TaskExecution = {
        id: executionId,
        task_id: task.id,
        task_name: task.name,
        status: 'running',
        start_time: new Date().toISOString()
      };

      await db.createExecution(execution);

      // 设置超时
      const timeoutMs = task.timeout || 300000; // 默认 5 分钟
      const timeout = setTimeout(() => {
        this.handleExecutionTimeout(executionId, task);
      }, timeoutMs);

      this.runningExecutions.set(executionId, timeout);

      // 根据任务类型执行
      let result: any;

      switch (task.type) {
        case 'shell':
          result = await this.executeShellTask(task);
          break;
        case 'http':
          result = await this.executeHttpTask(task);
          break;
        case 'backup':
          result = await this.executeBackupTask(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // 清除超时
      clearTimeout(timeout);
      this.runningExecutions.delete(executionId);

      // 更新执行记录为成功
      const outputText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      await db.updateExecution(executionId, {
        status: 'success',
        end_time: new Date().toISOString(),
        output: outputText
      });

      console.log(`[TaskExecutor] Task ${task.id} executed successfully`);
      console.log(`[TaskExecutor] Output: ${outputText.substring(0, 200)}...`);

      console.log(`Task ${task.id} executed successfully`);
    } catch (error: any) {
      // 清除超时
      const timeout = this.runningExecutions.get(executionId);
      if (timeout) {
        clearTimeout(timeout);
        this.runningExecutions.delete(executionId);
      }

      // 更新执行记录为失败
      await db.updateExecution(executionId, {
        status: 'failed',
        end_time: new Date().toISOString(),
        output: error.message,  // 保存完整的错误信息（包括输出）
        error: error.name || 'Error'
      });

      // 发送失败通知
      await this.sendFailureNotification(task, error);

      // 重试逻辑
      if (task.retry_times && task.retry_times > 0) {
        await this.retryTask(task, (task.retry_times - 1));
      }

      console.error(`Task ${task.id} execution failed:`, error);
    }
  }

  // 执行 Shell 任务
  private async executeShellTask(task: ScheduledTask): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!task.command) {
        return reject(new Error('Shell command is required'));
      }

      console.log(`[TaskExecutor] ========================================`);
      console.log(`[TaskExecutor] Executing shell task: ${task.name}`);
      console.log(`[TaskExecutor] Task ID: ${task.id}`);
      console.log(`[TaskExecutor] Command: ${task.command}`);
      console.log(`[TaskExecutor] Start Time: ${new Date().toISOString()}`);
      console.log(`[TaskExecutor] ========================================`);

      const child = spawn('sh', ['-c', task.command]);
      let stdoutOutput = '';
      let stderrOutput = '';
      let combinedOutput = '';

      // 拦截标准输出
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdoutOutput += text;
        combinedOutput += text;
        // 实时记录到控制台，便于调试
        console.log(`[TaskExecutor STDOUT] ${text.trim()}`);
      });

      // 拦截标准错误（也作为输出的一部分）
      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderrOutput += text;
        combinedOutput += text;
        // 错误也记录到控制台
        console.error(`[TaskExecutor STDERR] ${text.trim()}`);
      });

      child.on('close', (code) => {
        const endTime = new Date().toISOString();
        const duration = Date.now() - new Date(task.updated_at || Date.now()).getTime();

        console.log(`[TaskExecutor] ========================================`);
        console.log(`[TaskExecutor] Process exited with code: ${code}`);
        console.log(`[TaskExecutor] End Time: ${endTime}`);
        console.log(`[TaskExecutor] Duration: ${duration}ms`);
        console.log(`[TaskExecutor] Stdout Length: ${stdoutOutput.length} chars`);
        console.log(`[TaskExecutor] Stderr Length: ${stderrOutput.length} chars`);
        console.log(`[TaskExecutor] Total Output: ${combinedOutput.length} chars`);
        console.log(`[TaskExecutor] ========================================`);

        // 组合所有输出（包含 stdout 和 stderr）
        const fullOutput = combinedOutput.trim();

        if (code === 0) {
          resolve(fullOutput || 'Command executed successfully (no output)');
        } else {
          // 失败时也返回完整的输出，便于调试
          const errorMsg = `Command failed with exit code ${code}\n\nOutput:\n${fullOutput}`;
          reject(new Error(errorMsg));
        }
      });

      child.on('error', (error) => {
        console.error(`[TaskExecutor] ========================================`);
        console.error(`[TaskExecutor] Failed to start process: ${error.message}`);
        console.error(`[TaskExecutor] Error Stack: ${error.stack}`);
        console.error(`[TaskExecutor] ========================================`);
        reject(error);
      });
    });
  }

  // 执行 HTTP 任务
  private async executeHttpTask(task: ScheduledTask): Promise<any> {
    if (!task.url) {
      throw new Error('URL is required for HTTP task');
    }

    const method = task.method || 'GET';
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mac-Panel-Task-Scheduler/1.0'
      }
    };

    if (method === 'POST' && task.command) {
      try {
        options.body = JSON.stringify(JSON.parse(task.command));
      } catch (e) {
        options.body = task.command;
      }
    }

    try {
      const response = await fetch(task.url, options);
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    } catch (error: any) {
      throw new Error(`HTTP request failed: ${error.message}`);
    }
  }

  // 执行备份任务
  private async executeBackupTask(task: ScheduledTask): Promise<any> {
    if (!task.command) {
      throw new Error('Backup target is required');
    }

    // 解析备份目标
    const targets = JSON.parse(task.command);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `/tmp/mac-panel-backups/${timestamp}`;

    // 创建备份目录
    const fs = require('fs-extra');
    await fs.ensureDir(backupDir);

    const results = [];

    for (const target of targets) {
      const backupPath = `${backupDir}/${target.name || target.type}.tar.gz`;

      let backupResult: any;
      if (target.type === 'database') {
        // 备份数据库
        backupResult = await this.backupDatabase(target, backupPath);
      } else if (target.type === 'files') {
        // 备份文件
        backupResult = await this.backupFiles(target, backupPath);
      } else if (target.type === 'website') {
        // 备份网站
        backupResult = await this.backupWebsite(target, backupPath);
      }

      results.push(backupResult);
    }

    return {
      success: true,
      backupDir,
      backups: results,
      timestamp
    };
  }

  // 备份数据库
  private async backupDatabase(target: any, backupPath: string): Promise<any> {
    // 根据数据库类型执行不同的备份命令
    const dbConfig = await db.getDatabaseConfigById(target.id);
    if (!dbConfig) {
      throw new Error(`Database config not found: ${target.id}`);
    }

    let command: string;

    switch (dbConfig.type) {
      case 'mysql':
        command = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.username} -p${dbConfig.password} ${dbConfig.database} > ${backupPath}`;
        break;
      case 'postgresql':
        command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -F c -f ${backupPath}`;
        break;
      default:
        throw new Error(`Unsupported database type for backup: ${dbConfig.type}`);
    }

    return this.executeShellCommand(command);
  }

  // 备份文件
  private async backupFiles(target: any, backupPath: string): Promise<any> {
    const command = `tar -czf ${backupPath} ${target.path}`;
    return this.executeShellCommand(command);
  }

  // 备份网站
  private async backupWebsite(target: any, backupPath: string): Promise<any> {
    const website = await db.getWebsiteById(target.id);
    if (!website) {
      throw new Error(`Website not found: ${target.id}`);
    }

    // 备份网站文件和数据库
    const tempDir = `/tmp/website-backup-${Date.now()}`;
    await require('fs-extra').ensureDir(tempDir);

    // 备份文件
    await this.executeShellCommand(`tar -czf ${tempDir}/files.tar.gz ${website.root_dir}`);

    // 打包所有备份文件
    await this.executeShellCommand(`tar -czf ${backupPath} -C ${tempDir} .`);

    // 清理临时文件
    await require('fs-extra').remove(tempDir);

    return { success: true, backupPath };
  }

  // 执行 Shell 命令
  private executeShellCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${stderr || stdout}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  // 处理执行超时
  private async handleExecutionTimeout(executionId: string, task: ScheduledTask): Promise<void> {
    await db.updateExecution(executionId, {
      status: 'failed',
      end_time: new Date().toISOString(),
      error: `Task execution timeout after ${task.timeout || 300000}ms`
    });

    this.runningExecutions.delete(executionId);

    await this.sendFailureNotification(task, new Error('Task execution timeout'));
  }

  // 重试任务
  private async retryTask(task: ScheduledTask, remainingRetries: number): Promise<void> {
    if (remainingRetries <= 0) {
      return;
    }

    // 等待一段时间后重试
    setTimeout(async () => {
      try {
        await this.executeTask({
          ...task,
          retry_times: remainingRetries
        });
      } catch (error) {
        console.error(`Retry failed for task ${task.id}:`, error);
      }
    }, 60000); // 1 分钟后重试
  }

  // 发送失败通知
  private async sendFailureNotification(task: ScheduledTask, error: Error): Promise<void> {
    // 创建通知
    await sendNotification({
      type: 'task_failure',
      title: `任务 "${task.name}" 执行失败`,
      content: error.message,
      severity: 'error'
    });

    // 发送邮件通知
    if (task.notify_email) {
      await this.sendEmailNotification(task, error);
    }

    // 发送 Webhook 通知
    if (task.webhook_url) {
      await this.sendWebhookNotification(task, error);
    }
  }

  // 发送邮件通知
  private async sendEmailNotification(task: ScheduledTask, error: Error): Promise<void> {
    try {
      // 这里集成邮件发送服务
      const nodemailer = require('nodemailer');

      // 从设置中获取 SMTP 配置
      const smtpConfig = await db.getSetting('smtp');
      if (!smtpConfig) {
        console.warn('SMTP not configured, skipping email notification');
        return;
      }

      const transporter = nodemailer.createTransport(smtpConfig);

      await transporter.sendMail({
        from: smtpConfig.from || 'noreply@mac-panel.local',
        to: task.notify_email,
        subject: `[Mac Panel] 任务执行失败: ${task.name}`,
        text: `
任务名称: ${task.name}
任务类型: ${task.type}
失败时间: ${new Date().toISOString()}
错误信息: ${error.message}

请登录 Mac Panel 查看详细信息和日志。
        `,
        html: `
<h2>任务执行失败</h2>
<p><strong>任务名称:</strong> ${task.name}</p>
<p><strong>任务类型:</strong> ${task.type}</p>
<p><strong>失败时间:</strong> ${new Date().toISOString()}</p>
<p><strong>错误信息:</strong> ${error.message}</p>
<p>请登录 Mac Panel 查看详细信息和日志。</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }
  }

  // 发送 Webhook 通知
  private async sendWebhookNotification(task: ScheduledTask, error: Error): Promise<void> {
    try {
      await fetch(task.webhook_url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task: {
            id: task.id,
            name: task.name,
            type: task.type
          },
          error: {
            message: error.message,
            name: error.name
          },
          timestamp: new Date().toISOString(),
          severity: 'error'
        })
      });
    } catch (webhookError) {
      console.error('Failed to send webhook notification:', webhookError);
    }
  }

  // 获取所有调度任务
  getScheduledTasks(): Map<string, cron.ScheduledTask> {
    return this.scheduledTasks;
  }

  // 检查任务是否已调度
  isTaskScheduled(taskId: string): boolean {
    return this.scheduledTasks.has(taskId);
  }
}

// 导出单例
export const taskScheduler = new TaskScheduler();
