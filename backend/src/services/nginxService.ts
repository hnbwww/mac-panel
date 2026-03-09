import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NginxConfig {
  domain: string;
  rootDir?: string;
  type: 'static' | 'php' | 'java' | 'proxy';
  port: number;
  phpVersion?: string;
  javaVersion?: string;
  proxyConfig?: {
    enabled: boolean;
    targetUrl: string;
    preserveHost: boolean;
    websocket: boolean;
    customHeaders?: Record<string, string>;
  };
  ssl?: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
}

export class NginxService {
  private configDir: string;
  private enabledDir: string;
  private sslDir: string;
  private isDev: boolean;

  constructor() {
    // 开发环境检测
    this.isDev = process.env.NODE_ENV === 'development';

    // 根据操作系统设置 Nginx 配置目录
    if (process.platform === 'darwin') {
      // macOS Homebrew Nginx
      this.configDir = '/opt/homebrew/etc/nginx/servers';
      this.enabledDir = '/opt/homebrew/etc/nginx/servers';
      this.sslDir = '/opt/homebrew/etc/nginx/ssl';
    } else {
      // Linux Nginx
      this.configDir = '/etc/nginx/sites-available';
      this.enabledDir = '/etc/nginx/sites-enabled';
      this.sslDir = '/etc/nginx/ssl';
    }
  }

  /**
   * 检查 Nginx 是否安装
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync('command -v nginx');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取 Nginx 版本
   */
  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('nginx -v 2>&1');
      // 去掉 "nginx version:" 前缀
      const version = stdout.trim().replace(/^nginx version:\s*/, '');
      return version;
    } catch (error: any) {
      return 'Unknown';
    }
  }

  /**
   * 检查 Nginx 运行状态
   */
  async getStatus(): Promise<{ running: boolean; pid?: number }> {
    try {
      const { stdout } = await execAsync('pgrep nginx');
      const pids = stdout.trim().split('\n').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      return {
        running: pids.length > 0,
        pid: pids[0]
      };
    } catch {
      return { running: false };
    }
  }

  /**
   * 测试 Nginx 配置文件语法
   */
  async testConfig(): Promise<{ success: boolean; output?: string; error?: string }> {
    if (this.isDev) {
      return {
        success: true,
        output: '开发模式：跳过配置测试'
      };
    }

    try {
      // 直接使用nginx命令测试
      const nginxBin = process.platform === 'darwin' ? '/opt/homebrew/bin/nginx' : 'nginx';
      const { stdout, stderr } = await execAsync(`${nginxBin} -t 2>&1`, {
        timeout: 5000
      });

      const output = stdout || stderr;
      const isSuccess = output.includes('successful') || output.includes('syntax is ok');

      return {
        success: isSuccess,
        output: output
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '配置测试失败'
      };
    }
  }

  /**
   * 重新加载 Nginx 配置
   */
  async reload(): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isDev) {
      return {
        success: true,
        message: '开发模式：跳过 Nginx 重载'
      };
    }

    try {
      // 先测试配置
      const testResult = await this.testConfig();
      if (!testResult.success) {
        return {
          success: false,
          error: '配置测试失败，无法重新加载: ' + testResult.error
        };
      }

      // 使用管理脚本重新加载（macOS Homebrew nginx）
      if (process.platform === 'darwin') {
        // 检查管理脚本是否存在
        const { stdout: checkScript } = await execAsync('which nginx-manage');
        if (checkScript.trim()) {
          // 使用 sudo 执行 reload
          try {
            await execAsync('sudo nginx-manage reload');
          } catch (sudoError: any) {
            // 如果 sudo 失败，尝试不使用 sudo（可能已配置免密）
            if (sudoError.message.includes('sudo')) {
              await execAsync('nginx-manage reload');
            } else {
              throw sudoError;
            }
          }
        } else {
          // 备用方案：直接使用nginx命令
          try {
            await execAsync('sudo /opt/homebrew/bin/nginx -s reload');
          } catch (sudoError: any) {
            if (sudoError.message.includes('sudo')) {
              await execAsync('/opt/homebrew/bin/nginx -s reload');
            } else {
              throw sudoError;
            }
          }
        }
      } else {
        await execAsync('sudo nginx -s reload');
      }

      return {
        success: true,
        message: 'Nginx 配置已重新加载'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '重新加载失败'
      };
    }
  }

  /**
   * 重启 Nginx 服务
   */
  async restart(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // macOS 使用 brew services restart
      if (process.platform === 'darwin') {
        await execAsync('brew services restart nginx');
      } else {
        // Linux 使用 systemctl
        await execAsync('sudo systemctl restart nginx');
      }

      return {
        success: true,
        message: 'Nginx 服务已重启'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '重启失败'
      };
    }
  }

  /**
   * 启动 Nginx 服务
   */
  async start(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (process.platform === 'darwin') {
        await execAsync('brew services start nginx');
      } else {
        await execAsync('sudo systemctl start nginx');
      }

      return {
        success: true,
        message: 'Nginx 服务已启动'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '启动失败'
      };
    }
  }

  /**
   * 停止 Nginx 服务
   */
  async stop(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (process.platform === 'darwin') {
        await execAsync('brew services stop nginx');
      } else {
        await execAsync('sudo systemctl stop nginx');
      }

      return {
        success: true,
        message: 'Nginx 服务已停止'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '停止失败'
      };
    }
  }

  /**
   * 创建或更新 Nginx 配置文件
   */
  async createConfig(config: NginxConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isDev) {
      console.log('[NginxService] Development mode: Skipping nginx configuration');
      return {
        success: true,
        message: '开发模式：跳过 Nginx 配置'
      };
    }

    try {
      // 检查 Nginx 是否安装
      const installed = await this.isInstalled();
      if (!installed) {
        return {
          success: false,
          error: 'Nginx 未安装'
        };
      }

      // 生成配置内容
      const configContent = this.generateConfigContent(config);
      const configFile = path.join(this.configDir, `${config.domain}.conf`);

      // 确保配置目录存在
      await fs.ensureDir(this.configDir);
      await fs.ensureDir(this.enabledDir);
      await fs.ensureDir(this.sslDir);

      // macOS Homebrew Nginx: 直接写入配置文件，不使用 custom 目录和符号链接
      if (process.platform === 'darwin') {
        // 清理可能存在的旧 custom 目录（历史遗留）
        const customConfigDir = path.join(this.configDir, 'custom');
        try {
          await fs.remove(customConfigDir);
          console.log(`[NginxService] 已清理历史遗留的 custom 目录: ${customConfigDir}`);
        } catch (error) {
          // 目录不存在或无法删除，忽略
        }

        // 写入配置文件到 servers 目录
        await fs.writeFile(configFile, configContent, 'utf-8');
      } else {
        // Linux: 使用 custom 目录和符号链接（sites-available/sites-enabled 模式）
        const customConfigDir = path.join(this.configDir, 'custom');
        await fs.ensureDir(customConfigDir);

        // 写入配置文件到 custom 目录
        const customConfigFile = path.join(customConfigDir, `${config.domain}.conf`);
        await fs.writeFile(customConfigFile, configContent, 'utf-8');

        // 创建符号链接到 sites-enabled
        const enabledFile = path.join(this.enabledDir, `${config.domain}.conf`);
        try {
          await fs.unlink(enabledFile);
        } catch {}

        await fs.symlink(customConfigFile, enabledFile);
      }

      // 测试配置
      const testResult = await this.testConfig();
      if (!testResult.success) {
        // 配置有误，删除配置文件或符号链接
        try {
          if (process.platform === 'darwin') {
            await fs.unlink(configFile);
          } else {
            const enabledFile = path.join(this.enabledDir, `${config.domain}.conf`);
            await fs.unlink(enabledFile);
          }
        } catch {}
        return {
          success: false,
          error: 'Nginx 配置测试失败: ' + testResult.error
        };
      }

      // 重新加载 Nginx
      const reloadResult = await this.reload();
      if (!reloadResult.success) {
        return {
          success: false,
          error: '配置已创建，但重新加载失败: ' + reloadResult.error
        };
      }

      return {
        success: true,
        message: `Nginx 配置已更新并重新加载: ${config.domain}`
      };
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          error: '权限不足，需要管理员权限'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除 Nginx 配置文件
   */
  async deleteConfig(domain: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isDev) {
      console.log('[NginxService] Development mode: Skipping nginx configuration');
      return {
        success: true,
        message: '开发模式：跳过 Nginx 配置'
      };
    }

    try {
      const configFile = path.join(this.configDir, `${domain}.conf`);
      const enabledFile = path.join(this.enabledDir, `${domain}.conf`);

      // 删除符号链接
      try {
        await fs.unlink(enabledFile);
      } catch (error: any) {
        console.warn(`[NginxService] Failed to delete enabled link: ${error.message}`);
      }

      // 删除配置文件
      try {
        await fs.unlink(configFile);
      } catch (error: any) {
        console.warn(`[NginxService] Failed to delete config: ${error.message}`);
      }

      // 重新加载 Nginx
      await this.reload();

      return {
        success: true,
        message: `Nginx 配置已删除: ${domain}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 保存 SSL 证书
   */
  async saveSSLCert(domain: string, cert: string, key: string): Promise<{ success: boolean; certPath?: string; keyPath?: string; error?: string }> {
    if (this.isDev) {
      return {
        success: true,
        error: '开发模式：跳过 SSL 证书保存'
      };
    }

    try {
      const domainSslDir = path.join(this.sslDir, domain);

      // 确保 SSL 目录存在
      await fs.ensureDir(domainSslDir);

      const certPath = path.join(domainSslDir, 'cert.pem');
      const keyPath = path.join(domainSslDir, 'key.pem');

      // 写入证书和密钥
      await fs.writeFile(certPath, cert, 'utf-8');
      await fs.writeFile(keyPath, key, 'utf-8');

      // 设置私钥权限为 600
      await fs.chmod(keyPath, 0o600);

      return {
        success: true,
        certPath,
        keyPath
      };
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          error: '权限不足，需要管理员权限来保存 SSL 证书'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成 Nginx 配置内容
   */
  /**
   * 生成 Nginx 配置内容（公开方法）
   */
  public generateConfigContent(config: NginxConfig): string {
    return this.generateConfigContentInternal(config);
  }

  /**
   * 生成 Nginx 配置内容（内部方法）
   */
  private generateConfigContentInternal(config: NginxConfig): string {
    const sslConfig = config.ssl ? this.generateSSLConfig(config) : '';
    const serverConfig = this.generateServerConfig(config);

    if (config.ssl) {
      // SSL 配置：同时监听指定端口和443
      const httpPort = config.port !== 80 ? config.port : 80;
      return `# HTTP server - redirect to HTTPS
server {
    listen 0.0.0.0:${httpPort};
    server_name ${config.domain};

    # Redirect all HTTP requests to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
${serverConfig}
`;
    } else {
      // 非 SSL 配置：监听用户指定端口
      return serverConfig;
    }
  }

  /**
   * 生成 SSL 相关配置
   */
  private generateSSLConfig(config: NginxConfig): string {
    // 只有在启用SSL且证书路径存在时才生成SSL配置
    if (!config.ssl || !config.sslCertPath || !config.sslKeyPath) {
      return '';
    }
    return `
    ssl_certificate ${config.sslCertPath};
    ssl_certificate_key ${config.sslKeyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
`;
  }

  /**
   * 生成服务器配置
   */
  private generateServerConfig(config: NginxConfig): string {
    let serverBlock = '';

    if (config.type === 'proxy' && config.proxyConfig) {
      serverBlock = this.generateProxyConfig(config);
    } else if (config.type === 'php') {
      serverBlock = this.generatePHPConfig(config);
    } else if (config.type === 'java') {
      serverBlock = this.generateJavaConfig(config);
    } else {
      serverBlock = this.generateStaticConfig(config);
    }

    return serverBlock;
  }

  /**
   * 生成静态网站配置
   */
  private generateStaticConfig(config: NginxConfig): string {
    const sslConfig = config.ssl && config.sslCertPath && config.sslKeyPath
      ? `    ${this.generateSSLConfig(config)}
`
      : '';

    const logPath = process.platform === 'darwin'
      ? '/opt/homebrew/var/log/nginx'
      : '/var/log/nginx';

    return `server {
    listen 0.0.0.0:${config.port};
    server_name ${config.domain};
${sslConfig}
    root ${config.rootDir};
    index index.html index.htm;

    access_log ${logPath}/${config.domain}-access.log;
    error_log ${logPath}/${config.domain}-error.log;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 禁止访问隐藏文件
    location ~ /\\.ht {
        deny all;
    }

    # 缓存静态资源
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`;
  }

  /**
   * 生成 PHP 网站配置
   */
  private generatePHPConfig(config: NginxConfig): string {
    const phpSocket = config.phpVersion
      ? `/opt/homebrew/var/run/php${config.phpVersion.replace('.', '')}-fpm.sock`
      : '/opt/homebrew/var/run/php-fpm.sock';

    const sslConfig = config.ssl && config.sslCertPath && config.sslKeyPath
      ? `    ${this.generateSSLConfig(config)}
`
      : '';

    const logPath = process.platform === 'darwin'
      ? '/opt/homebrew/var/log/nginx'
      : '/var/log/nginx';

    return `server {
    listen 0.0.0.0:${config.port};
    server_name ${config.domain};
${sslConfig}
    root ${config.rootDir};
    index index.php index.html index.htm;

    access_log ${logPath}/${config.domain}-access.log;
    error_log ${logPath}/${config.domain}-error.log;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        fastcgi_pass unix:${phpSocket};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.ht {
        deny all;
    }
}`;
  }

  /**
   * 生成 Java 网站配置
   */
  private generateJavaConfig(config: NginxConfig): string {
    const sslConfig = config.ssl && config.sslCertPath && config.sslKeyPath
      ? `    ${this.generateSSLConfig(config)}
`
      : '';

    const logPath = process.platform === 'darwin'
      ? '/opt/homebrew/var/log/nginx'
      : '/var/log/nginx';

    return `server {
    listen 0.0.0.0:${config.port};
    server_name ${config.domain};
${sslConfig}
    access_log ${logPath}/${config.domain}-access.log;
    error_log ${logPath}/${config.domain}-error.log;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}`;
  }

  /**
   * 生成反向代理配置
   */
  private generateProxyConfig(config: NginxConfig): string {
    const proxy = config.proxyConfig!;

    let proxySetHeaders = `
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;`;

    if (proxy.preserveHost) {
      proxySetHeaders = `
    proxy_set_header Host $host;` + proxySetHeaders;
    }

    if (proxy.websocket) {
      proxySetHeaders += `
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";`;
    }

    if (proxy.customHeaders) {
      Object.entries(proxy.customHeaders).forEach(([key, value]) => {
        proxySetHeaders += `
    proxy_set_header ${key} ${value};`;
      });
    }

    const sslConfig = config.ssl && config.sslCertPath && config.sslKeyPath
      ? `    ${this.generateSSLConfig(config)}
`
      : '';

    const logPath = process.platform === 'darwin'
      ? '/opt/homebrew/var/log/nginx'
      : '/var/log/nginx';

    return `server {
    listen 0.0.0.0:${config.port};
    server_name ${config.domain};
${sslConfig}
    access_log ${logPath}/${config.domain}-access.log;
    error_log ${logPath}/${config.domain}-error.log;

    location / {
        proxy_pass ${proxy.targetUrl};
        proxy_http_version 1.1;${proxySetHeaders}
        proxy_cache_bypass $http_upgrade;
    }
}`;
  }

  /**
   * 获取所有已启用的站点
   */
  async getEnabledSites(): Promise<string[]> {
    if (this.isDev) {
      // 开发模式：从数据库获取所有网站，假设都已启用
      try {
        const { db } = await import('./database');
        const websites = await db.listWebsites();
        return websites.map((w: any) => w.domain);
      } catch {
        return [];
      }
    }

    try {
      const files = await fs.readdir(this.enabledDir);
      return files
        .filter(f => f.endsWith('.conf'))
        .map(f => f.replace('.conf', ''));
    } catch {
      return [];
    }
  }

  /**
   * 获取所有可用的站点
   */
  async getAvailableSites(): Promise<string[]> {
    if (this.isDev) {
      // 开发模式：从数据库获取所有网站，假设都有配置
      try {
        const { db } = await import('./database');
        const websites = await db.listWebsites();
        return websites.map((w: any) => w.domain);
      } catch {
        return [];
      }
    }

    try {
      const files = await fs.readdir(this.configDir);
      return files
        .filter(f => f.endsWith('.conf'))
        .map(f => f.replace('.conf', ''));
    } catch {
      return [];
    }
  }

  /**
   * 保存自定义 Nginx 配置
   */
  async saveCustomConfig(domain: string, configContent: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isDev) {
      return {
        success: true,
        message: '开发模式：跳过配置保存'
      };
    }

    try {
      if (process.platform === 'darwin') {
        // macOS Homebrew Nginx: 直接写入配置文件
        // 清理可能存在的旧 custom 目录（历史遗留）
        const customConfigDir = path.join(this.configDir, 'custom');
        try {
          await fs.remove(customConfigDir);
          console.log(`[NginxService] 已清理历史遗留的 custom 目录: ${customConfigDir}`);
        } catch (error) {
          // 目录不存在或无法删除，忽略
        }

        const configFile = path.join(this.configDir, `${domain}.conf`);
        await fs.writeFile(configFile, configContent, 'utf-8');
      } else {
        // Linux: 使用 custom 目录和符号链接
        const customConfigDir = path.join(this.configDir, 'custom');
        await fs.ensureDir(customConfigDir);

        const customConfigFile = path.join(customConfigDir, `${domain}.conf`);
        await fs.writeFile(customConfigFile, configContent, 'utf-8');

        // 创建符号链接到 sites-enabled
        const enabledFile = path.join(this.enabledDir, `${domain}.conf`);
        try {
          await fs.unlink(enabledFile);
        } catch {}

        await fs.symlink(customConfigFile, enabledFile);
      }

      return {
        success: true,
        message: `自定义配置已保存: ${domain}`
      };
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          error: '权限不足，需要管理员权限'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除自定义 Nginx 配置
   */
  async deleteCustomConfig(domain: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isDev) {
      return {
        success: true,
        message: '开发模式：跳过配置删除'
      };
    }

    try {
      if (process.platform === 'darwin') {
        // macOS Homebrew Nginx: 直接删除配置文件
        const configFile = path.join(this.configDir, `${domain}.conf`);
        try {
          await fs.unlink(configFile);
        } catch (error: any) {
          // 文件不存在，继续
        }
      } else {
        // Linux: 删除 custom 目录中的配置文件
        const customConfigDir = path.join(this.configDir, 'custom');
        const customConfigFile = path.join(customConfigDir, `${domain}.conf`);
        try {
          await fs.unlink(customConfigFile);
        } catch (error: any) {
          // 文件不存在，继续
        }
      }

      return {
        success: true,
        message: `自定义配置已删除: ${domain}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查是否有自定义配置
   */
  async hasCustomConfig(domain: string): Promise<boolean> {
    if (this.isDev) {
      return false;
    }

    try {
      if (process.platform === 'darwin') {
        // macOS Homebrew Nginx: 检查 servers 目录中的配置文件
        const configFile = path.join(this.configDir, `${domain}.conf`);
        return await fs.pathExists(configFile);
      } else {
        // Linux: 检查 custom 目录中的配置文件
        const customConfigFile = path.join(this.configDir, 'custom', `${domain}.conf`);
        return await fs.pathExists(customConfigFile);
      }
    } catch {
      return false;
    }
  }

  /**
   * 启用网站（创建符号链接）
   */
  async enableSite(domain: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isDev) {
      return {
        success: true,
        message: '开发模式：跳过启用操作'
      };
    }

    try {
      const configFile = path.join(this.configDir, `${domain}.conf`);

      // 检查配置文件是否存在
      const configExists = await fs.pathExists(configFile);
      if (!configExists) {
        return {
          success: false,
          error: `配置文件不存在: ${configFile}`
        };
      }

      if (process.platform === 'darwin') {
        // macOS Homebrew Nginx: 配置文件已在正确位置，只需重新加载
        // 重新加载 Nginx
        const reloadResult = await this.reload();
        if (!reloadResult.success) {
          return {
            success: false,
            error: '已启用，但重新加载失败: ' + reloadResult.error
          };
        }
      } else {
        // Linux: 创建符号链接
        const enabledFile = path.join(this.enabledDir, `${domain}.conf`);

        // 创建符号链接
        try {
          await fs.unlink(enabledFile);
        } catch {}

        await fs.symlink(configFile, enabledFile);

        // 重新加载 Nginx
        const reloadResult = await this.reload();
        if (!reloadResult.success) {
          return {
            success: false,
            error: '已启用，但重新加载失败: ' + reloadResult.error
          };
        }
      }

      return {
        success: true,
        message: `网站 ${domain} 已启用`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 停用网站（删除符号链接）
   */
  async disableSite(domain: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (this.isDev) {
      return {
        success: true,
        message: '开发模式：跳过停用操作'
      };
    }

    try {
      if (process.platform === 'darwin') {
        // macOS Homebrew Nginx: 重命名配置文件为 .disabled
        const configFile = path.join(this.configDir, `${domain}.conf`);
        const disabledFile = path.join(this.configDir, `${domain}.conf.disabled`);

        // 检查配置文件是否存在
        const configExists = await fs.pathExists(configFile);
        if (!configExists) {
          return {
            success: false,
            error: '网站未启用或配置文件不存在'
          };
        }

        // 重命名为 .disabled
        await fs.rename(configFile, disabledFile);
      } else {
        // Linux: 删除符号链接
        const enabledFile = path.join(this.enabledDir, `${domain}.conf`);

        // 删除符号链接
        try {
          await fs.unlink(enabledFile);
        } catch (error: any) {
          return {
            success: false,
            error: '网站未启用或删除失败'
          };
        }
      }

      // 重新加载 Nginx
      const reloadResult = await this.reload();
      if (!reloadResult.success) {
        return {
          success: false,
          error: '已停用，但重新加载失败: ' + reloadResult.error
        };
      }

      return {
        success: true,
        message: `网站 ${domain} 已停用`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const nginxService = new NginxService();
