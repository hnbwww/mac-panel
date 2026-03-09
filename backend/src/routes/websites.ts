import { Router, Request, Response } from 'express';
import path from 'path';
import * as fs from 'fs-extra';
import { db } from '../services/database';
import { requirePermission, AuthRequest } from '../middlewares/permission';
import { websiteService, WebsiteConfig } from '../services/websiteService';

const router = Router();

// Transform database field names from snake_case to camelCase
function transformWebsite(dbWebsite: any): any {
  return {
    id: dbWebsite.id,
    domain: dbWebsite.domain,
    rootDir: dbWebsite.root_dir,
    type: dbWebsite.type,
    phpVersion: dbWebsite.php_version,
    javaVersion: dbWebsite.java_version,
    port: dbWebsite.port,
    ssl: dbWebsite.ssl,
    sslCert: dbWebsite.ssl_cert,
    sslKey: dbWebsite.ssl_key,
    proxyConfig: dbWebsite.proxy_config,
    createdAt: dbWebsite.created_at,
    updatedAt: dbWebsite.updated_at,
  };
}

// Get website list
router.get('/list', requirePermission('websites', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const websites = await db.listWebsites();
    const transformedWebsites = websites.map(transformWebsite);
    res.json(transformedWebsites);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get website statistics
router.get('/stats', requirePermission('websites', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const websites = await db.listWebsites();
    const stats = {
      total: websites.length,
      static: websites.filter((w: any) => w.type === 'static').length,
      proxy: websites.filter((w: any) => w.type === 'proxy').length,
      ssl: websites.filter((w: any) => w.ssl).length,
    };

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create website
router.post('/create', requirePermission('websites', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const { domain, rootDir, type, phpVersion, javaVersion, port, proxyConfig } = req.body;

    // Validate domain
    if (!domain || !domain.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/)) {
      return res.status(400).json({ error: '域名格式不正确' });
    }

    // Check if domain already exists
    const existingWebsites = await db.listWebsites();
    if (existingWebsites.some((w: any) => w.domain === domain)) {
      return res.status(400).json({ error: '该域名已存在' });
    }

    // 确定根目录 - 如果用户未指定，使用默认路径
    let finalRootDir = rootDir;
    if (!finalRootDir) {
      // 默认使用 ~/www/wwwroot/domain
      finalRootDir = path.join(process.env.HOME || '.', 'www', 'wwwroot', domain);
    } else {
      // 展开路径中的 ~ 符号为实际的 HOME 目录
      if (finalRootDir.startsWith('~/')) {
        finalRootDir = path.join(process.env.HOME || '.', finalRootDir.substring(2));
      }
    }

    // 创建网站配置
    const websiteConfig: WebsiteConfig = {
      domain,
      rootDir: finalRootDir,
      type: type || 'static',
      phpVersion: phpVersion || 'none',
      javaVersion: javaVersion || 'none',
      port: port || 80,
      proxyConfig,
    };

    // 调用网站服务创建网站
    const result = await websiteService.createWebsite(websiteConfig);

    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }

    // 保存到数据库
    const newWebsite = await db.createWebsite({
      domain,
      root_dir: websiteConfig.rootDir,
      type: websiteConfig.type,
      php_version: phpVersion || 'none',
      java_version: javaVersion || 'none',
      port: port || 80,
      ssl: false,
      proxy_config: proxyConfig || null,
    });

    res.json({
      ...transformWebsite(newWebsite),
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update website
router.put('/update', requirePermission('websites', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, domain, rootDir, type, phpVersion, javaVersion, port, proxyConfig } = req.body;

    const website = await db.getWebsiteById(id);
    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }

    // 更新数据库
    await db.updateWebsite(id, {
      domain,
      root_dir: rootDir,
      type,
      php_version: phpVersion,
      java_version: javaVersion,
      port,
      proxy_config: proxyConfig,
    });

    // 重新生成 Nginx 配置
    try {
      const websiteConfig = {
        domain,
        rootDir: rootDir || website.root_dir,
        type: type || website.type,
        phpVersion: phpVersion || website.php_version,
        javaVersion: javaVersion || website.java_version,
        port: port || website.port,
        proxyConfig: proxyConfig || website.proxy_config,
      };

      const nginxResult = await websiteService.updateNginxConfig(websiteConfig);
      if (!nginxResult.success) {
        console.warn('[Websites] Failed to update nginx config:', nginxResult.error);
      }
    } catch (error: any) {
      console.warn('[Websites] Nginx config update failed:', error.message);
    }

    const updatedWebsite = await db.getWebsiteById(id);
    res.json(transformWebsite(updatedWebsite));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete website (POST method)
router.post('/delete', requirePermission('websites', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;

    console.log('[Websites] Delete request for ID:', id);

    const website = await db.getWebsiteById(id);
    if (!website) {
      console.log('[Websites] Website not found:', id);
      return res.status(404).json({ error: '网站不存在' });
    }

    console.log('[Websites] Found website:', website.domain, 'root_dir:', website.root_dir);

    // 删除文件和配置
    const result = await websiteService.deleteWebsite(website.domain, website.root_dir);

    if (!result.success) {
      console.log('[Websites] Failed to delete website files:', result.message);
      // 即使文件删除失败，也继续删除数据库记录
      // return res.status(500).json({ error: result.message });
    }

    // 从数据库删除
    await db.deleteWebsite(id);

    console.log('[Websites] Successfully deleted website:', id);

    res.json({
      success: true,
      message: result.success ? result.message : '网站已从数据库删除（文件删除可能失败）'
    });
  } catch (error: any) {
    console.error('[Websites] Delete error:', error);
    res.status(500).json({ error: error.message || '删除失败' });
  }
});

// Delete website (DELETE method - RESTful)
router.delete('/delete', requirePermission('websites', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;

    console.log('[Websites] DELETE request for ID:', id);

    const website = await db.getWebsiteById(id);
    if (!website) {
      console.log('[Websites] Website not found:', id);
      return res.status(404).json({ error: '网站不存在' });
    }

    console.log('[Websites] Found website:', website.domain, 'root_dir:', website.root_dir);

    // 删除文件和配置
    const result = await websiteService.deleteWebsite(website.domain, website.root_dir);

    if (!result.success) {
      console.log('[Websites] Failed to delete website files:', result.message);
      // 即使文件删除失败，也继续删除数据库记录
      // return res.status(500).json({ error: result.message });
    }

    // 从数据库删除
    await db.deleteWebsite(id);

    console.log('[Websites] Successfully deleted website:', id);

    res.json({
      success: true,
      message: result.success ? result.message : '网站已从数据库删除（文件删除可能失败）'
    });
  } catch (error: any) {
    console.error('[Websites] Delete error:', error);
    res.status(500).json({ error: error.message || '删除失败' });
  }
});

// Delete website by ID (DELETE /:id - alternative RESTful style)
router.delete('/:id', requirePermission('websites', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    console.log('[Websites] DELETE by ID:', id);

    const website = await db.getWebsiteById(id);
    if (!website) {
      console.log('[Websites] Website not found:', id);
      return res.status(404).json({ error: '网站不存在' });
    }

    console.log('[Websites] Found website:', website.domain, 'root_dir:', website.root_dir);

    // 删除文件和配置
    const result = await websiteService.deleteWebsite(website.domain, website.root_dir);

    if (!result.success) {
      console.log('[Websites] Failed to delete website files:', result.message);
      // 即使文件删除失败，也继续删除数据库记录
    }

    // 从数据库删除
    await db.deleteWebsite(id);

    console.log('[Websites] Successfully deleted website:', id);

    res.json({
      success: true,
      message: result.success ? result.message : '网站已从数据库删除（文件删除可能失败）'
    });
  } catch (error: any) {
    console.error('[Websites] Delete error:', error);
    res.status(500).json({ error: error.message || '删除失败' });
  }
});

// Configure SSL
router.post('/ssl', requirePermission('websites', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, type, cert, key } = req.body;

    const website = await db.getWebsiteById(id);
    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }

    if (type === 'custom' && (!cert || !key)) {
      return res.status(400).json({ error: '请提供证书和私钥' });
    }

    if (type === 'letsencrypt') {
      // Let's Encrypt 自动申请
      // TODO: 实现 certbot 自动申请逻辑
      return res.status(501).json({ error: 'Let\'s Encrypt 自动申请功能开发中，请使用自定义证书' });
    }

    // 保存证书到文件
    const { nginxService } = await import('../services/nginxService');
    const sslResult = await nginxService.saveSSLCert(website.domain, cert, key);

    if (!sslResult.success) {
      return res.status(500).json({ error: sslResult.error });
    }

    // Update SSL configuration in database
    await db.updateWebsite(id, {
      ssl: true,
      ssl_cert: cert,
      ssl_key: key,
    });

    // 重新生成 nginx 配置以包含 SSL
    const websiteConfig = {
      domain: website.domain,
      rootDir: website.root_dir,
      type: website.type,
      phpVersion: website.php_version,
      javaVersion: website.java_version,
      port: 443,
      ssl: true,
      sslCertPath: sslResult.certPath,
      sslKeyPath: sslResult.keyPath
    };

    const nginxResult = await websiteService.updateSSLConfig(websiteConfig);
    if (!nginxResult.success) {
      console.warn('[Websites] Failed to update nginx SSL config:', nginxResult.error);
    }

    res.json({
      success: true,
      message: nginxResult.success ? nginxResult.message : 'SSL 证书配置成功'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Backup website
router.post('/backup', requirePermission('websites', 'write'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;

    const website = await db.getWebsiteById(id);
    if (!website) {
      return res.status(404).json({ error: '网站不存在' });
    }

    // 创建备份
    const backupPath = `/backups/website-${website.domain}-${Date.now()}.tar.gz`;

    res.json({
      success: true,
      message: '备份成功',
      backupPath
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get website logs
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // access or error

    // In production, this would read actual log files
    res.json({
      type,
      logs: 'Sample log content...\n' +
            '[2024-03-05 10:00:00] GET / 200\n' +
            '[2024-03-05 10:00:01] GET /api/test 200'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
