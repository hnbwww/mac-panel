import { db } from './database';

// 修复服务器和数据库软件的配置路径和检测命令
export async function fixServerDatabaseConfigs() {
  console.log('[FixServerDatabase] Starting to fix server and database configs...');

  const fixes = [
    // ========== MySQL ==========
    {
      name: 'mysql',
      updates: {
        config_path: '/opt/homebrew/etc/my.cnf',
        commands: {
          install: 'brew install mysql@8.0',
          uninstall: 'brew uninstall mysql@8.0',
          start: 'brew services start mysql@8.0',
          stop: 'brew services stop mysql@8.0',
          restart: 'brew services restart mysql@8.0',
          status: 'brew services list | grep mysql',
          version: 'mysql --version',
          check_installed: 'brew list --versions | grep mysql || which mysql',
          check_process: 'pgrep -x mysqld',
          check_port: 'lsof -ti :3306',
          check_client: 'which mysql',
          check_service: 'brew services list | grep mysql'
        }
      }
    },

    // ========== PostgreSQL ==========
    {
      name: 'postgresql',
      updates: {
        config_path: '/opt/homebrew/var/postgresql@16/postgresql.conf',
        commands: {
          install: 'brew install postgresql@16',
          uninstall: 'brew uninstall postgresql@16',
          start: 'brew services start postgresql@16',
          stop: 'brew services stop postgresql@16',
          restart: 'brew services restart postgresql@16',
          status: 'brew services list | grep postgresql',
          version: '/opt/homebrew/opt/postgresql@16/bin/postgres --version',
          check_installed: 'brew list --versions | grep postgresql || ls /opt/homebrew/opt/postgresql@16',
          check_process: 'pgrep -x postgres || pgrep -x postmaster',
          check_port: 'lsof -ti :5432',
          check_client: 'which psql || ls /opt/homebrew/opt/postgresql@16/bin/psql',
          check_service: 'brew services list | grep postgresql'
        }
      }
    },

    // ========== PHP ==========
    {
      name: 'php',
      updates: {
        config_path: '/opt/homebrew/etc/php/8.3/php.ini',
        commands: {
          install: 'brew install php',
          uninstall: 'brew uninstall php',
          start: 'brew services start php',
          stop: 'brew services stop php',
          restart: 'brew services restart php',
          status: 'brew services list | grep php',
          version: 'php --version',
          check_installed: 'brew list --versions | grep php || which php',
          check_process: 'pgrep -x php-fpm || pgrep -f "php-fpm"',
          check_port: 'lsof -ti :9000',
          check_service: 'brew services list | grep php'
        }
      }
    },

    // ========== Redis ==========
    {
      name: 'redis',
      updates: {
        config_path: '/opt/homebrew/etc/redis.conf',
        commands: {
          install: 'brew install redis',
          uninstall: 'brew uninstall redis',
          start: 'brew services start redis',
          stop: 'brew services stop redis',
          restart: 'brew services restart redis',
          status: 'brew services list | grep redis',
          version: 'redis-cli --version',
          check_installed: 'brew list --versions | grep redis || which redis-cli',
          check_process: 'pgrep -x redis-server || pgrep -x redis',
          check_port: 'lsof -ti :6379',
          check_client: 'which redis-cli',
          check_service: 'brew services list | grep redis'
        }
      }
    },

    // ========== MongoDB ==========
    {
      name: 'mongodb',
      updates: {
        config_path: '/opt/homebrew/etc/mongod.conf',
        commands: {
          install: 'brew tap mongodb/brew && brew install mongodb-community',
          uninstall: 'brew uninstall mongodb-community',
          start: 'brew services start mongodb-community',
          stop: 'brew services stop mongodb-community',
          restart: 'brew services restart mongodb-community',
          status: 'brew services list | grep mongodb',
          version: 'mongod --version',
          check_installed: 'brew list --versions | grep mongodb || which mongod',
          check_process: 'pgrep -x mongod',
          check_port: 'lsof -ti :27017',
          check_service: 'brew services list | grep mongodb'
        }
      }
    },

    // ========== Nginx ==========
    {
      name: 'nginx',
      updates: {
        config_path: '/opt/homebrew/etc/nginx/nginx.conf',
        commands: {
          install: 'brew install nginx',
          uninstall: 'brew uninstall nginx',
          start: 'brew services start nginx',
          stop: 'brew services stop nginx',
          restart: 'brew services restart nginx',
          status: 'brew services list | grep nginx',
          version: 'nginx -v',
          check_installed: 'brew list --versions | grep nginx || which nginx',
          check_process: 'pgrep -x nginx',
          check_port: 'lsof -ti :80 || lsof -ti :8080',
          check_config: 'ls /opt/homebrew/etc/nginx/nginx.conf',
          check_service: 'brew services list | grep nginx'
        }
      }
    },

    // ========== Apache HTTPD ==========
    {
      name: 'apache',
      updates: {
        config_path: '/opt/homebrew/etc/httpd/httpd.conf',
        commands: {
          install: 'brew install httpd',
          uninstall: 'brew uninstall httpd',
          start: 'brew services start httpd',
          stop: 'brew services stop httpd',
          restart: 'brew services restart httpd',
          status: 'brew services list | grep httpd',
          version: 'httpd -v',
          check_installed: 'brew list --versions | grep httpd || which httpd',
          check_process: 'pgrep -x httpd',
          check_port: 'lsof -ti :8080',
          check_config: 'ls /opt/homebrew/etc/httpd/httpd.conf',
          check_service: 'brew services list | grep httpd'
        }
      }
    },

    // ========== Caddy ==========
    {
      name: 'caddy',
      updates: {
        config_path: '/opt/homebrew/etc/Caddyfile',
        commands: {
          install: 'brew install caddy',
          uninstall: 'brew uninstall caddy',
          start: 'brew services start caddy',
          stop: 'brew services stop caddy',
          restart: 'brew services restart caddy',
          status: 'brew services list | grep caddy',
          version: 'caddy version',
          check_installed: 'brew list --versions | grep caddy || which caddy',
          check_process: 'pgrep -x caddy',
          check_port: 'lsof -ti :2019',
          check_config: 'ls /opt/homebrew/etc/Caddyfile',
          check_service: 'brew services list | grep caddy'
        }
      }
    },

    // ========== Traefik ==========
    {
      name: 'traefik',
      updates: {
        config_path: '/opt/homebrew/etc/traefik/traefik.yml',
        commands: {
          install: 'brew install traefik',
          uninstall: 'brew uninstall traefik',
          start: 'brew services start traefik',
          stop: 'brew services stop traefik',
          restart: 'brew services restart traefik',
          status: 'brew services list | grep traefik',
          version: 'traefik version',
          check_installed: 'brew list --versions | grep traefik || which traefik',
          check_process: 'pgrep -x traefik',
          check_port: 'lsof -ti :8080',
          check_config: 'ls /opt/homebrew/etc/traefik/traefik.yml',
          check_service: 'brew services list | grep traefik'
        }
      }
    },

    // ========== SQLite ==========
    {
      name: 'sqlite',
      updates: {
        config_path: undefined,
        commands: {
          install: 'brew install sqlite',
          uninstall: 'brew uninstall sqlite',
          version: 'sqlite3 --version',
          check_installed: 'brew list --versions | grep sqlite || which sqlite3'
        }
      }
    },

    // ========== Elasticsearch ==========
    {
      name: 'elasticsearch',
      updates: {
        config_path: '/opt/homebrew/etc/elasticsearch/elasticsearch.yml',
        commands: {
          install: 'brew tap elastic/tap && brew install elastic/tap/elasticsearch-full',
          uninstall: 'brew uninstall elastic/tap/elasticsearch-full',
          start: 'elasticsearch',
          stop: 'pkill -f elasticsearch',
          status: 'pgrep -f elasticsearch',
          version: 'elasticsearch --version',
          check_installed: 'brew list --versions | grep elasticsearch || which elasticsearch',
          check_process: 'pgrep -f elasticsearch',
          check_port: 'lsof -ti :9200'
        }
      }
    },

    // ========== Memcached ==========
    {
      name: 'memcached',
      updates: {
        config_path: '/opt/homebrew/etc/memcached.conf',
        commands: {
          install: 'brew install memcached',
          uninstall: 'brew uninstall memcached',
          start: 'brew services start memcached',
          stop: 'brew services stop memcached',
          restart: 'brew services restart memcached',
          status: 'brew services list | grep memcached',
          version: 'memcached -V',
          check_installed: 'brew list --versions | grep memcached || which memcached',
          check_process: 'pgrep -x memcached',
          check_port: 'lsof -ti :11211',
          check_service: 'brew services list | grep memcached'
        }
      }
    },

    // ========== InfluxDB ==========
    {
      name: 'influxdb',
      updates: {
        config_path: '/opt/homebrew/etc/influxdb.conf',
        commands: {
          install: 'brew install influxdb',
          uninstall: 'brew uninstall influxdb',
          start: 'brew services start influxdb',
          stop: 'brew services stop influxdb',
          restart: 'brew services restart influxdb',
          status: 'brew services list | grep influxdb',
          version: 'influx --version',
          check_installed: 'brew list --versions | grep influxdb || which influx',
          check_process: 'pgrep -x influxd',
          check_port: 'lsof -ti :8086',
          check_service: 'brew services list | grep influxdb'
        }
      }
    },

    // ========== RabbitMQ ==========
    {
      name: 'rabbitmq',
      updates: {
        config_path: '/opt/homebrew/etc/rabbitmq/rabbitmq.conf',
        commands: {
          install: 'brew install rabbitmq',
          uninstall: 'brew uninstall rabbitmq',
          start: 'brew services start rabbitmq',
          stop: 'brew services stop rabbitmq',
          restart: 'brew services restart rabbitmq',
          status: 'brew services list | grep rabbitmq',
          version: 'rabbitmqctl version',
          check_installed: 'brew list --versions | grep rabbitmq || which rabbitmq-server',
          check_process: 'pgrep -x beam.smp',
          check_port: 'lsof -ti :5672',
          check_plugin: 'which rabbitmq-plugins',
          check_service: 'brew services list | grep rabbitmq'
        }
      }
    }
  ];

  let updated = 0;
  let failed = 0;

  for (const fix of fixes) {
    try {
      const config = await db.getSoftwareConfigByName(fix.name);
      if (!config) {
        console.log(`[FixServerDatabase] ⚠ Software ${fix.name} not found, skipping`);
        continue;
      }

      await db.updateSoftwareConfig(config.id, fix.updates);
      console.log(`[FixServerDatabase] ✓ Fixed ${config.display_name}`);
      updated++;
    } catch (error) {
      console.error(`[FixServerDatabase] ✗ Failed to fix ${fix.name}:`, error);
      failed++;
    }
  }

  console.log(`[FixServerDatabase] Complete: ${updated} fixed, ${failed} failed`);
  return { updated, failed };
}
