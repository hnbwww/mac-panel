import { Router, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import { systemInfoService } from '../services/systemInfoService';
import { requirePermission, AuthRequest } from '../middlewares/permission';

const router = Router();

// 获取完整系统信息
router.get('/info', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await systemInfoService.getSystemStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取 CPU 信息
router.get('/cpu', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const cpuInfo = await systemInfoService.getCpuInfo();
    res.json(cpuInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取内存信息
router.get('/memory', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const memInfo = await systemInfoService.getMemoryInfo();
    res.json(memInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取磁盘信息
router.get('/disk', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const diskInfo = await systemInfoService.getDiskInfo();
    res.json(diskInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取网络信息
router.get('/network', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const netInfo = await systemInfoService.getNetworkInfo();
    res.json(netInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取进程列表
router.get('/processes', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const sort = (req.query.sort as string) === 'cpu' ? 'cpu' :
                 (req.query.sort as string) === 'mem' ? 'mem' : undefined;

    const result = await systemInfoService.getProcesses(limit, sort);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取指定进程信息
router.get('/processes/:pid', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const pid = parseInt(req.params.pid);
    const info = await systemInfoService.getProcessInfo(pid);
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 终止进程
router.delete('/processes/:pid', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const pid = parseInt(req.params.pid);
    const signal = req.query.signal as string;

    const success = await systemInfoService.killProcess(pid, signal);

    if (success) {
      res.json({ success: true, message: `Process ${pid} killed successfully` });
    } else {
      res.status(500).json({ error: `Failed to kill process ${pid}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取系统时间
router.get('/time', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const timeInfo = await systemInfoService.getSystemTime();
    res.json(timeInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取电池信息
router.get('/battery', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const batteryInfo = await systemInfoService.getBatteryInfo();
    res.json(batteryInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取系统信息摘要
router.get('/summary', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const [stats, batteryInfo] = await Promise.all([
      systemInfoService.getSystemStats(),
      systemInfoService.getBatteryInfo()
    ]);

    res.json({
      cpu: {
        usage: Math.round(stats.cpu.usage * 100) / 100,
        cores: stats.cpu.cores,
        loadAverage: stats.cpu.loadAverage.map(l => Math.round(l * 100) / 100)
      },
      memory: {
        total: stats.memory.total,
        used: stats.memory.used,
        free: stats.memory.free,
        usage: Math.round(stats.memory.usage * 100) / 100
      },
      disk: {
        total: stats.disk.total,
        used: stats.disk.used,
        free: stats.disk.free,
        usage: Math.round(stats.disk.usage * 100) / 100,
        partitions: stats.disk.partitions.map(p => ({
          mount: p.mount,
          size: p.size,
          used: p.used,
          free: p.free,
          usage: Math.round(p.usage * 100) / 100
        }))
      },
      network: {
        rx: stats.network.rx,
        tx: stats.network.tx,
        interfaces: stats.network.interfaces.map(i => ({
          name: i.name,
          rx: i.rx,
          tx: i.tx
        }))
      },
      system: {
        platform: stats.system.platform,
        arch: stats.system.arch,
        hostname: stats.system.hostname,
        uptime: await systemInfoService.getSystemUptime(),
        release: stats.system.release
      },
      battery: batteryInfo.hasBattery ? {
        isCharging: batteryInfo.isCharging,
        percent: batteryInfo.percent
      } : undefined
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 重启服务
router.post('/restart-services', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { services } = req.body; // services: ['backend', 'frontend'] or 'all'

    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const path = require('path');
    const fs = require('fs');

    // 获取项目根目录（从当前文件位置向上查找）
    const currentDir = __dirname;
    const projectRoot = path.resolve(currentDir, '../..');

    const results: any = {
      success: true,
      restarted: [],
      errors: [],
      projectRoot
    };

    // 重启后端服务
    if (services === 'all' || services?.includes('backend')) {
      try {
        const backendDir = path.join(projectRoot, 'backend');
        const pidFile = path.join(projectRoot, 'backend.pid');
        const logFile = path.join(backendDir, 'backend.log');

        // 读取当前PID
        let oldPid = null;
        try {
          oldPid = fs.readFileSync(pidFile, 'utf8').trim();
        } catch (e) {}

        // 停止旧进程
        if (oldPid) {
          try {
            process.kill(parseInt(oldPid), 'SIGTERM');
          } catch (e) {
            // 忽略错误
          }
        }

        // 等待一下
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 启动新进程（使用自适应路径）
        const startCommand = `cd "${backendDir}" && nohup npm run dev > "${logFile}" 2>&1 & echo $! > "${pidFile}"`;
        await execPromise(startCommand);

        results.restarted.push('backend');
      } catch (error: any) {
        results.errors.push({ service: 'backend', error: error.message });
      }
    }

    // 重启前端服务
    if (services === 'all' || services?.includes('frontend')) {
      try {
        const frontendDir = path.join(projectRoot, 'frontend');
        const pidFile = path.join(projectRoot, 'frontend.pid');
        const logFile = path.join(projectRoot, 'frontend.log');

        // 查找并停止vite进程
        const { stdout } = await execPromise('ps aux | grep "vite" | grep -v grep | awk \'{print $2}\'');
        const pids = stdout.trim().split('\n').filter(Boolean);

        for (const pid of pids) {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
          } catch (e) {
            // 忽略错误
          }
        }

        // 等待一下
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 启动新进程（使用自适应路径）
        const startCommand = `cd "${frontendDir}" && nohup npm run dev > "${logFile}" 2>&1 & echo $! > "${pidFile}"`;
        await execPromise(startCommand);

        results.restarted.push('frontend');
      } catch (error: any) {
        results.errors.push({ service: 'frontend', error: error.message });
      }
    }

    // 记录操作
    await require('../middlewares/auditLog').logOperation(
      req.userId || 'unknown',
      req.username || 'unknown',
      'restart-services',
      'system',
      { services, results },
      req.ip || 'unknown',
      results.errors.length > 0 ? 'partial' : 'success'
    );

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取服务状态
router.get('/services-status', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const path = require('path');
    const fs = require('fs');

    // 获取项目根目录
    const projectRoot = path.resolve(__dirname, '../..');

    const status: any = {
      backend: { running: false, pid: null },
      frontend: { running: false, pid: null },
      projectRoot
    };

    // 检查后端状态
    try {
      const backendPidFile = path.join(projectRoot, 'backend.pid');
      const backendPid = fs.readFileSync(backendPidFile, 'utf8').trim();
      const { stdout } = await execPromise(`ps -p ${backendPid} -o comm=`);
      if (stdout.trim().includes('node')) {
        status.backend = { running: true, pid: backendPid };
      }
    } catch (e) {
      status.backend = { running: false, pid: null };
    }

    // 检查前端状态
    try {
      const { stdout } = await execPromise('ps aux | grep "vite" | grep -v grep | awk \'{print $2}\' | head -1');
      const frontendPid = stdout.trim();
      if (frontendPid) {
        status.frontend = { running: true, pid: frontendPid };
      }
    } catch (e) {
      status.frontend = { running: false, pid: null };
    }

    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

// WebSocket 系统状态推送
export function setupSystemStatsWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws, req) => {
    // 验证 token
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

        // 添加到客户端列表
        systemInfoService.addWebSocketClient(ws);

        ws.send(JSON.stringify({
          type: 'connected',
          message: 'System stats connection established'
        }));
      } catch (e) {
        ws.close();
      }
    } else {
      ws.close();
    }
  });
}
