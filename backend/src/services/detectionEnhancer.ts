import { db } from './database';

// 更新软件配置，添加专门的进程检测和安装检测命令
export async function enhanceSoftwareDetection() {
  console.log('[DetectionEnhancer] Enhancing software detection...');

  const configs = await db.listSoftwareConfigs(true);
  let updated = 0;

  for (const config of configs) {
    try {
      let updates: any = {};

      // 根据软件类型添加专门的检测命令
      switch (config.name) {
        case 'nginx':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x nginx',
              check_installed: 'which nginx || nginx -v',
              check_port: 'lsof -ti :80 || lsof -ti :8080'
            }
          };
          break;

        case 'apache':
        case 'httpd':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x httpd',
              check_installed: 'which httpd || httpd -v',
              check_port: 'lsof -ti :8080'
            }
          };
          break;

        case 'mysql':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x mysqld',
              check_installed: 'which mysql || mysql --version',
              check_port: 'lsof -ti :3306',
              check_client: 'which mysql'
            }
          };
          break;

        case 'postgresql':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x postgres || pgrep -x postmaster',
              check_installed: 'which postgres || postgres --version',
              check_port: 'lsof -ti :5432',
              check_client: 'which psql'
            }
          };
          break;

        case 'redis':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x redis-server || pgrep -x redis',
              check_installed: 'which redis-cli || redis-cli --version',
              check_port: 'lsof -ti :6379'
            }
          };
          break;

        case 'mongodb':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x mongod',
              check_installed: 'which mongod || mongod --version',
              check_port: 'lsof -ti :27017'
            }
          };
          break;

        case 'node':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x node',
              check_installed: 'which node || node --version',
              check_npm: 'which npm || npm --version'
            }
          };
          break;

        case 'python':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x python3 || pgrep -x python',
              check_installed: 'which python3 || python3 --version',
              check_pip: 'which pip3 || pip3 --version'
            }
          };
          break;

        case 'php':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x php-fpm || pgrep -x php',
              check_installed: 'which php || php --version',
              check_composer: 'which composer || composer --version'
            }
          };
          break;

        case 'java':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep java',
              check_installed: 'which java || java -version',
              check_javac: 'which javac || javac -version'
            }
          };
          break;

        case 'docker':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x Docker',
              check_installed: 'which docker || docker --version',
              check_compose: 'which docker-compose || docker-compose --version'
            }
          };
          break;

        case 'git':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which git || git --version'
            }
          };
          break;

        case 'go':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x go',
              check_installed: 'which go || go version'
            }
          };
          break;

        case 'rust':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which rustc || rustc --version',
              check_cargo: 'which cargo || cargo --version'
            }
          };
          break;

        case 'ruby':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x ruby',
              check_installed: 'which ruby || ruby --version',
              check_gem: 'which gem || gem --version'
            }
          };
          break;

        case 'deno':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which deno || deno --version'
            }
          };
          break;

        case 'bun':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which bun || bun --version'
            }
          };
          break;

        case 'caddy':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x caddy',
              check_installed: 'which caddy || caddy version',
              check_port: 'lsof -ti :2019'
            }
          };
          break;

        case 'traefik':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x traefik',
              check_installed: 'which traefik || traefik version',
              check_port: 'lsof -ti :8080'
            }
          };
          break;

        case 'sqlite':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which sqlite3 || sqlite3 --version'
            }
          };
          break;

        case 'elasticsearch':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -f elasticsearch',
              check_installed: 'which elasticsearch || elasticsearch --version',
              check_port: 'lsof -ti :9200'
            }
          };
          break;

        case 'memcached':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x memcached',
              check_installed: 'which memcached || memcached -V',
              check_port: 'lsof -ti :11211'
            }
          };
          break;

        case 'influxdb':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x influxd',
              check_installed: 'which influx || influx --version',
              check_port: 'lsof -ti :8086'
            }
          };
          break;

        case 'couchdb':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x beam.smp || pgrep -f couchdb',
              check_installed: 'which couchdb || couchdb --version',
              check_port: 'lsof -ti :5984'
            }
          };
          break;

        case 'rabbitmq':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x beam.smp',
              check_installed: 'which rabbitmq-server || rabbitmq-server --version',
              check_port: 'lsof -ti :5672',
              check_plugin: 'which rabbitmq-plugins'
            }
          };
          break;

        case 'kafka':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x kafka',
              check_installed: 'brew list --versions | grep kafka',
              check_port: 'lsof -ti :9092'
            }
          };
          break;

        case 'composer':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which composer || composer --version',
              check_php: 'which php'
            }
          };
          break;

        case 'maven':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which mvn || mvn -version',
              check_java: 'which java'
            }
          };
          break;

        case 'gradle':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which gradle || gradle --version',
              check_java: 'which java'
            }
          };
          break;

        case 'yarn':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which yarn || yarn --version',
              check_node: 'which node'
            }
          };
          break;

        case 'pnpm':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which pnpm || pnpm --version',
              check_node: 'which node'
            }
          };
          break;

        case 'docker-compose':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which docker-compose || docker-compose --version',
              check_docker: 'which docker'
            }
          };
          break;

        case 'kubectl':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which kubectl || kubectl version --client'
            }
          };
          break;

        case 'minikube':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x minikube',
              check_installed: 'which minikube || minikube version',
              check_docker: 'which docker'
            }
          };
          break;

        case 'tmux':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which tmux || tmux -V'
            }
          };
          break;

        case 'htop':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which htop || htop --version'
            }
          };
          break;

        case 'ffmpeg':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which ffmpeg || ffmpeg -version'
            }
          };
          break;

        case 'imagemagick':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'which convert || convert --version'
            }
          };
          break;

        case 'grafana':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x grafana',
              check_installed: 'which grafana-cli || grafana-cli --version',
              check_port: 'lsof -ti :3000'
            }
          };
          break;

        case 'prometheus':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -x prometheus',
              check_installed: 'which prometheus || prometheus --version',
              check_port: 'lsof -ti :9090'
            }
          };
          break;

        case 'openclaw':
          updates = {
            commands: {
              ...config.commands,
              check_process: 'pgrep -f openclaw.gateway',
              check_installed: 'which openclaw || openclaw version',
              check_launchctl: 'launchctl list | grep openclaw.gateway',
              check_logs: 'ls ~/.openclaw/logs/gateway.log 2>/dev/null'
            }
          };
          break;

        case 'claude-code':
          updates = {
            commands: {
              ...config.commands,
              check_installed: 'npm list -g @anthropic-ai/claude-code',
              check_cli: 'which claude || claude --version'
            }
          };
          break;

        case 'chrome':
          updates = {
            display_name: 'Google Chrome',
            description: 'Google 官方网页浏览器',
            commands: {
              install: 'brew install --cask google-chrome',
              uninstall: 'brew uninstall --cask google-chrome',
              check_installed: 'ls /Applications/Google\\ Chrome.app 2>/dev/null',
              check_process: 'pgrep -f "Google Chrome"',
              version: '/Applications/Google\\ Chrome.app/Contents/Version.plist'
            }
          };
          break;
      }

      if (Object.keys(updates).length > 0) {
        await db.updateSoftwareConfig(config.id, updates);
        console.log(`[DetectionEnhancer] ✓ Enhanced ${config.display_name}`);
        updated++;
      }
    } catch (error) {
      console.error(`[DetectionEnhancer] ✗ Failed to enhance ${config.display_name}:`, error);
    }
  }

  console.log(`[DetectionEnhancer] Complete: ${updated} software enhanced`);
  return { updated };
}
