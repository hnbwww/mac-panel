import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import fs from 'fs-extra';

// 数据库结构定义
interface UserData {
  id: string;
  username: string;
  password_hash: string;
  email?: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'disabled';
  welcome_completed?: boolean;
}

interface RoleData {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  created_at: string;
}

interface OperationLogData {
  id: string;
  user_id: string;
  username: string;
  action: string;
  resource: string;
  details: string;
  ip: string;
  status: 'success' | 'failed';
  created_at: string;
}

interface ScheduledTaskData {
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

interface TaskExecutionData {
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

interface NotificationData {
  id: string;
  type: 'task_failure' | 'system' | 'security' | 'info';
  title: string;
  content: string;
  read: boolean;
  created_at: string;
}

interface WebsiteData {
  id: string;
  domain: string;
  root_dir: string;
  type: 'static' | 'php' | 'java' | 'proxy';
  php_version: string;
  java_version: string;
  port: number;
  ssl: boolean;
  ssl_cert?: string;
  ssl_key?: string;
  ssl_expires_at?: string;
  proxy_config?: {
    enabled: boolean;
    targetUrl: string;
    preserveHost: boolean;
    websocket: boolean;
    customHeaders?: Record<string, string>;
  };
  created_at: string;
  updated_at: string;
}

interface DatabaseConfigData {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'redis' | 'mongodb';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  created_at: string;
}

interface SoftwareConfigData {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: 'development' | 'database' | 'server' | 'ai' | 'utility' | 'other' | 'web' | 'language' | 'tool';
  icon?: string;
  installed: boolean;
  version?: string;
  status: 'running' | 'stopped' | 'unknown';
  config_path?: string;
  available_versions?: string[];
  requires_password?: boolean;
  default_password?: string;
  enabled: boolean;
  sort_order: number;
  commands: {
    install?: string;
    uninstall?: string;
    start?: string;
    stop?: string;
    restart?: string;
    status?: string;
    version?: string;
    logs?: string;
    repair?: string;
  };
  log_paths?: {
    application?: string;
    error?: string;
    access?: string;
  };
  created_at: string;
  updated_at: string;
}

interface DatabaseSchema {
  users: UserData[];
  roles: RoleData[];
  operation_logs: OperationLogData[];
  scheduled_tasks: ScheduledTaskData[];
  task_executions: TaskExecutionData[];
  notifications: NotificationData[];
  websites: WebsiteData[];
  databases: DatabaseConfigData[];
  software_configs: SoftwareConfigData[];
  settings: Record<string, any>;
}

class DatabaseService {
  private db: Low<DatabaseSchema>;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'db.json');
    this.ensureDataDir();
    this.db = this.initializeDB();
    this.migrateDatabase();
    this.initializeDefaultData();
  }

  private migrateDatabase() {
    // 确保所有数据库字段存在（迁移旧数据库）
    this.db.read();
    const data = this.db.data as any;
    if (!data.operation_logs) data.operation_logs = [];
    if (!data.scheduled_tasks) data.scheduled_tasks = [];
    if (!data.task_executions) data.task_executions = [];
    if (!data.databases) data.databases = [];
    if (!data.tasks) data.tasks = [];
    // 如果用户为空且未初始化，创建默认数据
    if ((!data.users || data.users.length === 0) && (!data.settings?.initialized)) {
      const bcrypt = require('bcryptjs');
      data.roles = [
        { id: 'role_admin', name: '管理员', permissions: ['*'], created_at: new Date().toISOString() },
        { id: 'role_user', name: '普通用户', permissions: ['read', 'write'], created_at: new Date().toISOString() },
        { id: 'role_viewer', name: '只读用户', permissions: ['read'], created_at: new Date().toISOString() }
      ];
      data.users = [{
        id: 'user_admin',
        username: 'admin',
        email: 'admin@example.com',
        role_id: 'role_admin',
        status: 'active',
        password_hash: bcrypt.hashSync('admin123', 10),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }];
      data.settings = { initialized: true };
    }
    this.db.write();
  }

  private ensureDataDir() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.ensureDirSync(dataDir);
    }
  }

  private initializeDB(): Low<DatabaseSchema> {
    const adapter = new JSONFile<DatabaseSchema>(this.dbPath);
    const defaultData: DatabaseSchema = {
      users: [],
      roles: [],
      operation_logs: [],
      scheduled_tasks: [],
      task_executions: [],
      notifications: [],
      websites: [],
      databases: [],
      software_configs: [],
      settings: {
        initialized: false
      }
    };
    return new Low(adapter, defaultData);
  }

  private async initializeDefaultData() {
    await this.db.read();

    if (!this.db.data.settings.initialized) {
      // 创建默认角色
      const adminRoleId = 'role_admin';
      const userRoleId = 'role_user';
      const viewerRoleId = 'role_viewer';

      this.db.data.roles = [
        {
          id: adminRoleId,
          name: 'admin',
          description: '系统管理员',
          permissions: ['*'],
          created_at: new Date().toISOString()
        },
        {
          id: userRoleId,
          name: 'user',
          description: '普通用户',
          permissions: [
            'files:read',
            'files:write',
            'files:create',
            'files:delete',
            'websites:read',
            'database:read'
          ],
          created_at: new Date().toISOString()
        },
        {
          id: viewerRoleId,
          name: 'viewer',
          description: '只读用户',
          permissions: ['*:read'],
          created_at: new Date().toISOString()
        }
      ];

      // 创建默认管理员账户
      const bcrypt = require('bcryptjs');
      this.db.data.users = [
        {
          id: 'user_admin',
          username: 'admin',
          password_hash: bcrypt.hashSync('admin123', 10),
          email: 'admin@localhost',
          role_id: adminRoleId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active'
        }
      ];

      this.db.data.settings.initialized = true;
      await this.db.write();
    }
  }

  // Users
  async getUserById(id: string): Promise<UserData | undefined> {
    await this.db.read();
    return this.db.data.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<UserData | undefined> {
    await this.db.read();
    return this.db.data.users.find(u => u.username === username);
  }

  async createUser(user: Omit<UserData, 'id' | 'created_at' | 'updated_at'>): Promise<UserData> {
    await this.db.read();
    const newUser: UserData = {
      ...user,
      id: `user_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.db.data.users.push(newUser);
    await this.db.write();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<UserData>): Promise<void> {
    await this.db.read();
    const index = this.db.data.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.db.data.users[index] = {
        ...this.db.data.users[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      await this.db.write();
    }
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.read();
    this.db.data.users = this.db.data.users.filter(u => u.id !== id);
    await this.db.write();
  }

  async listUsers(): Promise<UserData[]> {
    await this.db.read();
    return this.db.data.users;
  }

  // Roles
  async getRoleById(id: string): Promise<RoleData | undefined> {
    await this.db.read();
    return this.db.data.roles.find(r => r.id === id);
  }

  async listRoles(): Promise<RoleData[]> {
    await this.db.read();
    return this.db.data.roles;
  }

  // Operation Logs
  async createLog(log: Omit<OperationLogData, 'id' | 'created_at'>): Promise<OperationLogData> {
    await this.db.read();
    const newLog: OperationLogData = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    this.db.data.operation_logs.push(newLog);
    await this.db.write();

    // 限制日志数量，保留最近 10000 条
    if (this.db.data.operation_logs.length > 10000) {
      this.db.data.operation_logs = this.db.data.operation_logs.slice(-10000);
      await this.db.write();
    }

    return newLog;
  }

  async listLogs(filters?: {
    user_id?: string;
    action?: string;
    resource?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: OperationLogData[]; total: number }> {
    await this.db.read();
    let logs = [...this.db.data.operation_logs];

    if (filters) {
      if (filters.user_id) {
        logs = logs.filter(l => l.user_id === filters.user_id);
      }
      if (filters.action) {
        logs = logs.filter(l => l.action === filters.action);
      }
      if (filters.resource) {
        logs = logs.filter(l => l.resource === filters.resource);
      }
      if (filters.status) {
        logs = logs.filter(l => l.status === filters.status);
      }
    }

    // 按时间倒序
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = logs.length;
    if (filters?.limit) {
      const offset = filters.offset || 0;
      logs = logs.slice(offset, offset + filters.limit);
    }

    return { logs, total };
  }

  // Scheduled Tasks
  async createTask(task: Omit<ScheduledTaskData, 'id' | 'created_at' | 'updated_at'>): Promise<ScheduledTaskData> {
    await this.db.read();
    const newTask: ScheduledTaskData = {
      ...task,
      id: `task_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.db.data.scheduled_tasks.push(newTask);
    await this.db.write();
    return newTask;
  }

  async getTaskById(id: string): Promise<ScheduledTaskData | undefined> {
    await this.db.read();
    return this.db.data.scheduled_tasks.find(t => t.id === id);
  }

  async updateTask(id: string, updates: Partial<ScheduledTaskData>): Promise<void> {
    await this.db.read();
    const index = this.db.data.scheduled_tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.db.data.scheduled_tasks[index] = {
        ...this.db.data.scheduled_tasks[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      await this.db.write();
    }
  }

  async deleteTask(id: string): Promise<void> {
    await this.db.read();
    this.db.data.scheduled_tasks = this.db.data.scheduled_tasks.filter(t => t.id !== id);
    await this.db.write();
  }

  async listTasks(): Promise<ScheduledTaskData[]> {
    await this.db.read();
    return this.db.data.scheduled_tasks;
  }

  // Task Executions
  async createExecution(execution: Omit<TaskExecutionData, 'id'>): Promise<TaskExecutionData> {
    await this.db.read();
    const newExecution: TaskExecutionData = {
      ...execution,
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    this.db.data.task_executions.push(newExecution);
    await this.db.write();
    return newExecution;
  }

  async updateExecution(id: string, updates: Partial<TaskExecutionData>): Promise<void> {
    await this.db.read();
    const index = this.db.data.task_executions.findIndex(e => e.id === id);
    if (index !== -1) {
      this.db.data.task_executions[index] = {
        ...this.db.data.task_executions[index],
        ...updates
      };
      await this.db.write();
    }
  }

  async listExecutions(taskId?: string, limit = 50): Promise<TaskExecutionData[]> {
    await this.db.read();
    let executions = [...this.db.data.task_executions];

    if (taskId) {
      executions = executions.filter(e => e.task_id === taskId);
    }

    // 按开始时间倒序（最新的在最上面）
    executions.sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return timeB - timeA; // 倒序
    });

    // 限制返回数量
    const limited = executions.slice(0, limit);

    return limited;
  }

  // 获取最新的执行记录
  async getLatestExecutions(count: number = 10): Promise<TaskExecutionData[]> {
    await this.db.read();
    let executions = [...this.db.data.task_executions];

    // 按开始时间倒序
    executions.sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return timeB - timeA;
    });

    return executions.slice(0, count);
  }

  // 获取执行统计
  async getExecutionStats(taskId?: string): Promise<{
    total: number;
    success: number;
    failed: number;
    running: number;
  }> {
    await this.db.read();
    let executions = [...this.db.data.task_executions];

    if (taskId) {
      executions = executions.filter(e => e.task_id === taskId);
    }

    const stats = {
      total: executions.length,
      success: executions.filter(e => e.status === 'success').length,
      failed: executions.filter(e => e.status === 'failed').length,
      running: executions.filter(e => e.status === 'running').length
    };

    return stats;
  }

  // Notifications
  async createNotification(notification: Omit<NotificationData, 'id' | 'created_at'>): Promise<NotificationData> {
    await this.db.read();
    const newNotification: NotificationData = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    this.db.data.notifications.push(newNotification);
    await this.db.write();
    return newNotification;
  }

  async listNotifications(unreadOnly = false, limit = 50): Promise<NotificationData[]> {
    await this.db.read();
    let notifications = [...this.db.data.notifications];

    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }

    // 按时间倒序
    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return notifications.slice(0, limit);
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.db.read();
    const notification = this.db.data.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      await this.db.write();
    }
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.db.read();
    this.db.data.notifications.forEach(n => n.read = true);
    await this.db.write();
  }

  async deleteNotification(id: string): Promise<void> {
    await this.db.read();
    this.db.data.notifications = this.db.data.notifications.filter(n => n.id !== id);
    await this.db.write();
  }

  // Websites
  async createWebsite(website: Omit<WebsiteData, 'id' | 'created_at' | 'updated_at'>): Promise<WebsiteData> {
    await this.db.read();
    const newWebsite: WebsiteData = {
      ...website,
      id: `web_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.db.data.websites.push(newWebsite);
    await this.db.write();
    return newWebsite;
  }

  async getWebsiteById(id: string): Promise<WebsiteData | undefined> {
    await this.db.read();
    return this.db.data.websites.find(w => w.id === id);
  }

  async updateWebsite(id: string, updates: Partial<WebsiteData>): Promise<void> {
    await this.db.read();
    const index = this.db.data.websites.findIndex(w => w.id === id);
    if (index !== -1) {
      this.db.data.websites[index] = {
        ...this.db.data.websites[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      await this.db.write();
    }
  }

  async deleteWebsite(id: string): Promise<void> {
    await this.db.read();
    this.db.data.websites = this.db.data.websites.filter(w => w.id !== id);
    await this.db.write();
  }

  async listWebsites(): Promise<WebsiteData[]> {
    await this.db.read();
    return this.db.data.websites;
  }

  // Database Configs
  async createDatabaseConfig(config: Omit<DatabaseConfigData, 'id' | 'created_at'>): Promise<DatabaseConfigData> {
    await this.db.read();
    const newConfig: DatabaseConfigData = {
      ...config,
      id: `dbc_${Date.now()}`,
      created_at: new Date().toISOString()
    };
    this.db.data.databases.push(newConfig);
    await this.db.write();
    return newConfig;
  }

  async updateDatabaseConfig(id: string, updates: Partial<Omit<DatabaseConfigData, 'id' | 'created_at'>>): Promise<DatabaseConfigData | null> {
    await this.db.read();
    const index = this.db.data.databases.findIndex((d: any) => d.id === id);
    if (index !== -1) {
      this.db.data.databases[index] = { ...this.db.data.databases[index], ...updates };
      await this.db.write();
      return this.db.data.databases[index];
    }
    return null;
  }

  async getDatabaseConfigById(id: string): Promise<DatabaseConfigData | undefined> {
    await this.db.read();
    return this.db.data.databases.find(d => d.id === id);
  }

  async listDatabaseConfigs(): Promise<DatabaseConfigData[]> {
    await this.db.read();
    return this.db.data.databases;
  }

  async deleteDatabaseConfig(id: string): Promise<void> {
    await this.db.read();
    this.db.data.databases = this.db.data.databases.filter(d => d.id !== id);
    await this.db.write();
  }

  // Settings
  async getSetting(key: string): Promise<any> {
    await this.db.read();
    return this.db.data.settings[key];
  }

  async setSetting(key: string, value: any): Promise<void> {
    await this.db.read();
    this.db.data.settings[key] = value;
    await this.db.write();
  }

  // Software Configs
  async createSoftwareConfig(config: Omit<SoftwareConfigData, 'id' | 'created_at' | 'updated_at'>): Promise<SoftwareConfigData> {
    await this.db.read();
    const newConfig: SoftwareConfigData = {
      ...config,
      id: `sw_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.db.data.software_configs.push(newConfig);
    await this.db.write();
    return newConfig;
  }

  async getSoftwareConfigById(id: string): Promise<SoftwareConfigData | undefined> {
    await this.db.read();
    return this.db.data.software_configs.find(s => s.id === id);
  }

  async getSoftwareConfigByName(name: string): Promise<SoftwareConfigData | undefined> {
    await this.db.read();
    return this.db.data.software_configs.find(s => s.name === name);
  }

  async updateSoftwareConfig(id: string, updates: Partial<Omit<SoftwareConfigData, 'id' | 'created_at' | 'updated_at'>>): Promise<SoftwareConfigData | null> {
    await this.db.read();
    const index = this.db.data.software_configs.findIndex(s => s.id === id);
    if (index !== -1) {
      this.db.data.software_configs[index] = {
        ...this.db.data.software_configs[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      await this.db.write();
      return this.db.data.software_configs[index];
    }
    return null;
  }

  async deleteSoftwareConfig(id: string): Promise<void> {
    await this.db.read();
    this.db.data.software_configs = this.db.data.software_configs.filter(s => s.id !== id);
    await this.db.write();
  }

  async listSoftwareConfigs(includeDisabled = false): Promise<SoftwareConfigData[]> {
    await this.db.read();

    // 确保 software_configs 字段存在
    if (!this.db.data.software_configs) {
      this.db.data.software_configs = [];
      await this.db.write();
    }

    let configs = [...this.db.data.software_configs];

    if (!includeDisabled) {
      configs = configs.filter(s => s.enabled);
    }

    // 按排序字段排序
    configs.sort((a, b) => a.sort_order - b.sort_order);

    return configs;
  }

  async updateSoftwareStatus(id: string, status: 'running' | 'stopped' | 'unknown'): Promise<void> {
    await this.db.read();
    const config = this.db.data.software_configs.find(s => s.id === id);
    if (config) {
      config.status = status;
      config.updated_at = new Date().toISOString();
      await this.db.write();
    }
  }

  async updateSoftwareInstalled(id: string, installed: boolean, version?: string): Promise<void> {
    await this.db.read();
    const config = this.db.data.software_configs.find(s => s.id === id);
    if (config) {
      config.installed = installed;
      if (version) {
        config.version = version;
      }
      config.updated_at = new Date().toISOString();
      await this.db.write();
    }
  }
}

// 导出单例
export const db = new DatabaseService();
