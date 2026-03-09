import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { db } from '../services/database';
import { requirePermission } from '../middlewares/permission';

const execAsync = promisify(exec);
const router = Router();

interface AuthRequest extends Request {
  user?: any;
}

// 工具函数：执行命令
async function executeCommand(command: string, timeout = 30000): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout });
    return {
      success: true,
      output: stdout || stderr,
    };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      output: err.stdout || '',
      error: err.stderr || err.message || '命令执行失败',
    };
  }
}

// 获取所有软件列表（从数据库）
router.get('/list', async (req: AuthRequest, res: Response) => {
  try {
    const configs = await db.listSoftwareConfigs(false);

    // 转换为前端需要的格式，并检查状态
    const softwareList = await Promise.all(
      configs.map(async (config) => {
        // 实时检测软件是否已安装
        let isInstalled = config.installed;
        if ('check_installed' in config.commands && config.commands.check_installed) {
          try {
            const installCheck = await executeCommand(config.commands.check_installed as string, 5000);
            if (installCheck.success && installCheck.output.trim()) {
              isInstalled = true;
            } else {
              isInstalled = false;
            }
          } catch (e) {
            isInstalled = false;
          }
        }

        const software = {
          id: config.name,
          name: config.name,
          displayName: config.display_name,
          description: config.description,
          category: config.category,
          installed: isInstalled,
          version: config.version,
          status: config.status,
          configPath: config.config_path,
          availableVersions: config.available_versions,
          requiresPassword: config.requires_password,
          defaultPassword: config.default_password,
          icon: config.icon,
          commands: config.commands,
          logPaths: config.log_paths,
        };

        // 实时检查软件状态
        // 对于服务器和数据库软件，优先使用brew services检测
        if (config.category === 'server' || config.category === 'database') {
          if ('check_service' in config.commands && config.commands.check_service) {
            try {
              const serviceResult = await executeCommand(config.commands.check_service as string, 3000);
              if (serviceResult.success) {
                const output = serviceResult.output.trim();
                // brew services list 输出格式: "service-name  started  user path"
                // 检查是否包含started状态
                if (output.includes('started') && !output.includes('error') && !output.includes('stopped')) {
                  software.status = 'running';
                } else if (output.includes('stopped') || output.includes('none') || output.includes('error')) {
                  software.status = 'stopped';
                }
              }
            } catch (error) {
              // brew services检测失败，继续使用其他方法
              console.log(`[Software] Brew services check failed for ${config.name}:`, error);
            }
          }
        }

        // 使用status命令作为备用检测方法
        if (software.status === 'unknown' && config.commands.status) {
          const result = await executeCommand(config.commands.status);
          if (result.success) {
            const output = result.output.toLowerCase();

            // 检测运行状态
            if (output.includes('running') ||
                output.includes('started') ||
                output.includes('active') ||
                output.includes('is running') ||
                output.includes('pid:') ||
                (output.includes('started') && output.includes('status'))) {
              software.status = 'running';
            }
            // 检测停止状态
            else if (output.includes('stopped') ||
                     output.includes('inactive') ||
                     output.includes('not running') ||
                     output.includes('not installed') ||
                     output.includes('error:')) {
              software.status = 'stopped';
            }
            // 对于命令有输出但没有明确状态的情况，认为正在运行
            else if (output.trim().length > 0) {
              software.status = 'running';
            }
          }
        }

        // 对于某些特殊软件，使用进程检测作为补充
        if (config.name === 'nginx' || config.name === 'apache' || config.name === 'mysql' ||
            config.name === 'postgresql' || config.name === 'redis' || config.name === 'mongodb' ||
            config.name === 'caddy' || config.name === 'traefik' || config.name === 'memcached' ||
            config.name === 'influxdb' || config.name === 'rabbitmq' || config.name === 'grafana' ||
            config.name === 'prometheus') {
          try {
            // 尝试多个进程名称和检测方法
            let processFound = false;

            if (config.name === 'postgresql') {
              // PostgreSQL 特殊处理 - 检查 postgres 进程
              const pgResult = await executeCommand('pgrep -x postgres', 3000);
              if (pgResult.success && pgResult.output.trim()) {
                processFound = true;
              } else {
                // 也尝试检查 postmaster 进程
                const postmasterResult = await executeCommand('pgrep -x postmaster', 3000);
                if (postmasterResult.success && postmasterResult.output.trim()) {
                  processFound = true;
                }
              }

              // 检查 PostgreSQL 数据目录是否有进程
              if (!processFound) {
                const psResult = await executeCommand('ps aux | grep postgres | grep -v grep', 3000);
                if (psResult.success && psResult.output.trim()) {
                  processFound = true;
                }
              }
            }
            else if (config.name === 'mysql') {
              // MySQL 特殊处理
              const mysqlResult = await executeCommand('pgrep -x mysqld', 3000);
              if (mysqlResult.success && mysqlResult.output.trim()) {
                processFound = true;
              }
            }
            else if (config.name === 'redis') {
              // Redis 特殊处理
              const redisResult = await executeCommand('pgrep -x redis-server', 3000);
              if (!redisResult.success || !redisResult.output.trim()) {
                const redisResult2 = await executeCommand('pgrep -x redis', 3000);
                if (redisResult2.success && redisResult2.output.trim()) {
                  processFound = true;
                }
              } else {
                processFound = true;
              }
            }
            else if (config.name === 'mongodb') {
              // MongoDB 特殊处理
              const mongoResult = await executeCommand('pgrep -x mongod', 3000);
              if (mongoResult.success && mongoResult.output.trim()) {
                processFound = true;
              }
            }
            else {
              // 其他软件的通用进程检测
              const processNames = [config.name];
              if (config.name === 'rabbitmq') processNames.push('beam.smp');

              for (const procName of processNames) {
                const processResult = await executeCommand(`pgrep -x "${procName}"`, 3000);
                if (processResult.success && processResult.output.trim()) {
                  processFound = true;
                  break;
                }
              }
            }

            if (processFound) {
              software.status = 'running';
            } else if (software.status === 'unknown') {
              software.status = 'stopped';
            }
          } catch {
            // 进程检测失败，保持原状态
          }
        }

        // OpenClaw 特殊处理
        if (config.name === 'openclaw') {
          try {
            // 检查 OpenClaw gateway 进程
            const gatewayResult = await executeCommand('pgrep -f "openclaw.gateway"', 3000);
            if (gatewayResult.success && gatewayResult.output.trim()) {
              software.status = 'running';
            } else {
              // 检查 launchctl 是否加载
              const launchctlResult = await executeCommand('launchctl list | grep openclaw.gateway', 3000);
              if (launchctlResult.success && launchctlResult.output.includes('openclaw.gateway')) {
                // 已加载但可能未运行，尝试更详细的检查
                const statusResult = await executeCommand('launchctl list | grep openclaw.gateway | grep -v "PID" | awk \'{print $2}\'', 3000);
                if (statusResult.success && statusResult.output.trim() !== '0') {
                  software.status = 'running';
                } else {
                  software.status = 'stopped';
                }
              } else {
                software.status = 'stopped';
              }
            }
          } catch {
            software.status = 'stopped';
          }
        }

        // 检查安装状态（使用增强的检测命令）
        if (!software.installed) {
          let isInstalled = false;
          let detectedVersion = '';

          // 优先使用专门的 check_installed 命令（如果存在）
          if ('check_installed' in config.commands && config.commands.check_installed) {
            const installResult = await executeCommand(config.commands.check_installed as string, 5000);
            if (installResult.success && installResult.output.trim()) {
              // 从输出中提取版本号
              const output = installResult.output;

              // 根据不同软件的输出格式提取版本
              if (config.name === 'postgresql') {
                const match = output.match(/PostgreSQL ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'mysql') {
                const match = output.match(/Ver ([\d.]+)/);
                if (match) detectedVersion = match[1];
                else {
                  const match2 = output.match(/Distrib ([\d.]+)/);
                  if (match2) detectedVersion = match2[1];
                }
              } else if (config.name === 'redis') {
                const match = output.match(/v=([\d.]+)/);
                if (match) detectedVersion = match[1];
                else {
                  const match2 = output.match(/redis-cli ([\d.]+)/);
                  if (match2) detectedVersion = match2[1];
                }
              } else if (config.name === 'node') {
                const match = output.match(/v([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'python') {
                const match = output.match(/([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'go') {
                const match = output.match(/go([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'rust') {
                const match = output.match(/rustc ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'ruby') {
                const match = output.match(/ruby ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'java') {
                const match = output.match(/"([\d.]+)"/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'php') {
                const match = output.match(/PHP ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'docker') {
                const match = output.match(/Docker version ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'mongodb') {
                const match = output.match(/db version v([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'nginx') {
                const match = output.match(/nginx\/([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'apache') {
                const match = output.match(/Apache\/([\d.]+)/);
                if (match) detectedVersion = match[1];
                else {
                  const match2 = output.match(/Server version: ([\d.]+)/);
                  if (match2) detectedVersion = match2[1];
                }
              } else if (config.name === 'caddy') {
                const match = output.match(/v([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'traefik') {
                const match = output.match(/Version:([\s]+)?([\d.]+)/);
                if (match) detectedVersion = match[2];
              } else if (config.name === 'sqlite') {
                const match = output.match(/([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'memcached') {
                const match = output.match(/memcached ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'influxdb') {
                const match = output.match(/Influx CLI ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'git') {
                const match = output.match(/git version ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'claude-code') {
                const match = output.match(/@anthropic-ai\/claude-code@([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else {
                // 通用版本匹配
                const match = output.match(/([\d.]+(?:[\d.]+)*)/);
                if (match) detectedVersion = match[0];
              }

              if (detectedVersion || output.length > 0) {
                isInstalled = true;
              }
            }
          }
          // 回退到使用 version 命令
          else if (config.commands.version) {
            const versionResult = await executeCommand(config.commands.version, 5000);
            if (versionResult.success && versionResult.output.trim()) {
              const output = versionResult.output;

              // 使用相同的版本提取逻辑
              if (config.name === 'postgresql') {
                const match = output.match(/PostgreSQL ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'mysql') {
                const match = output.match(/Ver ([\d.]+)/);
                if (match) detectedVersion = match[1];
                else {
                  const match2 = output.match(/Distrib ([\d.]+)/);
                  if (match2) detectedVersion = match2[1];
                }
              } else if (config.name === 'redis') {
                const match = output.match(/v=([\d.]+)/);
                if (match) detectedVersion = match[1];
                else {
                  const match2 = output.match(/redis-cli ([\d.]+)/);
                  if (match2) detectedVersion = match2[1];
                }
              } else if (config.name === 'php') {
                const match = output.match(/PHP ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'mongodb') {
                const match = output.match(/db version v([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'nginx') {
                const match = output.match(/nginx\/([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'apache') {
                const match = output.match(/Apache\/([\d.]+)/);
                if (match) detectedVersion = match[1];
                else {
                  const match2 = output.match(/Server version: ([\d.]+)/);
                  if (match2) detectedVersion = match2[1];
                }
              } else if (config.name === 'caddy') {
                const match = output.match(/v([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'traefik') {
                const match = output.match(/Version:([\s]+)?([\d.]+)/);
                if (match) detectedVersion = match[2];
              } else if (config.name === 'sqlite') {
                const match = output.match(/([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'memcached') {
                const match = output.match(/memcached ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else if (config.name === 'influxdb') {
                const match = output.match(/Influx CLI ([\d.]+)/);
                if (match) detectedVersion = match[1];
              } else {
                const match = output.match(/([\d.]+(?:[\d.]+)*)/);
                if (match) detectedVersion = match[0];
              }

              if (detectedVersion) {
                isInstalled = true;
              }
            }
          }

          // 更新安装状态
          if (isInstalled && !software.installed) {
            software.installed = true;
            if (detectedVersion) {
              software.version = detectedVersion;
            }
            // 更新数据库
            await db.updateSoftwareInstalled(config.id, true, detectedVersion);
          }
        }

        return software;
      })
    );

    res.json(softwareList);
  } catch (error: unknown) {
    console.error('获取软件列表失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '获取软件列表失败: ' + err.message });
  }
});

// 获取单个软件配置
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    res.json({
      id: config.name,
      name: config.name,
      displayName: config.display_name,
      description: config.description,
      category: config.category,
      installed: config.installed,
      version: config.version,
      status: config.status,
      configPath: config.config_path,
      availableVersions: config.available_versions,
      requiresPassword: config.requires_password,
      defaultPassword: config.default_password,
      icon: config.icon,
      commands: config.commands,
      logPaths: config.log_paths,
    });
  } catch (error: unknown) {
    console.error('获取软件配置失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '获取软件配置失败: ' + err.message });
  }
});

// 安装软件
router.post('/install/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    let installCommand = config.commands.install || '';
    const { version, password } = req.body;

    // 如果指定了版本，修改安装命令
    if (version && config.available_versions && config.available_versions.includes(version)) {
      installCommand = installCommand.replace(config.name, `${config.name}@${version}`);
    }

    if (!installCommand) {
      return res.status(400).json({ error: '该软件未配置安装命令' });
    }

    const result = await executeCommand(installCommand, 300000); // 5 minutes

    if (result.success) {
      // 更新安装状态
      await db.updateSoftwareInstalled(config.id, true, version);

      res.json({
        success: true,
        message: `${config.display_name} 安装成功`,
        output: result.output,
      });
    } else {
      res.status(500).json({
        success: false,
        message: `${config.display_name} 安装失败`,
        error: result.error,
        output: result.output,
      });
    }
  } catch (error: unknown) {
    console.error('安装软件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '安装软件失败: ' + err.message });
  }
});

// 卸载软件
router.post('/uninstall/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const uninstallCommand = config.commands.uninstall;
    if (!uninstallCommand) {
      return res.status(400).json({ error: '该软件未配置卸载命令' });
    }

    const result = await executeCommand(uninstallCommand, 300000);

    if (result.success) {
      // 更新安装状态
      await db.updateSoftwareInstalled(config.id, false);

      res.json({
        success: true,
        message: `${config.display_name} 卸载成功`,
        output: result.output,
      });
    } else {
      res.status(500).json({
        success: false,
        message: `${config.display_name} 卸载失败`,
        error: result.error,
        output: result.output,
      });
    }
  } catch (error: unknown) {
    console.error('卸载软件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '卸载软件失败: ' + err.message });
  }
});

// 启动软件
router.post('/start/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const startCommand = config.commands.start;
    if (!startCommand) {
      return res.status(400).json({ error: '该软件不支持启动操作' });
    }

    const result = await executeCommand(startCommand);

    if (result.success) {
      // 更新状态
      await db.updateSoftwareStatus(config.id, 'running');

      res.json({
        success: true,
        message: `${config.display_name} 启动成功`,
        output: result.output,
      });
    } else {
      res.status(500).json({
        success: false,
        message: `${config.display_name} 启动失败`,
        error: result.error,
        output: result.output,
      });
    }
  } catch (error: unknown) {
    console.error('启动软件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '启动软件失败: ' + err.message });
  }
});

// 停止软件
router.post('/stop/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const stopCommand = config.commands.stop;
    if (!stopCommand) {
      return res.status(400).json({ error: '该软件不支持停止操作' });
    }

    const result = await executeCommand(stopCommand);

    if (result.success) {
      // 更新状态
      await db.updateSoftwareStatus(config.id, 'stopped');

      res.json({
        success: true,
        message: `${config.display_name} 停止成功`,
        output: result.output,
      });
    } else {
      res.status(500).json({
        success: false,
        message: `${config.display_name} 停止失败`,
        error: result.error,
        output: result.output,
      });
    }
  } catch (error: unknown) {
    console.error('停止软件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '停止软件失败: ' + err.message });
  }
});

// 重启软件
router.post('/restart/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const restartCommand = config.commands.restart;
    if (!restartCommand) {
      return res.status(400).json({ error: '该软件不支持重启操作' });
    }

    const result = await executeCommand(restartCommand, 60000);

    if (result.success) {
      // 更新状态
      await db.updateSoftwareStatus(config.id, 'running');

      res.json({
        success: true,
        message: `${config.display_name} 重启成功`,
        output: result.output,
      });
    } else {
      res.status(500).json({
        success: false,
        message: `${config.display_name} 重启失败`,
        error: result.error,
        output: result.output,
      });
    }
  } catch (error: unknown) {
    console.error('重启软件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '重启软件失败: ' + err.message });
  }
});

// 修复软件
router.post('/repair/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const repairCommand = config.commands.repair;
    if (!repairCommand) {
      return res.status(400).json({ error: '该软件不支持修复操作' });
    }

    const result = await executeCommand(repairCommand, 120000);

    if (result.success) {
      res.json({
        success: true,
        message: `${config.display_name} 修复成功`,
        output: result.output,
      });
    } else {
      res.status(500).json({
        success: false,
        message: `${config.display_name} 修复失败`,
        error: result.error,
        output: result.output,
      });
    }
  } catch (error: unknown) {
    console.error('修复软件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '修复软件失败: ' + err.message });
  }
});

// 获取软件日志
router.get('/logs/:id', async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const lines = parseInt(req.query.lines as string) || 100;
    const logType = req.query.type as string || 'application';

    let logPath = '';
    if (logType === 'application' && config.log_paths?.application) {
      logPath = config.log_paths.application.replace('~', process.env.HOME || '/Users/www1');
    } else if (logType === 'error' && config.log_paths?.error) {
      logPath = config.log_paths.error.replace('~', process.env.HOME || '/Users/www1');
    } else if (logType === 'access' && config.log_paths?.access) {
      logPath = config.log_paths.access.replace('~', process.env.HOME || '/Users/www1');
    }

    if (!logPath) {
      return res.status(404).json({ error: '该软件未配置日志路径' });
    }

    // 使用 glob 查找日志文件（支持通配符）
    const glob = require('glob');
    const files = glob.sync(logPath);

    if (files.length === 0) {
      return res.status(404).json({ error: '日志文件不存在' });
    }

    // 读取第一个匹配的文件
    const content = await fs.readFile(files[0], 'utf-8');
    const logLines = content.split('\n');
    const lastLines = logLines.slice(-lines);

    res.json({ logs: lastLines, path: files[0] });
  } catch (error: unknown) {
    console.error('获取软件日志失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '获取软件日志失败: ' + err.message });
  }
});

// 获取软件配置文件
router.get('/config/:id', async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    if (!config.config_path) {
      return res.status(400).json({ error: '该软件不支持配置文件管理' });
    }

    const configPath = config.config_path;
    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: '配置文件不存在' });
    }

    const content = await fs.readFile(configPath, 'utf-8');
    res.send(content);
  } catch (error: unknown) {
    console.error('获取配置文件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '获取配置文件失败: ' + err.message });
  }
});

// 更新软件配置文件
router.put('/config/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: '配置内容不能为空' });
    }

    if (!config.config_path) {
      return res.status(400).json({ error: '该软件不支持配置文件管理' });
    }

    const configPath = config.config_path;

    // 确保配置文件目录存在
    const configDir = path.dirname(configPath);
    await fs.ensureDir(configDir);

    // 如果原配置文件存在，先备份
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copy(configPath, backupPath);
    }

    // 写入新配置
    await fs.writeFile(configPath, content, 'utf-8');

    res.json({
      success: true,
      message: '配置文件更新成功，重启软件后生效',
    });
  } catch (error: unknown) {
    console.error('更新配置文件失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '更新配置文件失败: ' + err.message });
  }
});

// 创建软件配置 (需要管理员权限)
router.post('/', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const softwareData = req.body;

    // 验证必填字段
    if (!softwareData.name || !softwareData.displayName || !softwareData.description) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    // 检查是否已存在同名软件
    const existing = await db.getSoftwareConfigByName(softwareData.name);
    if (existing) {
      return res.status(400).json({ error: '软件名称已存在' });
    }

    const config = await db.createSoftwareConfig({
      name: softwareData.name,
      display_name: softwareData.displayName,
      description: softwareData.description,
      category: softwareData.category || 'other',
      icon: softwareData.icon,
      installed: softwareData.installed || false,
      version: softwareData.version,
      status: softwareData.status || 'unknown',
      config_path: softwareData.configPath,
      available_versions: softwareData.availableVersions,
      requires_password: softwareData.requiresPassword,
      default_password: softwareData.defaultPassword,
      enabled: softwareData.enabled !== undefined ? softwareData.enabled : true,
      sort_order: softwareData.sort_order || 999,
      commands: softwareData.commands || {},
      log_paths: softwareData.logPaths,
    });

    res.json({
      success: true,
      message: '软件配置创建成功',
      data: config,
    });
  } catch (error: unknown) {
    console.error('创建软件配置失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '创建软件配置失败: ' + err.message });
  }
});

// 更新软件配置 (需要管理员权限)
router.put('/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    const updates = req.body;

    // 转换前端字段名到数据库字段名
    const dbUpdates: any = {};
    if (updates.display_name !== undefined) dbUpdates.display_name = updates.display_name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.installed !== undefined) dbUpdates.installed = updates.installed;
    if (updates.version !== undefined) dbUpdates.version = updates.version;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.configPath !== undefined) dbUpdates.config_path = updates.configPath;
    if (updates.availableVersions !== undefined) dbUpdates.available_versions = updates.availableVersions;
    if (updates.requiresPassword !== undefined) dbUpdates.requires_password = updates.requiresPassword;
    if (updates.defaultPassword !== undefined) dbUpdates.default_password = updates.defaultPassword;
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.sort_order !== undefined) dbUpdates.sort_order = updates.sort_order;
    if (updates.commands !== undefined) dbUpdates.commands = updates.commands;
    if (updates.logPaths !== undefined) dbUpdates.log_paths = updates.logPaths;

    const updated = await db.updateSoftwareConfig(config.id, dbUpdates);

    res.json({
      success: true,
      message: '软件配置更新成功',
      data: updated,
    });
  } catch (error: unknown) {
    console.error('更新软件配置失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '更新软件配置失败: ' + err.message });
  }
});

// 删除软件配置 (需要管理员权限)
router.delete('/:id', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName(req.params.id);
    if (!config) {
      return res.status(404).json({ error: '软件配置不存在' });
    }

    await db.deleteSoftwareConfig(config.id);

    res.json({
      success: true,
      message: '软件配置删除成功',
    });
  } catch (error: unknown) {
    console.error('删除软件配置失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '删除软件配置失败: ' + err.message });
  }
});

// OpenClaw 健康检查
router.get('/openclaw/health', async (req: AuthRequest, res: Response) => {
  try {
    const config = await db.getSoftwareConfigByName('openclaw');

    if (!config) {
      return res.status(404).json({ error: 'OpenClaw 配置不存在' });
    }

    const issues: string[] = [];
    let installed = false;
    let running = false;

    // 检查是否安装
    const checkResult = await executeCommand('which openclaw');
    installed = checkResult.success;

    if (!installed) {
      issues.push('OpenClaw 未安装');
      return res.json({ installed: false, running: false, healthy: false, issues });
    }

    // 检查进程是否运行
    const statusResult = await executeCommand('pgrep -f openclaw');
    running = statusResult.success && statusResult.output.trim().length > 0;

    if (!running) {
      issues.push('OpenClaw 进程未运行');
    }

    // 检查状态
    if (running && config.commands.status) {
      const statusCmdResult = await executeCommand(config.commands.status);
      if (statusCmdResult.output.includes('error') || statusCmdResult.output.includes('failed')) {
        issues.push('OpenClaw 状态异常');
      }
    }

    res.json({
      installed,
      running,
      healthy: issues.length === 0,
      issues
    });
  } catch (error: unknown) {
    console.error('OpenClaw 健康检查失败:', error);
    const err = error as Error;
    res.status(500).json({ error: '健康检查失败: ' + err.message });
  }
});

export default router;
