import { db } from './database';

// 额外的推荐软件配置
const additionalSoftwareConfigs = [
  // ========== 编程语言/运行时 ==========
  {
    name: 'go',
    display_name: 'Go',
    description: 'Google开发的现代编程语言',
    category: 'development' as const,
    icon: '🐹',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 15,
    commands: {
      install: 'brew install go',
      uninstall: 'brew uninstall go',
      version: 'go version'
    }
  },

  {
    name: 'rust',
    display_name: 'Rust',
    description: '系统级编程语言，高性能和内存安全',
    category: 'development' as const,
    icon: '🦀',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 16,
    commands: {
      install: 'rustup-init',
      uninstall: 'rustup self uninstall',
      version: 'rustc --version'
    }
  },

  {
    name: 'ruby',
    display_name: 'Ruby',
    description: '动态编程语言，Web开发流行',
    category: 'development' as const,
    icon: '💎',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 17,
    commands: {
      install: 'brew install ruby',
      uninstall: 'brew uninstall ruby',
      version: 'ruby --version'
    }
  },

  {
    name: 'deno',
    display_name: 'Deno',
    description: '现代JavaScript/TypeScript运行时',
    category: 'development' as const,
    icon: '🦕',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 18,
    commands: {
      install: 'brew install deno',
      uninstall: 'brew uninstall deno',
      version: 'deno --version'
    }
  },

  {
    name: 'bun',
    display_name: 'Bun',
    description: '超快的JavaScript运行时和包管理器',
    category: 'development' as const,
    icon: '🥟',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 19,
    commands: {
      install: 'brew install oven-sh/bun/bun',
      uninstall: 'brew uninstall oven-sh/bun/bun',
      version: 'bun --version'
    }
  },

  // ========== Web服务器 ==========
  {
    name: 'caddy',
    display_name: 'Caddy',
    description: '自动HTTPS的现代Web服务器',
    category: 'server' as const,
    icon: '🏮',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 20,
    config_path: '/opt/homebrew/etc/Caddyfile',
    commands: {
      install: 'brew install caddy',
      uninstall: 'brew uninstall caddy',
      start: 'brew services start caddy',
      stop: 'brew services stop caddy',
      restart: 'brew services restart caddy',
      status: 'brew services list | grep caddy',
      version: 'caddy version'
    },
    log_paths: {
      application: '/opt/homebrew/var/log/caddy.log'
    }
  },

  {
    name: 'traefik',
    display_name: 'Traefik',
    description: '云原生反向代理和负载均衡器',
    category: 'server' as const,
    icon: '🚦',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 21,
    config_path: '/opt/homebrew/etc/traefik/traefik.yml',
    commands: {
      install: 'brew install traefik',
      uninstall: 'brew uninstall traefik',
      start: 'brew services start traefik',
      stop: 'brew services stop traefik',
      restart: 'brew services restart traefik',
      status: 'brew services list | grep traefik',
      version: 'traefik version'
    }
  },

  // ========== 数据库/存储 ==========
  {
    name: 'sqlite',
    display_name: 'SQLite',
    description: '轻量级嵌入式数据库',
    category: 'database' as const,
    icon: '🗄️',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 23,
    commands: {
      install: 'brew install sqlite',
      uninstall: 'brew uninstall sqlite',
      version: 'sqlite3 --version'
    }
  },

  {
    name: 'elasticsearch',
    display_name: 'Elasticsearch',
    description: '全文搜索引擎和日志分析',
    category: 'database' as const,
    icon: '🔍',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 24,
    config_path: '/opt/homebrew/etc/elasticsearch.yml',
    commands: {
      install: 'brew tap elastic/tap && brew install elastic/tap/elasticsearch-full',
      uninstall: 'brew uninstall elastic/tap/elasticsearch-full',
      start: 'elasticsearch',
      stop: 'pkill -f elasticsearch',
      status: 'pgrep -f elasticsearch',
      version: 'elasticsearch --version'
    }
  },

  {
    name: 'memcached',
    display_name: 'Memcached',
    description: '高性能内存缓存系统',
    category: 'database' as const,
    icon: '💾',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 25,
    commands: {
      install: 'brew install memcached',
      uninstall: 'brew uninstall memcached',
      start: 'brew services start memcached',
      stop: 'brew services stop memcached',
      restart: 'brew services restart memcached',
      status: 'brew services list | grep memcached',
      version: 'memcached -V'
    }
  },

  {
    name: 'influxdb',
    display_name: 'InfluxDB',
    description: '时序数据库，用于监控和IoT数据',
    category: 'database' as const,
    icon: '📊',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 26,
    config_path: '/opt/homebrew/etc/influxdb.conf',
    commands: {
      install: 'brew install influxdb',
      uninstall: 'brew uninstall influxdb',
      start: 'brew services start influxdb',
      stop: 'brew services stop influxdb',
      restart: 'brew services restart influxdb',
      status: 'brew services list | grep influxdb',
      version: 'influx --version'
    }
  },

  {
    name: 'rabbitmq',
    display_name: 'RabbitMQ',
    description: '消息队列服务',
    category: 'database' as const,
    icon: '🐰',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 28,
    config_path: '/opt/homebrew/etc/rabbitmq/rabbitmq.conf',
    commands: {
      install: 'brew install rabbitmq',
      uninstall: 'brew uninstall rabbitmq',
      start: 'brew services start rabbitmq',
      stop: 'brew services stop rabbitmq',
      restart: 'brew services restart rabbitmq',
      status: 'brew services list | grep rabbitmq',
      version: 'rabbitmqctl version'
    }
  },

  // ========== 包管理/构建工具 ==========
  {
    name: 'composer',
    display_name: 'Composer',
    description: 'PHP依赖管理工具',
    category: 'tool' as const,
    icon: '🎼',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 30,
    commands: {
      install: 'brew install composer',
      uninstall: 'brew uninstall composer',
      version: 'composer --version'
    }
  },

  {
    name: 'maven',
    display_name: 'Maven',
    description: 'Java项目管理和构建工具',
    category: 'tool' as const,
    icon: '📦',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 31,
    commands: {
      install: 'brew install maven',
      uninstall: 'brew uninstall maven',
      version: 'mvn -version'
    }
  },

  {
    name: 'gradle',
    display_name: 'Gradle',
    description: 'Java自动化构建工具',
    category: 'tool' as const,
    icon: '🐘',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 32,
    commands: {
      install: 'brew install gradle',
      uninstall: 'brew uninstall gradle',
      version: 'gradle --version'
    }
  },

  {
    name: 'yarn',
    display_name: 'Yarn',
    description: 'JavaScript包管理器',
    category: 'tool' as const,
    icon: '🧶',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 33,
    commands: {
      install: 'brew install yarn',
      uninstall: 'brew uninstall yarn',
      version: 'yarn --version'
    }
  },

  {
    name: 'pnpm',
    display_name: 'pnpm',
    description: '快速的Node.js包管理器',
    category: 'tool' as const,
    icon: '⚡',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 34,
    commands: {
      install: 'npm install -g pnpm',
      uninstall: 'npm uninstall -g pnpm',
      version: 'pnpm --version'
    }
  },

  // ========== 开发工具 ==========
  {
    name: 'docker-compose',
    display_name: 'Docker Compose',
    description: 'Docker多容器编排工具',
    category: 'utility' as const,
    icon: '🐳',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 35,
    commands: {
      install: 'brew install docker-compose',
      uninstall: 'brew uninstall docker-compose',
      version: 'docker-compose --version'
    }
  },

  {
    name: 'kubectl',
    display_name: 'kubectl',
    description: 'Kubernetes命令行工具',
    category: 'utility' as const,
    icon: '☸️',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 36,
    commands: {
      install: 'brew install kubectl',
      uninstall: 'brew uninstall kubectl',
      version: 'kubectl version --client'
    }
  },

  {
    name: 'minikube',
    display_name: 'Minikube',
    description: '本地Kubernetes环境',
    category: 'utility' as const,
    icon: '🎲',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 37,
    commands: {
      install: 'brew install minikube',
      uninstall: 'brew uninstall minikube',
      start: 'minikube start',
      stop: 'minikube stop',
      status: 'minikube status',
      version: 'minikube version'
    }
  },

  {
    name: 'tmux',
    display_name: 'Tmux',
    description: '终端复用器',
    category: 'utility' as const,
    icon: '🖥️',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 38,
    commands: {
      install: 'brew install tmux',
      uninstall: 'brew uninstall tmux',
      version: 'tmux -V'
    }
  },

  {
    name: 'htop',
    display_name: 'htop',
    description: '交互式进程查看器',
    category: 'utility' as const,
    icon: '📊',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 39,
    commands: {
      install: 'brew install htop',
      uninstall: 'brew uninstall htop',
      version: 'htop --version'
    }
  },

  {
    name: 'ffmpeg',
    display_name: 'FFmpeg',
    description: '视频处理工具',
    category: 'utility' as const,
    icon: '🎬',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 40,
    commands: {
      install: 'brew install ffmpeg',
      uninstall: 'brew uninstall ffmpeg',
      version: 'ffmpeg -version'
    }
  },

  {
    name: 'imagemagick',
    display_name: 'ImageMagick',
    description: '图像处理工具',
    category: 'utility' as const,
    icon: '🎨',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 41,
    commands: {
      install: 'brew install imagemagick',
      uninstall: 'brew uninstall imagemagick',
      version: 'convert --version'
    }
  },

  // ========== 监控/日志 ==========
  {
    name: 'grafana',
    display_name: 'Grafana',
    description: '数据可视化监控平台',
    category: 'tool' as const,
    icon: '📈',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 42,
    config_path: '/opt/homebrew/etc/grafana/grafana.ini',
    commands: {
      install: 'brew install grafana',
      uninstall: 'brew uninstall grafana',
      start: 'brew services start grafana',
      stop: 'brew services stop grafana',
      restart: 'brew services restart grafana',
      status: 'brew services list | grep grafana',
      version: 'grafana-cli --version'
    }
  },

  {
    name: 'prometheus',
    display_name: 'Prometheus',
    description: '监控系统和时间序列数据库',
    category: 'tool' as const,
    icon: '🔥',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 43,
    config_path: '/opt/homebrew/etc/prometheus.yml',
    commands: {
      install: 'brew install prometheus',
      uninstall: 'brew uninstall prometheus',
      start: 'brew services start prometheus',
      stop: 'brew services stop prometheus',
      restart: 'brew services restart prometheus',
      status: 'brew services list | grep prometheus',
      version: 'prometheus --version'
    }
  },

  // ========== 浏览器 ==========
  {
    name: 'chrome',
    display_name: 'Google Chrome',
    description: 'Google 官方网页浏览器',
    category: 'web' as const,
    icon: '🌐',
    installed: false,
    status: 'unknown' as const,
    enabled: true,
    sort_order: 44,
    commands: {
      install: 'brew install --cask google-chrome',
      uninstall: 'brew uninstall --cask google-chrome',
      version: '/Applications/Google\\ Chrome.app/Contents/Version.plist'
    }
  },
];

// 添加额外软件到数据库
export async function addAdditionalSoftware() {
  console.log('[AdditionalSoftware] Adding recommended software...');

  let added = 0;
  let skipped = 0;

  for (const software of additionalSoftwareConfigs) {
    try {
      // 检查是否已存在
      const existing = await db.getSoftwareConfigByName(software.name);
      if (existing) {
        console.log(`[AdditionalSoftware] ⊘ Skipped ${software.display_name} (already exists)`);
        skipped++;
        continue;
      }

      // 添加到数据库
      await db.createSoftwareConfig(software);
      console.log(`[AdditionalSoftware] ✓ Added ${software.display_name}`);
      added++;
    } catch (error) {
      console.error(`[AdditionalSoftware] ✗ Failed to add ${software.display_name}:`, error);
    }
  }

  console.log(`[AdditionalSoftware] Complete: ${added} added, ${skipped} skipped`);
  return { added, skipped };
}
