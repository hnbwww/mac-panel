import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { nginxService, NginxConfig } from './nginxService';

const execAsync = promisify(exec);

export interface WebsiteConfig {
  domain: string;
  rootDir: string;
  type: 'static' | 'php' | 'java' | 'proxy';
  phpVersion: string;
  javaVersion: string;
  port: number;
  proxyConfig?: {
    enabled: boolean;
    targetUrl: string;
    preserveHost: boolean;
    websocket: boolean;
    customHeaders?: Record<string, string>;
  };
}

export class WebsiteService {
  private wwwroot: string;

  constructor() {
    // 直接使用用户主目录下的路径
    this.wwwroot = path.join(process.env.HOME || '.', 'www', 'wwwroot');
    this.ensureWwwroot();
  }

  private async ensureWwwroot() {
    try {
      await fs.ensureDir(this.wwwroot);
      console.log(`[WebsiteService] wwwroot directory ready: ${this.wwwroot}`);
    } catch (error: any) {
      console.error(`[WebsiteService] Failed to create wwwroot directory: ${error.message}`);
    }
  }

  async createWebsite(config: WebsiteConfig): Promise<{ success: boolean; message: string }> {
    try {
      // 展开路径中的 ~ 符号
      const expandedConfig = {
        ...config,
        rootDir: this.expandPath(config.rootDir)
      };

      if (expandedConfig.type === 'static') {
        return await this.createStaticWebsite(expandedConfig);
      } else if (expandedConfig.type === 'php') {
        return await this.createPHPWebsite(expandedConfig);
      } else if (expandedConfig.type === 'java') {
        return await this.createJavaWebsite(expandedConfig);
      } else if (expandedConfig.type === 'proxy') {
        return await this.createProxyWebsite(expandedConfig);
      }
      return { success: false, message: '未知的网站类型' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  private expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(process.env.HOME || '.', filePath.substring(2));
    }
    return filePath;
  }

  private async createStaticWebsite(config: WebsiteConfig): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 创建根目录
      await fs.ensureDir(config.rootDir);

      // 2. 创建欢迎页面
      const indexHtml = this.generateWelcomePage(config.domain);
      await fs.writeFile(path.join(config.rootDir, 'index.html'), indexHtml, 'utf-8');

      // 3. 创建 .htaccess 文件
      const htaccess = this.generateHtaccess();
      await fs.writeFile(path.join(config.rootDir, '.htaccess'), htaccess, 'utf-8');

      // 4. 创建 nginx 配置文件（如果 nginx 存在）
      await this.createNginxConfig(config);

      return {
        success: true,
        message: `网站创建成功！目录: ${config.rootDir}，欢迎页面已创建`
      };
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`权限不足，无法创建目录 ${config.rootDir}`);
      }
      throw new Error(`创建静态网站失败: ${error.message}`);
    }
  }

  private async createPHPWebsite(config: WebsiteConfig): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 创建根目录
      await fs.ensureDir(config.rootDir);

      // 2. 创建 PHP 测试页面
      const phpIndex = this.generatePHPIndex(config.domain);
      await fs.writeFile(path.join(config.rootDir, 'index.php'), phpIndex, 'utf-8');

      // 3. 创建 nginx 配置
      await this.createNginxConfig(config);

      return {
        success: true,
        message: `PHP 网站创建成功！目录: ${config.rootDir}，PHP 版本: ${config.phpVersion}`
      };
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`权限不足，无法创建目录 ${config.rootDir}`);
      }
      throw new Error(`创建 PHP 网站失败: ${error.message}`);
    }
  }

  private async createJavaWebsite(config: WebsiteConfig): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 创建根目录
      await fs.ensureDir(config.rootDir);

      // 2. 创建基本的 Java Web 项目结构
      const webInfDir = path.join(config.rootDir, 'WEB-INF');
      await fs.ensureDir(webInfDir);

      // 3. 创建 web.xml
      const webXml = this.generateWebXml();
      await fs.writeFile(path.join(webInfDir, 'web.xml'), webXml, 'utf-8');

      // 4. 创建 index.jsp
      const jspIndex = this.generateJSPIndex(config.domain);
      await fs.writeFile(path.join(config.rootDir, 'index.jsp'), jspIndex, 'utf-8');

      // 5. 创建 nginx 配置
      await this.createNginxConfig(config);

      return {
        success: true,
        message: `Java 网站创建成功！目录: ${config.rootDir}，Java 版本: ${config.javaVersion}`
      };
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`权限不足，无法创建目录 ${config.rootDir}。请运行: sudo mkdir -p ${config.rootDir} && sudo chown \`whoami\`:\`whoami\` ${config.rootDir}`);
      }
      throw new Error(`创建 Java 网站失败: ${error.message}`);
    }
  }

  private async createProxyWebsite(config: WebsiteConfig): Promise<{ success: boolean; message: string }> {
    try {
      // 创建反向代理配置
      await this.createProxyConfig(config);

      return {
        success: true,
        message: `反向代理创建成功！代理到: ${config.proxyConfig?.targetUrl}`
      };
    } catch (error: any) {
      throw new Error(`创建反向代理失败: ${error.message}`);
    }
  }

  private generateWelcomePage(domain: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>欢迎来到 ${domain}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 20px;
            font-weight: 700;
        }
        .domain {
            color: #667eea;
            font-size: 1.2em;
            margin-bottom: 30px;
            padding: 15px;
            background: #f7f7f7;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
        }
        .info {
            color: #666;
            line-height: 1.8;
            margin-bottom: 30px;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .feature {
            padding: 15px;
            background: #f7f7f7;
            border-radius: 10px;
            font-size: 0.9em;
            color: #555;
        }
        .feature-title {
            font-weight: 600;
            margin-bottom: 5px;
            color: #667eea;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 0.9em;
        }
        .badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.85em;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="badge">✨ 网站已成功创建</div>
        <h1>欢迎来到 ${domain}</h1>
        <div class="domain">${domain}</div>
        <p class="info">
            恭喜！您的网站已成功创建并正在运行。<br>
            现在您可以开始上传文件或使用我们提供的工具进行开发。
        </p>
        <div class="features">
            <div class="feature">
                <div class="feature-title">🚀 高速访问</div>
                <div>优化的服务器配置</div>
            </div>
            <div class="feature">
                <div class="feature-title">🔒 安全可靠</div>
                <div>SSL/TLS 加密支持</div>
            </div>
            <div class="feature">
                <div class="feature-title">📊 实时监控</div>
                <div>访问统计和分析</div>
            </div>
            <div class="feature">
                <div class="feature-title">⚙️ 灵活配置</div>
                <div>自定义设置选项</div>
            </div>
        </div>
        <div class="footer">
            Powered by Mac Panel | Created at ${new Date().toLocaleString('zh-CN')}
        </div>
    </div>
</body>
</html>`;
  }

  private generateHtaccess(): string {
    return `# Apache Configuration
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Security Headers
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Cache Control
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/pdf "access plus 1 month"
  ExpiresByType text/javascript "access plus 1 month"
</IfModule>`;
  }

  private generatePHPIndex(domain: string): string {
    return `<?php
echo "<!DOCTYPE html>
<html lang='zh-CN'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>欢迎来到 ${domain}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #333; margin-bottom: 20px; }
        .info { color: #666; margin: 10px 0; }
        .php-version { color: #8892bf; font-weight: bold; }
    </style>
</head>
<body>
    <div class='container'>
        <h1>🚀 PHP 网站已启动</h1>
        <p class='info'>域名: ${domain}</p>
        <p class='info'>PHP 版本: <span class='php-version'>" . phpversion() . "</span></p>
        <p class='info'>服务器时间: " . date('Y-m-d H:i:s') . "</p>
    </div>
</body>
</html>";
?>`;
  }

  private generateWebXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
         http://xmlns.jcp.org/xml/ns/javaee/web-app_4_0.xsd"
         version="4.0">

    <display-name>Java Web Application</display-name>

    <welcome-file-list>
        <welcome-file>index.jsp</welcome-file>
        <welcome-file>index.html</welcome-file>
    </welcome-file-list>

    <session-config>
        <session-timeout>30</session-timeout>
    </session-config>

</web-app>`;
  }

  private generateJSPIndex(domain: string): string {
    return `<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>欢迎来到 ${domain}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #333; margin-bottom: 20px; }
        .info { color: #666; margin: 10px 0; }
        .java-version { color: #f89820; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>☕ Java 网站已启动</h1>
        <p class="info">域名: ${domain}</p>
        <p class="info">Java 版本: <span class="java-version"><%= System.getProperty("java.version") %></span></p>
        <p class="info">服务器时间: <%= new java.util.Date() %></p>
    </div>
</body>
</html>`;
  }

  private async createNginxConfig(config: WebsiteConfig): Promise<void> {
    try {
      const nginxConfig: NginxConfig = {
        domain: config.domain,
        rootDir: config.rootDir,
        type: config.type,
        port: config.port,
        phpVersion: config.phpVersion,
        proxyConfig: config.proxyConfig,
      };

      const result = await nginxService.createConfig(nginxConfig);
      if (result.success) {
        console.log(`[WebsiteService] Nginx config created: ${result.message}`);
      } else {
        console.warn(`[WebsiteService] Nginx config failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('[WebsiteService] Failed to create nginx config:', error.message);
      // 不抛出错误，允许网站创建继续
    }
  }

  private async createProxyConfig(config: WebsiteConfig): Promise<void> {
    await this.createNginxConfig(config);

    // 保存反向代理配置到数据库
    const configPath = path.join(this.wwwroot, `${config.domain}-proxy.json`);
    await fs.writeJSON(configPath, {
      domain: config.domain,
      type: 'proxy',
      proxyConfig: config.proxyConfig,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 更新网站的 Nginx 配置
   */
  async updateNginxConfig(config: WebsiteConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const nginxConfig: NginxConfig = {
        domain: config.domain,
        rootDir: config.rootDir,
        type: config.type,
        port: config.port,
        phpVersion: config.phpVersion,
        proxyConfig: config.proxyConfig,
      };

      return await nginxService.createConfig(nginxConfig);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新网站的 SSL 配置
   */
  async updateSSLConfig(config: WebsiteConfig & { ssl: boolean; sslCertPath?: string; sslKeyPath?: string }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const nginxConfig: NginxConfig = {
        domain: config.domain,
        rootDir: config.rootDir,
        type: config.type,
        port: config.port || (config.ssl ? 443 : 80),
        phpVersion: config.phpVersion,
        proxyConfig: config.proxyConfig,
        ssl: config.ssl,
        sslCertPath: config.sslCertPath,
        sslKeyPath: config.sslKeyPath,
      };

      return await nginxService.createConfig(nginxConfig);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteWebsite(domain: string, rootDir: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[WebsiteService] Deleting website: ${domain}, rootDir: ${rootDir}`);

      // 展开根目录路径
      const expandedRootDir = this.expandPath(rootDir);
      console.log(`[WebsiteService] Expanded rootDir: ${expandedRootDir}`);

      // 删除 nginx 配置
      const result = await nginxService.deleteConfig(domain);
      if (result.success) {
        console.log(`[WebsiteService] Nginx config deleted: ${result.message}`);
      } else {
        console.warn(`[WebsiteService] Nginx config delete failed: ${result.error}`);
      }

      // 删除网站根目录（如果存在）
      if (expandedRootDir) {
        try {
          const exists = await fs.pathExists(expandedRootDir);
          if (exists) {
            await fs.remove(expandedRootDir);
            console.log(`[WebsiteService] Deleted root directory: ${expandedRootDir}`);
          } else {
            console.log(`[WebsiteService] Root directory does not exist: ${expandedRootDir}`);
          }
        } catch (error: any) {
          console.warn(`[WebsiteService] Failed to remove root directory: ${error.message}`);
        }
      }

      return { success: true, message: '网站删除成功' };
    } catch (error: any) {
      console.error(`[WebsiteService] Delete website error: ${error.message}`);
      return { success: false, message: `删除网站失败: ${error.message}` };
    }
  }

  async checkDirectoryExists(dir: string): Promise<boolean> {
    try {
      await fs.access(dir);
      return true;
    } catch {
      return false;
    }
  }

  async getDiskUsage(dir: string): Promise<{ size: number; files: number }> {
    try {
      const { stdout } = await execAsync(`du -sb ${dir} 2>/dev/null | cut -f1`);
      const size = parseInt(stdout) || 0;

      const { stdout: filesOutput } = await execAsync(`find ${dir} -type f | wc -l`);
      const files = parseInt(filesOutput.trim()) || 0;

      return { size, files };
    } catch {
      return { size: 0, files: 0 };
    }
  }
}

export const websiteService = new WebsiteService();
