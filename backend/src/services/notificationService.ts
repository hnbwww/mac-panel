import { db } from './database';

interface NotificationOptions {
  type: 'task_failure' | 'system' | 'security' | 'info';
  title: string;
  content: string;
  severity?: 'info' | 'warning' | 'error';
  userId?: string;
}

class NotificationService {
  // 发送通知
  async sendNotification(options: NotificationOptions): Promise<void> {
    try {
      await db.createNotification({
        type: options.type,
        title: options.title,
        content: options.content,
        read: false
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  // 发送任务失败通知
  async sendTaskFailureNotification(taskId: string, taskName: string, error: string): Promise<void> {
    await this.sendNotification({
      type: 'task_failure',
      title: `任务 "${taskName}" 执行失败`,
      content: `任务 ID: ${taskId}\n错误: ${error}\n时间: ${new Date().toISOString()}`,
      severity: 'error'
    });
  }

  // 发送系统通知
  async sendSystemNotification(title: string, content: string): Promise<void> {
    await this.sendNotification({
      type: 'system',
      title,
      content,
      severity: 'info'
    });
  }

  // 发送安全通知
  async sendSecurityNotification(title: string, content: string): Promise<void> {
    await this.sendNotification({
      type: 'security',
      title,
      content,
      severity: 'warning'
    });
  }

  // 发送信息通知
  async sendInfoNotification(title: string, content: string): Promise<void> {
    await this.sendNotification({
      type: 'info',
      title,
      content,
      severity: 'info'
    });
  }
}

// 导出单例和便捷函数
export const notificationService = new NotificationService();

export async function sendNotification(options: NotificationOptions): Promise<void> {
  await notificationService.sendNotification(options);
}

export async function sendTaskFailureNotification(taskId: string, taskName: string, error: string): Promise<void> {
  await notificationService.sendTaskFailureNotification(taskId, taskName, error);
}

export async function sendSystemNotification(title: string, content: string): Promise<void> {
  await notificationService.sendSystemNotification(title, content);
}

export async function sendSecurityNotification(title: string, content: string): Promise<void> {
  await notificationService.sendSecurityNotification(title, content);
}

export async function sendInfoNotification(title: string, content: string): Promise<void> {
  await notificationService.sendInfoNotification(title, content);
}
