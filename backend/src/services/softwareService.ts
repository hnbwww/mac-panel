import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Software {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: 'web' | 'database' | 'language' | 'tool' | 'system';
  installed: boolean;
  version?: string;
  status: 'running' | 'stopped' | 'unknown';
  configPath?: string;
  commands: {
    install: string;
    uninstall: string;
    start?: string;
    stop?: string;
    restart?: string;
    status?: string;
    version?: string;
    repair?: string;
  };
  availableVersions?: string[];
  requiresPassword?: boolean;
  defaultPassword?: string;
}

interface SoftwareList {
  [key: string]: Software;
}

class SoftwareService {
  private softwareList: SoftwareList;
  private configDir: string;

  constructor() {
    this.softwareList = this.getDefaultSoftwareList();
    this.configDir = path.join(process.cwd(), 'data', 'software');
    this.ensureConfigDir();
  }

  private ensureConfigDir() {
    fs.ensureDirSync(this.configDir);
  }

  private async checkOpenClawSoftwareStatus(software: Software): Promise<Software> {
    try {
      // 优先检查进程是否存在，如果存在则认为已安装并运行
      try {
        const { stdout } = await execAsync('pgrep -f openclaw', { timeout: 5000 });
        if (stdout.trim().length > 0) {
          software.installed = true;
          software.status = 'running';

          // 尝试获取版本
          try {
            const { stdout: versionOutput } = await execAsync('openclaw version', { timeout: 5000 });
            const versionMatch = versionOutput.match(/([\d.]+)/);
            software.version = versionMatch ? versionMatch[0] : 'unknown';
          } catch {
            software.version = 'unknown';
          }

          return software;
        }
      } catch {
        // 进程不存在，继续检查是否已安装但未运行
      }

      // 检查是否安装（通过 which 命令）
      try {
        await execAsync('which openclaw', { timeout: 5000 });
        software.installed = true;
        software.status = 'stopped';
      } catch {
        software.installed = false;
        software.status = 'unknown';
        return software;
      }

      // 检查版本
      try {
        const { stdout } = await execAsync('openclaw version', { timeout: 5000 });
        const versionMatch = stdout.match(/([\d.]+)/);
        software.version = versionMatch ? versionMatch[0] : 'unknown';
      } catch {
        software.version = 'unknown';
      }

      return software;
    } catch (error) {
      software.installed = false;
      software.status = 'unknown';
      return software;
    }
  }

  private async checkClaudeCodeSoftwareStatus(software: Software): Promise<Software> {
    try {
      // 检查是否通过 npm 全局安装
      try {
        const { stdout } = await execAsync('npm list -g @anthropic-ai/claude-code', { timeout: 10000 });
        if (stdout.includes('@anthropic-ai/claude-code')) {
          software.installed = true;
          // 尝试获取版本
          try {
            const { stdout: versionOutput } = await execAsync('claude --version', { timeout: 5000 });
            const versionMatch = versionOutput.match(/([\d.]+)/);
            software.version = versionMatch ? versionMatch[0] : 'installed';
          } catch {
            software.version = 'installed';
          }
          software.status = 'unknown'; // CLI 工具没有运行状态
        } else {
          software.installed = false;
          software.status = 'unknown';
        }
      } catch {
        // npm list 失败，尝试直接运行 claude 命令
        try {
          const { stdout: versionOutput } = await execAsync('claude --version', { timeout: 5000 });
          software.installed = true;
          const versionMatch = versionOutput.match(/([\d.]+)/);
          software.version = versionMatch ? versionMatch[0] : 'installed';
          software.status = 'unknown';
        } catch {
          software.installed = false;
          software.status = 'unknown';
        }
      }
      return software;
    } catch (error) {
      software.installed = false;
      software.status = 'unknown';
      return software;
    }
  }

  private async checkJavaSoftwareStatus(software: Software): Promise<Software> {
    try {
      const detectedJDKs: string[] = [];

      // 1. 检查 /Library/Java/JavaVirtualMachines/ (macOS 系统 JDK 安装位置)
      try {
        const { stdout } = await execAsync('ls /Library/Java/JavaVirtualMachines/ 2>/dev/null', { timeout: 5000 });
        const jvms = stdout.trim().split('\n').filter(line => line.includes('jdk'));

        for (const jvm of jvms) {
          // 提取版本号，如 openjdk-17.jdk -> 17
          const versionMatch = jvm.match(/(\d+)/);
          if (versionMatch) {
            detectedJDKs.push(versionMatch[1]);
          }
        }
      } catch {
        // 目录不存在或无权限，继续检查其他位置
      }

      // 2. 检查 Homebrew 安装的 openjdk
      try {
        const { stdout } = await execAsync('brew list --versions | grep "^openjdk"', { timeout: 5000 });
        const brewVersions = stdout.trim().split('\n');

        for (const line of brewVersions) {
          // 格式: openjdk 21.0.2 或 openjdk@17 17.0.18
          const versionMatch = line.match(/(\d+)/);
          if (versionMatch) {
            const version = versionMatch[1];
            if (!detectedJDKs.includes(version)) {
              detectedJDKs.push(version);
            }
          }
        }
      } catch {
        // Homebrew 未安装 openjdk
      }

      // 3. 检查 /opt/homebrew/opt/ 目录
      try {
        const { stdout } = await execAsync('ls /opt/homebrew/opt/ 2>/dev/null | grep openjdk', { timeout: 5000 });
        const optJdks = stdout.trim().split('\n');

        for (const jdk of optJdks) {
          // openjdk@17 -> 17
          const versionMatch = jdk.match(/openjdk@?(\d+)/);
          if (versionMatch) {
            const version = versionMatch[1];
            if (!detectedJDKs.includes(version)) {
              detectedJDKs.push(version);
            }
          }
        }
      } catch {
        // 目录不存在
      }

      // 4. 检查系统默认 java 命令
      try {
        const { stdout } = await execAsync('java -version 2>&1', { timeout: 5000 });
        const versionMatch = stdout.match(/version "([^"]+)"/);
        if (versionMatch) {
          const fullVersion = versionMatch[1];
          const majorVersion = fullVersion.split('.')[0];
          if (!detectedJDKs.includes(majorVersion)) {
            detectedJDKs.push(majorVersion);
          }
        }
      } catch {
        // java 命令不可用
      }

      // 去重并排序版本
      const uniqueVersions = [...new Set(detectedJDKs)].sort((a, b) => parseInt(b) - parseInt(a));

      if (uniqueVersions.length > 0) {
        software.installed = true;
        // 使用最小版本号作为主版本（通常是 17）
        software.version = uniqueVersions[0];

        // 检测是否正在运行（任何 JVM 进程）
        try {
          const { stdout } = await execAsync('pgrep -f "java.*process"', { timeout: 5000 });
          software.status = stdout.trim().length > 0 ? 'running' : 'stopped';
        } catch {
          software.status = 'stopped';
        }
      } else {
        software.installed = false;
        software.status = 'unknown';
      }

      return software;
    } catch (error) {
      software.installed = false;
      software.status = 'unknown';
      return software;
    }
  }

  private getDefaultSoftwareList(): SoftwareList {
    return {
      nginx: {
        id: 'nginx',
        name: 'nginx',
        displayName: 'Nginx',
        description: '高性能 Web 服务器和反向代理',
        category: 'web',
        installed: false,
        status: 'unknown',
        configPath: '/opt/homebrew/etc/nginx/nginx.conf',
        commands: {
          install: 'brew install nginx',
          uninstall: 'brew uninstall nginx',
          start: 'brew services start nginx',
          stop: 'brew services stop nginx',
          restart: 'brew services restart nginx',
          status: 'brew services list | grep nginx',
          version: 'nginx -v 2>&1'
        }
      },
      apache: {
        id: 'apache',
        name: 'apache',
        displayName: 'Apache HTTPD',
        description: '流行的 Web 服务器',
        category: 'web',
        installed: false,
        status: 'unknown',
        configPath: '/opt/homebrew/etc/httpd/httpd.conf',
        commands: {
          install: 'brew install httpd',
          uninstall: 'brew uninstall httpd',
          start: 'brew services start httpd',
          stop: 'brew services stop httpd',
          restart: 'brew services restart httpd',
          status: 'brew services list | grep httpd',
          version: 'httpd -v'
        }
      },
      mysql: {
        id: 'mysql',
        name: 'mysql',
        displayName: 'MySQL',
        description: '流行的关系型数据库',
        category: 'database',
        installed: false,
        status: 'unknown',
        configPath: '/opt/homebrew/etc/my.cnf',
        availableVersions: ['9.0', '8.4', '8.0'],
        requiresPassword: true,
        defaultPassword: 'root',
        commands: {
          install: 'brew install mysql', // 默认安装最新版
          uninstall: 'brew uninstall mysql',
          start: 'brew services start mysql',
          stop: 'brew services stop mysql',
          restart: 'brew services restart mysql',
          status: 'brew services list | grep mysql',
          version: 'mysql --version'
        }
      },
      postgresql: {
        id: 'postgresql',
        name: 'postgresql',
        displayName: 'PostgreSQL',
        description: '强大的开源关系型数据库',
        category: 'database',
        installed: false,
        status: 'unknown',
        configPath: '/opt/homebrew/var/postgres/postgresql.conf',
        availableVersions: ['18', '17', '16', '15', '14'],
        requiresPassword: true,
        defaultPassword: 'postgres',
        commands: {
          install: 'brew install postgresql@18', // 默认安装最新版
          uninstall: 'brew uninstall postgresql@18',
          start: 'brew services start postgresql@18',
          stop: 'brew services stop postgresql@18',
          restart: 'brew services restart postgresql@18',
          status: 'brew services list | grep postgresql',
          version: 'psql --version'
        }
      },
      redis: {
        id: 'redis',
        name: 'redis',
        displayName: 'Redis',
        description: '高性能键值存储数据库',
        category: 'database',
        installed: false,
        status: 'unknown',
        configPath: '/opt/homebrew/etc/redis.conf',
        commands: {
          install: 'brew install redis',
          uninstall: 'brew uninstall redis',
          start: 'brew services start redis',
          stop: 'brew services stop redis',
          restart: 'brew services restart redis',
          status: 'brew services list | grep redis',
          version: 'redis-cli --version'
        }
      },
      mongodb: {
        id: 'mongodb',
        name: 'mongodb',
        displayName: 'MongoDB',
        description: '流行的 NoSQL 数据库',
        category: 'database',
        installed: false,
        status: 'unknown',
        configPath: '/opt/homebrew/etc/mongod.conf',
        availableVersions: ['8.0', '7.0', '6.0'],
        requiresPassword: false,
        commands: {
          install: 'brew tap mongodb/brew && brew install mongodb-community',
          uninstall: 'brew uninstall mongodb-community',
          start: 'brew services start mongodb-community',
          stop: 'brew services stop mongodb-community',
          restart: 'brew services restart mongodb-community',
          status: 'brew services list | grep mongodb',
          version: 'mongod --version'
        }
      },
      node: {
        id: 'node',
        name: 'node',
        displayName: 'Node.js',
        description: 'JavaScript 运行时环境',
        category: 'language',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install node',
          uninstall: 'brew uninstall node',
          version: 'node --version'
        }
      },
      python: {
        id: 'python',
        name: 'python',
        displayName: 'Python',
        description: '流行的编程语言',
        category: 'language',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install python',
          uninstall: 'brew uninstall python',
          version: 'python3 --version'
        }
      },
      php: {
        id: 'php',
        name: 'php',
        displayName: 'PHP',
        description: '流行的 Web 开发语言',
        category: 'language',
        installed: false,
        status: 'unknown',
        availableVersions: ['8.4', '8.3', '8.2', '8.1', '8.0'],
        commands: {
          install: 'brew install php', // 默认安装最新版
          uninstall: 'brew uninstall php',
          start: 'brew services start php',
          stop: 'brew services stop php',
          restart: 'brew services restart php',
          status: 'brew services list | grep php',
          version: 'php --version'
        }
      },
      java: {
        id: 'java',
        name: 'java',
        displayName: 'Java (OpenJDK)',
        description: '流行的跨平台编程语言',
        category: 'language',
        installed: false,
        status: 'unknown',
        availableVersions: ['21', '17', '11', '8'],
        commands: {
          install: 'brew install openjdk', // 默认安装最新版
          uninstall: 'brew uninstall openjdk',
          version: 'java -version'
        }
      },
      maven: {
        id: 'maven',
        name: 'maven',
        displayName: 'Maven',
        description: 'Java 项目管理和构建工具（Homebrew 最新版）',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install maven',
          uninstall: 'brew uninstall maven',
          version: 'mvn -version'
        }
      },
      gradle: {
        id: 'gradle',
        name: 'gradle',
        displayName: 'Gradle',
        description: 'Java 项目自动化构建工具',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install gradle',
          uninstall: 'brew uninstall gradle',
          version: 'gradle --version'
        }
      },
      go: {
        id: 'go',
        name: 'go',
        displayName: 'Go',
        description: 'Google 开发的编程语言',
        category: 'language',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install go',
          uninstall: 'brew uninstall go',
          version: 'go version'
        }
      },
      docker: {
        id: 'docker',
        name: 'docker',
        displayName: 'Docker',
        description: '容器化平台',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install --cask docker',
          uninstall: 'brew uninstall --cask docker',
          version: 'docker --version'
        }
      },
      git: {
        id: 'git',
        name: 'git',
        displayName: 'Git',
        description: '版本控制系统',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install git',
          uninstall: 'brew uninstall git',
          version: 'git --version'
        }
      },
      composer: {
        id: 'composer',
        name: 'composer',
        displayName: 'Composer',
        description: 'PHP 依赖管理工具',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install composer',
          uninstall: 'brew uninstall composer',
          version: 'composer --version'
        }
      },
      minio: {
        id: 'minio',
        name: 'minio',
        displayName: 'MinIO',
        description: '高性能对象存储服务（Homebrew 最新版本）',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'brew install minio',
          uninstall: 'brew uninstall minio',
          start: 'minio server /data --console-address ":9001"',
          stop: 'pkill minio',
          restart: 'pkill minio && minio server /data --console-address ":9001"',
          status: 'pgrep minio',
          version: 'minio --version'
        }
      },
      openclaw: {
        id: 'openclaw',
        name: 'openclaw',
        displayName: 'OpenClaw',
        description: '自动化服务器管理工具',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw/main/install.sh | bash',
          uninstall: 'openclaw uninstall',
          start: 'launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist',
          stop: 'launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist',
          restart: 'launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist && sleep 1 && launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist',
          status: 'openclaw status',
          version: 'openclaw version',
          repair: 'openclaw doctor --fix'
        }
      },
      'claude-code': {
        id: 'claude-code',
        name: 'claude-code',
        displayName: 'Claude Code',
        description: 'Anthropic 官方 AI 编程助手 CLI 工具',
        category: 'tool',
        installed: false,
        status: 'unknown',
        commands: {
          install: 'npm install -g @anthropic-ai/claude-code',
          uninstall: 'npm uninstall -g @anthropic-ai/claude-code',
          version: 'claude --version'
        }
      }
    };
  }

  async checkAllSoftware(): Promise<Software[]> {
    const softwareList = Object.values(this.softwareList);

    for (const software of softwareList) {
      await this.checkSoftwareStatus(software.id);
    }

    return Object.values(this.softwareList);
  }

  async checkSoftwareStatus(id: string): Promise<Software> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    try {
      // OpenClaw 特殊处理
      if (id === 'openclaw') {
        return await this.checkOpenClawSoftwareStatus(software);
      }

      // Claude Code 特殊处理 - 通过 npm 全局安装检测
      if (id === 'claude-code') {
        return await this.checkClaudeCodeSoftwareStatus(software);
      }

      // Java 特殊处理 - 检测系统中所有 JDK 安装
      if (id === 'java') {
        return await this.checkJavaSoftwareStatus(software);
      }

      // 检查是否已安装
      let isInstalled = false;
      let detectedVersion = 'unknown';

      // 对于有可选版本的软件，使用 brew list --versions 来检测
      if (software.availableVersions) {
        try {
          const { stdout } = await execAsync(`brew list --versions | grep "^${id}"`, { timeout: 5000 });
          if (stdout.trim()) {
            isInstalled = true;
            // 输出格式: php@8.4 8.4.18 或 postgresql@18 18.3
            const versionMatch = stdout.match(/[\d.]+/);
            if (versionMatch) {
              detectedVersion = versionMatch[0];
            }
          }
        } catch {
          // brew list 失败，尝试版本命令
          if (software.commands.version) {
            try {
              const { stdout } = await execAsync(software.commands.version, { timeout: 5000 });
              isInstalled = true;
              const versionMatch = stdout.match(/([\d.]+)/);
              if (versionMatch) {
                detectedVersion = versionMatch[0];
              }
            } catch {
              isInstalled = false;
            }
          }
        }
      } else if (software.commands.version) {
        // 没有可选版本，直接使用默认命令
        const { stdout } = await execAsync(software.commands.version, { timeout: 5000 });
        isInstalled = true;
        const versionMatch = stdout.match(/[\d.]+/);
        detectedVersion = versionMatch ? versionMatch[0] : 'unknown';
      }

      software.installed = isInstalled;
      software.version = detectedVersion;

      // 如果检测到版本，更新命令以使用版本特定的包名
      // 即使版本不在可用列表中，也要更新命令（支持任意已安装版本）
      if (isInstalled && detectedVersion !== 'unknown') {
        const majorVersion = detectedVersion.split('.')[0]; // 获取主版本号

        if (id === 'mysql') {
          // MySQL 9.x 使用默认包名，其他版本使用 @version
          if (majorVersion === '9') {
            // MySQL 9.x 使用默认包名，不添加版本后缀
          } else {
            software.commands.start = `brew services start mysql@${detectedVersion}`;
            software.commands.stop = `brew services stop mysql@${detectedVersion}`;
            software.commands.restart = `brew services restart mysql@${detectedVersion}`;
          }
        } else if (id === 'php') {
          software.commands.start = `brew services start php@${detectedVersion}`;
          software.commands.stop = `brew services stop php@${detectedVersion}`;
          software.commands.restart = `brew services restart php@${detectedVersion}`;
        } else if (id === 'postgresql') {
          software.commands.start = `brew services start postgresql@${detectedVersion}`;
          software.commands.stop = `brew services stop postgresql@${detectedVersion}`;
          software.commands.restart = `brew services restart postgresql@${detectedVersion}`;
        }
      }

      // 检查运行状态
      let statusCommand = software.commands.status;

      // 对于有可选版本的软件，使用检测到的版本检查状态
      if (software.availableVersions && detectedVersion !== 'unknown') {
        if (id === 'mysql') {
          statusCommand = `brew services list | grep mysql`;
        } else if (id === 'postgresql') {
          statusCommand = `brew services list | grep postgresql`;
        } else if (id === 'php') {
          statusCommand = `brew services list | grep php`;
        }
      }

      if (statusCommand) {
        try {
          const { stdout } = await execAsync(statusCommand, { timeout: 5000 });
          software.status = stdout.includes('started') ? 'running' : 'stopped';
        } catch {
          software.status = 'unknown';
        }
      } else {
        software.status = 'unknown';
      }
    } catch (error) {
      software.installed = false;
      software.status = 'unknown';
    }

    return software;
  }

  async installSoftware(id: string, version?: string, password?: string): Promise<{ success: boolean; message: string; output?: string }> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    try {
      let installCommand = software.commands.install;
      let actualVersion = version;

      // 如果指定了版本，修改安装命令
      if (version && software.availableVersions && software.availableVersions.includes(version)) {
        if (id === 'mysql') {
          installCommand = `brew install mysql@${version}`;
        } else if (id === 'php') {
          installCommand = `brew install php@${version}`;
        } else if (id === 'postgresql') {
          installCommand = `brew install postgresql@${version}`;
        } else if (id === 'mongodb') {
          installCommand = `brew tap mongodb/brew && brew install mongodb-community@${version}`;
        } else if (id === 'java') {
          installCommand = `brew install openjdk@${version}`;
        }
      }

      // 对于 MongoDB，总是需要先 tap
      if (id === 'mongodb' && !version) {
        installCommand = 'brew tap mongodb/brew && brew install mongodb-community';
      }

      const { stdout, stderr } = await execAsync(installCommand, {
        timeout: 300000 // 5 minutes
      });

      // 更新软件的命令（使用实际安装的版本）
      if (actualVersion) {
        if (id === 'mysql') {
          software.commands.start = `brew services start mysql@${actualVersion}`;
          software.commands.stop = `brew services stop mysql@${actualVersion}`;
          software.commands.restart = `brew services restart mysql@${actualVersion}`;
          software.commands.status = `brew services list | grep mysql`;
        } else if (id === 'php') {
          software.commands.start = `brew services start php@${actualVersion}`;
          software.commands.stop = `brew services stop php@${actualVersion}`;
          software.commands.restart = `brew services restart php@${actualVersion}`;
          software.commands.status = `brew services list | grep php`;
        } else if (id === 'postgresql') {
          software.commands.start = `brew services start postgresql@${actualVersion}`;
          software.commands.stop = `brew services stop postgresql@${actualVersion}`;
          software.commands.restart = `brew services restart postgresql@${actualVersion}`;
          software.commands.status = `brew services list | grep postgresql`;
        }
      }

      await this.checkSoftwareStatus(id);

      // 如果是数据库且提供了密码，尝试设置密码
      if (password && software.requiresPassword) {
        await this.setDatabasePassword(id, password);
      }

      return {
        success: true,
        message: `${software.displayName}${actualVersion ? ` ${actualVersion} 版本` : ''} 安装成功`,
        output: stdout || stderr
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${software.displayName}${version ? ` ${version} 版本` : ''} 安装失败: ${error.message}`,
        output: error.stderr || error.stdout
      };
    }
  }

  private async setDatabasePassword(id: string, password: string): Promise<void> {
    // 这里可以添加设置数据库密码的逻辑
    // 对于 MySQL，可以通过 mysql_secure_installation 或直接执行 SQL 命令
    // 暂时只记录日志
    console.log(`[SoftwareService] Setting ${id} password: ${password}`);
  }

  async uninstallSoftware(id: string): Promise<{ success: boolean; message: string; output?: string }> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    try {
      const { stdout, stderr } = await execAsync(software.commands.uninstall, {
        timeout: 300000
      });

      software.installed = false;
      software.status = 'unknown';

      return {
        success: true,
        message: `${software.displayName} 卸载成功`,
        output: stdout || stderr
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${software.displayName} 卸载失败: ${error.message}`,
        output: error.stderr || error.stdout
      };
    }
  }

  async startSoftware(id: string): Promise<{ success: boolean; message: string; output?: string }> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    if (!software.commands.start) {
      return {
        success: false,
        message: `${software.displayName} 不支持启动操作`
      };
    }

    try {
      const { stdout, stderr } = await execAsync(software.commands.start, {
        timeout: 30000
      });

      await this.checkSoftwareStatus(id);

      return {
        success: true,
        message: `${software.displayName} 启动成功`,
        output: stdout || stderr
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${software.displayName} 启动失败: ${error.message}`,
        output: error.stderr || error.stdout
      };
    }
  }

  async stopSoftware(id: string): Promise<{ success: boolean; message: string; output?: string }> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    if (!software.commands.stop) {
      return {
        success: false,
        message: `${software.displayName} 不支持停止操作`
      };
    }

    try {
      const { stdout, stderr } = await execAsync(software.commands.stop, {
        timeout: 30000
      });

      await this.checkSoftwareStatus(id);

      return {
        success: true,
        message: `${software.displayName} 停止成功`,
        output: stdout || stderr
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${software.displayName} 停止失败: ${error.message}`,
        output: error.stderr || error.stdout
      };
    }
  }

  async restartSoftware(id: string): Promise<{ success: boolean; message: string; output?: string }> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    if (!software.commands.restart) {
      return {
        success: false,
        message: `${software.displayName} 不支持重启操作`
      };
    }

    try {
      const { stdout, stderr } = await execAsync(software.commands.restart, {
        timeout: 60000
      });

      await this.checkSoftwareStatus(id);

      return {
        success: true,
        message: `${software.displayName} 重启成功`,
        output: stdout || stderr
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${software.displayName} 重启失败: ${error.message}`,
        output: error.stderr || error.stdout
      };
    }
  }

  async getSoftwareConfig(id: string): Promise<string> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    if (!software.configPath) {
      throw new Error('此软件不支持配置文件管理');
    }

    try {
      const config = await fs.readFile(software.configPath, 'utf-8');
      return config;
    } catch (error: any) {
      // 如果配置文件不存在，返回默认模板
      if (error.code === 'ENOENT') {
        return this.getDefaultConfigTemplate(id);
      }
      throw new Error(`读取配置文件失败: ${error.message}`);
    }
  }

  private getDefaultConfigTemplate(id: string): string {
    const templates: { [key: string]: string } = {
      mysql: `# MySQL 默认配置文件
# 位置: /opt/homebrew/etc/my.cnf

[mysqld]
# 基本设置
port = 3306
socket = /tmp/mysql.sock

# 网络安全 - 只监听本地
bind-address = 127.0.0.1

# 字符集
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# 连接设置
max_connections = 200
max_connect_errors = 100

# 缓存设置
key_buffer_size = 16M
max_allowed_packet = 64M
table_open_cache = 256
sort_buffer_size = 1M
read_buffer_size = 1M
read_rnd_buffer_size = 4M
myisam_sort_buffer_size = 8M
thread_cache_size = 8
query_cache_size = 16M

# InnoDB 设置
innodb_buffer_pool_size = 128M
innodb_log_file_size = 64M
innodb_log_buffer_size = 8M
innodb_flush_log_at_trx_commit = 1
innodb_lock_wait_timeout = 50

[client]
port = 3306
socket = /tmp/mysql.sock
default-character-set = utf8mb4
`,
      postgresql: `# PostgreSQL 默认配置文件
# 位置: /opt/homebrew/var/postgres/postgresql.conf

# 连接设置
listen_addresses = 'localhost'
port = 5432
max_connections = 100

# 内存设置
shared_buffers = 128MB
effective_cache_size = 512MB
work_mem = 16MB
maintenance_work_mem = 128MB

# 日志设置
logging_collector = on
log_directory = '/opt/homebrew/var/log/postgres'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_rotation_size = 100MB

[client]
port = 5432
`,
      redis: `# Redis 默认配置文件
# 位置: /opt/homebrew/etc/redis.conf

# 网络设置
port 6379
bind 127.0.0.1
protected-mode yes

# 持久化设置
save 900 1
save 300 10
save 60 10000

# RDB 设置
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /opt/homebrew/var/db/redis

# 日志设置
logfile ""
loglevel notice

# 内存设置
maxmemory 256mb
maxmemory-policy allkeys-lru
`,
      mongodb: `# MongoDB 默认配置文件
# 位置: /opt/homebrew/etc/mongod.conf

# 网络设置
net:
  port: 27017
  bindIp: 127.0.0.1

# 存储设置
storage:
  dbPath: /opt/homebrew/var/mongodb
  journal:
    enabled: true

# 日志设置
systemLog:
  destination: file
  path: /opt/homebrew/var/log/mongodb/mongo.log
  logAppend: true

# 安全设置
security:
  authorization: disabled
`
    };

    return templates[id] || '# 配置文件不存在\n# 请手动创建配置文件后重试';
  }

  async updateSoftwareConfig(id: string, content: string): Promise<{ success: boolean; message: string }> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    if (!software.configPath) {
      return {
        success: false,
        message: '此软件不支持配置文件管理'
      };
    }

    try {
      // 确保配置文件目录存在
      const configDir = path.dirname(software.configPath);
      await fs.ensureDir(configDir);

      // 如果原配置文件存在，先备份
      const configExists = await fs.pathExists(software.configPath);
      if (configExists) {
        const backupPath = `${software.configPath}.backup.${Date.now()}`;
        await fs.copy(software.configPath, backupPath);
      }

      // 写入新配置
      await fs.writeFile(software.configPath, content, 'utf-8');

      return {
        success: true,
        message: configExists
          ? '配置文件更新成功，重启软件后生效'
          : '配置文件创建成功，重启软件后生效'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `更新配置文件失败: ${error.message}`
      };
    }
  }

  async getSoftwareLogs(id: string, lines: number = 100): Promise<string[]> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    // 根据不同软件获取日志
    const logPaths: { [key: string]: string } = {
      nginx: '/opt/homebrew/var/log/nginx/error.log',
      mysql: '/opt/homebrew/var/mysql/*.err',
      postgresql: '/opt/homebrew/var/log/postgres.log',
      redis: '/opt/homebrew/var/log/redis.log',
      mongodb: '/opt/homebrew/var/log/mongodb/mongo.log'
    };

    // OpenClaw 特殊处理 - 需要展开用户目录
    let logPath: string | undefined;
    if (id === 'openclaw') {
      const homeDir = process.env.HOME || '/Users/www1';
      logPath = `${homeDir}/.openclaw/logs/gateway.log`;
    } else {
      logPath = logPaths[id];
    }

    if (!logPath) {
      throw new Error('此软件不支持日志查看');
    }

    try {
      const { stdout } = await execAsync(`tail -n ${lines} ${logPath}`, {
        timeout: 5000
      });
      return stdout.split('\n').filter(line => line.trim());
    } catch (error: any) {
      throw new Error(`读取日志失败: ${error.message}`);
    }
  }

  async repairSoftware(id: string): Promise<{ success: boolean; message: string; output?: string }> {
    const software = this.softwareList[id];
    if (!software) {
      throw new Error('Software not found');
    }

    if (!software.commands.repair) {
      return {
        success: false,
        message: `${software.displayName} 不支持修复操作`
      };
    }

    try {
      const { stdout, stderr } = await execAsync(software.commands.repair, {
        timeout: 120000 // 2 minutes
      });

      // 修复后重新检查状态
      await this.checkSoftwareStatus(id);

      return {
        success: true,
        message: `${software.displayName} 修复成功`,
        output: stdout || stderr
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${software.displayName} 修复失败: ${error.message}`,
        output: error.stderr || error.stdout
      };
    }
  }

  // 专门用于 OpenClaw 的状态检测
  async checkOpenClawStatus(): Promise<{ installed: boolean; running: boolean; healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    let installed = false;
    let running = false;

    try {
      // 检查是否安装
      try {
        await execAsync('which openclaw', { timeout: 5000 });
        installed = true;
      } catch {
        issues.push('OpenClaw 未安装');
        return { installed: false, running: false, healthy: false, issues };
      }

      // 检查进程是否运行
      try {
        const { stdout } = await execAsync('pgrep -f openclaw', { timeout: 5000 });
        running = stdout.trim().length > 0;
        if (!running) {
          issues.push('OpenClaw 进程未运行');
        }
      } catch {
        running = false;
        issues.push('OpenClaw 进程未运行');
      }

      // 检查状态
      if (running) {
        try {
          const { stdout } = await execAsync('openclaw status', { timeout: 10000 });
          if (stdout.includes('error') || stdout.includes('failed') || stdout.includes('stopped')) {
            issues.push('OpenClaw 状态异常');
          }
        } catch (error: any) {
          issues.push(`OpenClaw 状态检查失败: ${error.message}`);
        }
      }

      // 检查配置文件
      try {
        await execAsync('test -f ~/.openclaw/config.json', { timeout: 5000 });
      } catch {
        issues.push('OpenClaw 配置文件缺失');
      }

      return {
        installed,
        running,
        healthy: issues.length === 0,
        issues
      };
    } catch (error: any) {
      issues.push(`状态检查失败: ${error.message}`);
      return { installed, running, healthy: false, issues };
    }
  }
}

// 创建单例
export const softwareService = new SoftwareService();
