import { db } from './database';

// 初始化默认软件配置到数据库
export async function initializeDefaultSoftware() {
  const existingConfigs = await db.listSoftwareConfigs(true);

  // 如果已经有配置，跳过初始化
  if (existingConfigs.length > 0) {
    console.log('[SoftwareInit] Database already has software configs, skipping initialization');
    return;
  }

  console.log('[SoftwareInit] Initializing default software configs...');

  const defaultSoftware = [
    {
      name: 'nginx',
      display_name: 'Nginx',
      description: '高性能 Web 服务器和反向代理',
      category: 'server' as const,
      icon: '🌐',
      installed: false,
      status: 'unknown' as const,
      config_path: '/opt/homebrew/etc/nginx/nginx.conf',
      enabled: true,
      sort_order: 1,
      commands: {
        install: 'brew install nginx',
        uninstall: 'brew uninstall nginx',
        start: 'brew services start nginx',
        stop: 'brew services stop nginx',
        restart: 'brew services restart nginx',
        status: 'brew services list | grep nginx',
        version: 'nginx -v 2>&1'
      },
      log_paths: {
        application: '/opt/homebrew/var/log/nginx/error.log',
        error: '/opt/homebrew/var/log/nginx/error.log',
        access: '/opt/homebrew/var/log/nginx/access.log'
      }
    },
    {
      name: 'apache',
      display_name: 'Apache HTTPD',
      description: '流行的 Web 服务器',
      category: 'server' as const,
      icon: '🪶',
      installed: false,
      status: 'unknown' as const,
      config_path: '/opt/homebrew/etc/httpd/httpd.conf',
      enabled: true,
      sort_order: 2,
      commands: {
        install: 'brew install httpd',
        uninstall: 'brew uninstall httpd',
        start: 'brew services start httpd',
        stop: 'brew services stop httpd',
        restart: 'brew services restart httpd',
        status: 'brew services list | grep httpd',
        version: 'httpd -v'
      },
      log_paths: {
        error: '/opt/homebrew/var/log/httpd/error_log',
        access: '/opt/homebrew/var/log/httpd/access_log'
      }
    },
    {
      name: 'mysql',
      display_name: 'MySQL',
      description: '流行的关系型数据库',
      category: 'database' as const,
      icon: '🐬',
      installed: false,
      status: 'unknown' as const,
      config_path: '/opt/homebrew/etc/my.cnf',
      available_versions: ['9.0', '8.4', '8.0'],
      requires_password: true,
      default_password: 'root',
      enabled: true,
      sort_order: 3,
      commands: {
        install: 'brew install mysql',
        uninstall: 'brew uninstall mysql',
        start: 'brew services start mysql',
        stop: 'brew services stop mysql',
        restart: 'brew services restart mysql',
        status: 'brew services list | grep mysql',
        version: 'mysql --version'
      },
      log_paths: {
        error: '/opt/homebrew/var/mysql/*.err'
      }
    },
    {
      name: 'postgresql',
      display_name: 'PostgreSQL',
      description: '强大的开源关系型数据库',
      category: 'database' as const,
      icon: '🐘',
      installed: false,
      status: 'unknown' as const,
      config_path: '/opt/homebrew/var/postgres/postgresql.conf',
      available_versions: ['18', '17', '16', '15', '14'],
      requires_password: true,
      default_password: 'postgres',
      enabled: true,
      sort_order: 4,
      commands: {
        install: 'brew install postgresql@18',
        uninstall: 'brew uninstall postgresql@18',
        start: 'brew services start postgresql@18',
        stop: 'brew services stop postgresql@18',
        restart: 'brew services restart postgresql@18',
        status: 'brew services list | grep postgresql',
        version: 'psql --version'
      },
      log_paths: {
        application: '/opt/homebrew/var/log/postgres.log'
      }
    },
    {
      name: 'redis',
      display_name: 'Redis',
      description: '高性能键值存储数据库',
      category: 'database' as const,
      icon: '🔴',
      installed: false,
      status: 'unknown' as const,
      config_path: '/opt/homebrew/etc/redis.conf',
      enabled: true,
      sort_order: 5,
      commands: {
        install: 'brew install redis',
        uninstall: 'brew uninstall redis',
        start: 'brew services start redis',
        stop: 'brew services stop redis',
        restart: 'brew services restart redis',
        status: 'brew services list | grep redis',
        version: 'redis-cli --version'
      },
      log_paths: {
        application: '/opt/homebrew/var/log/redis.log'
      }
    },
    {
      name: 'mongodb',
      display_name: 'MongoDB',
      description: '流行的 NoSQL 数据库',
      category: 'database' as const,
      icon: '🍃',
      installed: false,
      status: 'unknown' as const,
      config_path: '/opt/homebrew/etc/mongod.conf',
      available_versions: ['8.0', '7.0', '6.0'],
      requires_password: false,
      enabled: true,
      sort_order: 6,
      commands: {
        install: 'brew tap mongodb/brew && brew install mongodb-community',
        uninstall: 'brew uninstall mongodb-community',
        start: 'brew services start mongodb-community',
        stop: 'brew services stop mongodb-community',
        restart: 'brew services restart mongodb-community',
        status: 'brew services list | grep mongodb',
        version: 'mongod --version'
      },
      log_paths: {
        application: '/opt/homebrew/var/log/mongodb/mongo.log'
      }
    },
    {
      name: 'node',
      display_name: 'Node.js',
      description: 'JavaScript 运行时环境',
      category: 'development' as const,
      icon: '💚',
      installed: false,
      status: 'unknown' as const,
      enabled: true,
      sort_order: 7,
      commands: {
        install: 'brew install node',
        uninstall: 'brew uninstall node',
        version: 'node --version'
      }
    },
    {
      name: 'python',
      display_name: 'Python',
      description: '流行的编程语言',
      category: 'development' as const,
      icon: '🐍',
      installed: false,
      status: 'unknown' as const,
      enabled: true,
      sort_order: 8,
      commands: {
        install: 'brew install python',
        uninstall: 'brew uninstall python',
        version: 'python3 --version'
      }
    },
    {
      name: 'php',
      display_name: 'PHP',
      description: '流行的 Web 开发语言',
      category: 'development' as const,
      icon: '🐘',
      installed: false,
      status: 'unknown' as const,
      available_versions: ['8.4', '8.3', '8.2', '8.1', '8.0'],
      enabled: true,
      sort_order: 9,
      commands: {
        install: 'brew install php',
        uninstall: 'brew uninstall php',
        start: 'brew services start php',
        stop: 'brew services stop php',
        restart: 'brew services restart php',
        status: 'brew services list | grep php',
        version: 'php --version'
      },
      log_paths: {
        error: '/opt/homebrew/var/log/php-fpm.log'
      }
    },
    {
      name: 'java',
      display_name: 'Java (OpenJDK)',
      description: '流行的跨平台编程语言',
      category: 'development' as const,
      icon: '☕',
      installed: false,
      status: 'unknown' as const,
      available_versions: ['21', '17', '11', '8'],
      enabled: true,
      sort_order: 10,
      commands: {
        install: 'brew install openjdk',
        uninstall: 'brew uninstall openjdk',
        version: 'java -version'
      }
    },
    {
      name: 'docker',
      display_name: 'Docker',
      description: '容器化平台',
      category: 'utility' as const,
      icon: '🐳',
      installed: false,
      status: 'unknown' as const,
      enabled: true,
      sort_order: 11,
      commands: {
        install: 'brew install --cask docker',
        uninstall: 'brew uninstall --cask docker',
        version: 'docker --version'
      }
    },
    {
      name: 'git',
      display_name: 'Git',
      description: '版本控制系统',
      category: 'utility' as const,
      icon: '📦',
      installed: false,
      status: 'unknown' as const,
      enabled: true,
      sort_order: 12,
      commands: {
        install: 'brew install git',
        uninstall: 'brew uninstall git',
        version: 'git --version'
      }
    },
    {
      name: 'claude-code',
      display_name: 'Claude Code',
      description: 'Anthropic 官方 AI 编程助手 CLI 工具',
      category: 'ai' as const,
      icon: '🤖',
      installed: false,
      status: 'unknown' as const,
      enabled: true,
      sort_order: 13,
      commands: {
        install: 'npm install -g @anthropic-ai/claude-code',
        uninstall: 'npm uninstall -g @anthropic-ai/claude-code',
        version: 'claude --version'
      }
    },
    {
      name: 'openclaw',
      display_name: 'OpenClaw',
      description: '自动化服务器管理工具',
      category: 'utility' as const,
      icon: '🦞',
      installed: false,
      status: 'unknown' as const,
      enabled: true,
      sort_order: 14,
      commands: {
        install: 'curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw/main/install.sh | bash',
        uninstall: 'openclaw uninstall',
        start: 'launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist',
        stop: 'launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist',
        restart: 'launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist && sleep 1 && launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist',
        status: 'openclaw status',
        version: 'openclaw version',
        repair: 'openclaw doctor --fix'
      },
      log_paths: {
        application: '~/.openclaw/logs/gateway.log'
      }
    }
  ];

  // 批量插入默认软件
  for (const software of defaultSoftware) {
    try {
      await db.createSoftwareConfig(software);
      console.log(`[SoftwareInit] ✓ Added ${software.display_name}`);
    } catch (error) {
      console.error(`[SoftwareInit] ✗ Failed to add ${software.display_name}:`, error);
    }
  }

  console.log(`[SoftwareInit] Initialized ${defaultSoftware.length} software configs`);
}
