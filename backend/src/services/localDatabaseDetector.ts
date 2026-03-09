import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';

const execAsync = promisify(exec);

export interface LocalDatabase {
  type: 'mysql' | 'postgresql' | 'mongodb' | 'redis';
  name: string;
  host: string;
  port: number;
  status: 'running' | 'stopped' | 'not_installed';
  version?: string;
  defaultConnection: {
    username: string;
    password: string;
    database?: string;
  };
}

export class LocalDatabaseDetector {
  private readonly homebrewPaths = {
    mysql: '/opt/homebrew/opt/mysql',
    postgresql: '/opt/homebrew/opt/postgresql',
    mongodb: '/opt/homebrew/opt/mongodb-community',
    redis: '/opt/homebrew/opt/redis',
  };

  private readonly defaultPorts = {
    mysql: 3306,
    postgresql: 5432,
    mongodb: 27017,
    redis: 6379,
  };

  async detectAll(): Promise<LocalDatabase[]> {
    const results: LocalDatabase[] = [];

    // Detect MySQL
    const mysql = await this.detectMySQL();
    if (mysql) results.push(mysql);

    // Detect PostgreSQL
    const postgresql = await this.detectPostgreSQL();
    if (postgresql) results.push(postgresql);

    // Detect MongoDB
    const mongodb = await this.detectMongoDB();
    if (mongodb) results.push(mongodb);

    // Detect Redis
    const redis = await this.detectRedis();
    if (redis) results.push(redis);

    return results;
  }

  private async detectMySQL(): Promise<LocalDatabase | null> {
    try {
      // Check if MySQL is installed via Homebrew
      let mysqlPath = this.homebrewPaths.mysql;
      let isInstalled = await fs.pathExists(mysqlPath);

      // Try alternate paths for different versions
      if (!isInstalled) {
        const altPaths = [
          '/opt/homebrew/opt/mysql@8.0',
          '/opt/homebrew/opt/mysql@5.7',
        ];
        for (const path of altPaths) {
          if (await fs.pathExists(path)) {
            mysqlPath = path;
            isInstalled = true;
            break;
          }
        }
      }

      if (!isInstalled) {
        return null;
      }

      // Check version
      let version = '';
      try {
        const mysqlBin = `${mysqlPath}/bin/mysql`;
        const { stdout } = await execAsync(`${mysqlBin} --version`, { timeout: 5000 });
        const match = stdout.match(/Distrib ([\d.]+)/);
        if (match) version = match[1];
      } catch {}

      // Check if running
      let status: 'running' | 'stopped' = 'stopped';
      try {
        await execAsync('pgrep mysqld', { timeout: 2000 });
        status = 'running';
      } catch {}

      return {
        type: 'mysql',
        name: `本地 MySQL ${version}`,
        host: 'localhost',
        port: this.defaultPorts.mysql,
        status,
        version,
        defaultConnection: {
          username: 'root',
          password: 'root123', // MySQL root 密码
        },
      };
    } catch {
      return null;
    }
  }

  private async detectPostgreSQL(): Promise<LocalDatabase | null> {
    try {
      // Check if PostgreSQL is installed via Homebrew
      let pgPath = this.homebrewPaths.postgresql;
      let isInstalled = await fs.pathExists(pgPath);

      if (!isInstalled) {
        // Try alternate paths for different versions
        const altPaths = [
          '/opt/homebrew/opt/postgresql@18',
          '/opt/homebrew/opt/postgresql@17',
          '/opt/homebrew/opt/postgresql@16',
          '/opt/homebrew/opt/postgresql@15',
          '/opt/homebrew/opt/postgresql@14',
          '/opt/homebrew/opt/postgresql@13',
          '/opt/homebrew/opt/postgresql@12',
        ];
        for (const path of altPaths) {
          if (await fs.pathExists(path)) {
            pgPath = path;
            isInstalled = true;
            break;
          }
        }
      }

      if (!isInstalled) {
        return null;
      }

      // Check version
      let version = '';
      try {
        const { stdout } = await execAsync('psql --version', { timeout: 5000 });
        const match = stdout.match(/PostgreSQL ([\d.]+)/);
        if (match) version = match[1];
      } catch {}

      // Check if running
      let status: 'running' | 'stopped' = 'stopped';
      try {
        await execAsync('pgrep -x postgres', { timeout: 2000 });
        status = 'running';
      } catch {}

      return {
        type: 'postgresql',
        name: `本地 PostgreSQL ${version}`,
        host: 'localhost',
        port: this.defaultPorts.postgresql,
        status,
        version,
        defaultConnection: {
          username: 'admin',
          password: 'admin123',
          database: 'postgres', // 连接到默认的 postgres 数据库
        },
      };
    } catch {
      return null;
    }
  }

  private async detectMongoDB(): Promise<LocalDatabase | null> {
    try {
      // Check if MongoDB is installed via Homebrew
      const mongoPath = this.homebrewPaths.mongodb;
      const isInstalled = await fs.pathExists(mongoPath);

      if (!isInstalled) {
        return null;
      }

      // Check version
      let version = '';
      try {
        const { stdout } = await execAsync('mongod --version', { timeout: 5000 });
        const match = stdout.match(/db version v([\d.]+)/);
        if (match) version = match[1];
      } catch {}

      // Check if running
      let status: 'running' | 'stopped' = 'stopped';
      try {
        await execAsync('pgrep mongod', { timeout: 2000 });
        status = 'running';
      } catch {}

      return {
        type: 'mongodb',
        name: `本地 MongoDB ${version}`,
        host: 'localhost',
        port: this.defaultPorts.mongodb,
        status,
        version,
        defaultConnection: {
          username: '',
          password: '',
          database: 'admin',
        },
      };
    } catch {
      return null;
    }
  }

  private async detectRedis(): Promise<LocalDatabase | null> {
    try {
      // Check if Redis is installed via Homebrew
      const redisPath = this.homebrewPaths.redis;
      const isInstalled = await fs.pathExists(redisPath);

      if (!isInstalled) {
        return null;
      }

      // Check version
      let version = '';
      try {
        const { stdout } = await execAsync('redis-server --version', { timeout: 5000 });
        const match = stdout.match(/v=([\d.]+)/);
        if (match) version = match[1];
      } catch {}

      // Check if running
      let status: 'running' | 'stopped' = 'stopped';
      try {
        await execAsync('pgrep redis-server', { timeout: 2000 });
        status = 'running';
      } catch {}

      return {
        type: 'redis',
        name: `本地 Redis ${version}`,
        host: 'localhost',
        port: this.defaultPorts.redis,
        status,
        version,
        defaultConnection: {
          username: '',
          password: '',
        },
      };
    } catch {
      return null;
    }
  }

  async testConnection(db: LocalDatabase): Promise<boolean> {
    try {
      switch (db.type) {
        case 'mysql':
          await execAsync(`mysqladmin -h ${db.host} -P ${db.port} -u${db.defaultConnection.username} ping`, {
            timeout: 5000,
          });
          return true;

        case 'postgresql':
          await execAsync(`pg_isready -h ${db.host} -p ${db.port}`, {
            timeout: 5000,
          });
          return true;

        case 'mongodb':
          await execAsync(`mongosh --host ${db.host} --port ${db.port} --eval 'db.adminCommand({ping: 1})'`, {
            timeout: 5000,
          });
          return true;

        case 'redis':
          await execAsync(`redis-cli -h ${db.host} -p ${db.port} ping`, {
            timeout: 5000,
          });
          return true;

        default:
          return false;
      }
    } catch {
      return false;
    }
  }
}

export const localDatabaseDetector = new LocalDatabaseDetector();
