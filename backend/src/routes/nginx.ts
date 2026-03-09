import { Router, Request, Response } from 'express';
import { requirePermission, AuthRequest } from '../middlewares/permission';
import { nginxService } from '../services/nginxService';
import { db } from '../services/database';

const router = Router();

// 获取 Nginx 状态
router.get('/status', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const [installed, version, status] = await Promise.all([
      nginxService.isInstalled(),
      nginxService.getVersion(),
      nginxService.getStatus(),
    ]);

    res.json({
      installed,
      version,
      running: status.running,
      pid: status.pid,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 启动 Nginx
router.post('/start', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await nginxService.start();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 停止 Nginx
router.post('/stop', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await nginxService.stop();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 重启 Nginx
router.post('/restart', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await nginxService.restart();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 重新加载 Nginx 配置
router.post('/reload', requirePermission('system', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await nginxService.reload();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 测试 Nginx 配置
router.post('/test', requirePermission('system', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await nginxService.testConfig();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有站点
router.get('/sites', requirePermission('websites', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    // 获取数据库中的网站列表
    const websites = await db.listWebsites();

    // 获取 Nginx 的站点列表
    const [enabledSites, availableSites] = await Promise.all([
      nginxService.getEnabledSites(),
      nginxService.getAvailableSites(),
    ]);

    // 组合数据，添加 Nginx 配置状态
    const sitesWithStatus = websites.map((website: any) => {
      // 在开发模式下，假设所有网站都已配置和启用
      const isDev = process.env.NODE_ENV === 'development';
      return {
        id: website.id,
        domain: website.domain,
        type: website.type,
        rootDir: website.root_dir,
        port: website.port,
        ssl: website.ssl,
        enabled: isDev || enabledSites.includes(website.domain),
        hasConfig: isDev || availableSites.includes(website.domain),
        createdAt: website.created_at,
      };
    });

    res.json({
      sites: sitesWithStatus,
      enabled: enabledSites,
      available: availableSites,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取指定网站的 Nginx 配置
router.get('/sites/:domain/config', requirePermission('websites', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { domain } = req.params;

    // 从数据库获取网站信息
    const websites = await db.listWebsites();
    const website = websites.find((w: any) => w.domain === domain);

    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }

    // 生成 Nginx 配置
    const config = nginxService.generateConfigContent({
      domain: website.domain,
      rootDir: website.root_dir,
      type: website.type,
      port: website.port,
      phpVersion: website.php_version,
      javaVersion: website.java_version,
      proxyConfig: website.proxy_config,
      ssl: website.ssl,
      sslCertPath: undefined,
      sslKeyPath: undefined,
    });

    res.json({
      domain,
      config,
      canEdit: true,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 更新指定网站的 Nginx 配置
router.put('/sites/:domain/config', requirePermission('websites', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { domain } = req.params;
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({ error: '配置内容不能为空' });
    }

    // 从数据库获取网站信息
    const websites = await db.listWebsites();
    const website = websites.find((w: any) => w.domain === domain);

    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }

    // 保存自定义配置
    const result = await nginxService.saveCustomConfig(domain, config);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // 测试配置
    const testResult = await nginxService.testConfig();
    if (!testResult.success) {
      return res.status(400).json({
        error: '配置测试失败',
        details: testResult.error
      });
    }

    // 重新加载 Nginx
    const reloadResult = await nginxService.reload();
    if (!reloadResult.success) {
      return res.status(500).json({ error: '配置已保存，但重新加载失败: ' + reloadResult.error });
    }

    res.json({
      success: true,
      message: 'Nginx 配置已更新并重新加载'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 恢复指定网站的默认配置
router.post('/sites/:domain/reset-config', requirePermission('websites', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { domain } = req.params;

    // 从数据库获取网站信息
    const websites = await db.listWebsites();
    const website = websites.find((w: any) => w.domain === domain);

    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }

    // 删除自定义配置，重新生成默认配置
    await nginxService.deleteCustomConfig(domain);

    // 生成并保存默认配置
    const result = await nginxService.createConfig({
      domain: website.domain,
      rootDir: website.root_dir,
      type: website.type,
      port: website.port,
      phpVersion: website.php_version,
      javaVersion: website.java_version,
      proxyConfig: website.proxy_config,
      ssl: website.ssl,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: '已恢复默认配置'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 启用网站
router.post('/sites/:domain/enable', requirePermission('websites', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { domain } = req.params;

    const result = await nginxService.enableSite(domain);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: result.message || '网站已启用'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 停用网站
router.post('/sites/:domain/disable', requirePermission('websites', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { domain } = req.params;

    const result = await nginxService.disableSite(domain);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: result.message || '网站已停用'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
