import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { requirePermission, AuthRequest } from '../middlewares/permission';

const router = Router();

interface DashboardWidget {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'uptime' | 'processes';
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
  config?: {
    refreshInterval?: number;
    alertThreshold?: number;
    alertType?: 'above' | 'below';
  };
}

interface DashboardConfig {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

// Get dashboard configurations
router.get('/configs', async (req: Request, res: Response) => {
  try {
    const configs = await db.getSetting('dashboard_configs') || [];
    res.json(configs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get default dashboard configuration
router.get('/default', async (req: Request, res: Response) => {
  try {
    const configs = await db.getSetting('dashboard_configs') || [];
    const defaultConfig = configs.find((c: DashboardConfig) => c.isDefault);

    if (!defaultConfig) {
      // 返回默认配置
      res.json(getDefaultDashboardConfig());
    } else {
      res.json(defaultConfig);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save dashboard configuration
router.post('/configs', async (req: Request, res: Response) => {
  try {
    const { name, widgets, isDefault = false } = req.body;

    if (!name || !widgets) {
      return res.status(400).json({ error: 'Name and widgets are required' });
    }

    const configs = await db.getSetting('dashboard_configs') || [];

    const newConfig: DashboardConfig = {
      id: `dash_${Date.now()}`,
      name,
      isDefault,
      widgets,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 如果设置为默认，清除其他默认配置
    if (isDefault) {
      configs.forEach((c: DashboardConfig) => c.isDefault = false);
    }

    configs.push(newConfig);
    await db.setSetting('dashboard_configs', configs);

    res.json(newConfig);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update dashboard configuration
router.put('/configs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, widgets, isDefault } = req.body;

    const configs = await db.getSetting('dashboard_configs') || [];
    const configIndex = configs.findIndex((c: DashboardConfig) => c.id === id);

    if (configIndex === -1) {
      return res.status(404).json({ error: 'Dashboard configuration not found' });
    }

    // 更新配置
    configs[configIndex] = {
      ...configs[configIndex],
      name: name || configs[configIndex].name,
      widgets: widgets || configs[configIndex].widgets,
      isDefault: isDefault !== undefined ? isDefault : configs[configIndex].isDefault,
      updated_at: new Date().toISOString()
    };

    // 如果设置为默认，清除其他默认配置
    if (configs[configIndex].isDefault) {
      configs.forEach((c: DashboardConfig, i: number) => {
        if (i !== configIndex) c.isDefault = false;
      });
    }

    await db.setSetting('dashboard_configs', configs);

    res.json(configs[configIndex]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete dashboard configuration
router.delete('/configs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let configs = await db.getSetting('dashboard_configs') || [];
    const configIndex = configs.findIndex((c: DashboardConfig) => c.id === id);

    if (configIndex === -1) {
      return res.status(404).json({ error: 'Dashboard configuration not found' });
    }

    configs = configs.filter((c: DashboardConfig) => c.id !== id);
    await db.setSetting('dashboard_configs', configs);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set default dashboard
router.post('/configs/:id/set-default', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const configs = await db.getSetting('dashboard_configs') || [];
    const configIndex = configs.findIndex((c: DashboardConfig) => c.id === id);

    if (configIndex === -1) {
      return res.status(404).json({ error: 'Dashboard configuration not found' });
    }

    // 设置为默认，清除其他默认配置
    configs.forEach((c: DashboardConfig) => c.isDefault = false);
    configs[configIndex].isDefault = true;
    configs[configIndex].updated_at = new Date().toISOString();

    await db.setSetting('dashboard_configs', configs);

    res.json(configs[configIndex]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get alert history
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = await db.getSetting('dashboard_alerts') || [];

    // 按时间倒序，返回最近的 alert
    const sortedAlerts = alerts
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, parseInt(limit as string));

    res.json(sortedAlerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add alert (内部使用)
router.post('/alerts', async (req: Request, res: Response) => {
  try {
    const { type, message, value, threshold } = req.body;

    const alerts = await db.getSetting('dashboard_alerts') || [];

    const newAlert = {
      id: `alert_${Date.now()}`,
      type,
      message,
      value,
      threshold,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    alerts.push(newAlert);

    // 限制 alert 数量，保留最近 1000 条
    if (alerts.length > 1000) {
      alerts.splice(0, alerts.length - 1000);
    }

    await db.setSetting('dashboard_alerts', alerts);

    res.json(newAlert);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge alert
router.put('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alerts = await db.getSetting('dashboard_alerts') || [];
    const alertIndex = alerts.findIndex((a: any) => a.id === id);

    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    alerts[alertIndex].acknowledged = true;
    alerts[alertIndex].acknowledgedAt = new Date().toISOString();

    await db.setSetting('dashboard_alerts', alerts);

    res.json(alerts[alertIndex]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all acknowledged alerts
router.delete('/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await db.getSetting('dashboard_alerts') || [];
    const unacknowledgedAlerts = alerts.filter((a: any) => !a.acknowledged);

    await db.setSetting('dashboard_alerts', unacknowledgedAlerts);

    res.json({ success: true, count: alerts.length - unacknowledgedAlerts.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getDefaultDashboardConfig(): DashboardConfig {
  return {
    id: 'default',
    name: '默认监控面板',
    isDefault: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    widgets: [
      {
        id: 'widget_cpu',
        type: 'cpu',
        title: 'CPU 使用率',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        enabled: true,
        config: {
          refreshInterval: 2000,
          alertThreshold: 80,
          alertType: 'above'
        }
      },
      {
        id: 'widget_memory',
        type: 'memory',
        title: '内存使用率',
        x: 6,
        y: 0,
        w: 6,
        h: 4,
        enabled: true,
        config: {
          refreshInterval: 2000,
          alertThreshold: 85,
          alertType: 'above'
        }
      },
      {
        id: 'widget_disk',
        type: 'disk',
        title: '磁盘使用率',
        x: 12,
        y: 0,
        w: 6,
        h: 4,
        enabled: true,
        config: {
          refreshInterval: 5000,
          alertThreshold: 90,
          alertType: 'above'
        }
      },
      {
        id: 'widget_network',
        type: 'network',
        title: '网络流量',
        x: 18,
        y: 0,
        w: 6,
        h: 4,
        enabled: true,
        config: {
          refreshInterval: 2000
        }
      },
      {
        id: 'widget_uptime',
        type: 'uptime',
        title: '系统运行时间',
        x: 0,
        y: 4,
        w: 12,
        h: 3,
        enabled: true,
        config: {
          refreshInterval: 10000
        }
      },
      {
        id: 'widget_processes',
        type: 'processes',
        title: '进程信息',
        x: 12,
        y: 4,
        w: 12,
        h: 3,
        enabled: true,
        config: {
          refreshInterval: 5000
        }
      }
    ]
  };
}

export default router;
