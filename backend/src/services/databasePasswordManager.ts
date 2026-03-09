import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface DatabaseCredentials {
  username: string;
  password: string;
}

class DatabasePasswordManager {
  private credentialsFile: string;
  private encryptionKey: Buffer;

  constructor() {
    // 密码保存在 backend/data/db_credentials.json
    this.credentialsFile = path.join(__dirname, '../../data/db_credentials.json');
    
    // 使用环境变量中的密钥，如果没有则生成一个
    const key = process.env.DB_CREDENTIALS_KEY || crypto.randomBytes(32).toString('hex');
    this.encryptionKey = Buffer.from(key, 'hex').slice(0, 32);
  }

  /**
   * 加密密码
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密密码
   */
  private decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt password');
    }
  }

  /**
   * 保存凭证到文件
   */
  private async saveCredentials(credentials: Record<string, DatabaseCredentials>): Promise<void> {
    await fs.ensureDir(path.dirname(this.credentialsFile));
    await fs.writeJson(this.credentialsFile, credentials, { spaces: 2 });
  }

  /**
   * 从文件读取凭证
   */
  private async loadCredentials(): Promise<Record<string, DatabaseCredentials>> {
    try {
      if (await fs.pathExists(this.credentialsFile)) {
        const data = await fs.readJson(this.credentialsFile);
        // 解密所有密码
        const decrypted: Record<string, DatabaseCredentials> = {};
        for (const [key, value] of Object.entries(data)) {
          const cred = value as any;
          decrypted[key] = {
            username: cred.username,
            password: this.decrypt(cred.password)
          };
        }
        return decrypted;
      }
      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * 重置 MySQL 密码
   */
  async resetMySQLPassword(config: any): Promise<DatabaseCredentials> {
    const { host, port, username: oldUsername, password: oldPassword } = config;
    
    // 生成新密码
    const newPassword = this.generatePassword();
    const newUsername = 'panel_user'; // 固定用户名便于管理
    
    try {
      // 连接 MySQL 并创建/更新用户
      const mysql = `/opt/homebrew/opt/mysql@8.0/bin/mysql`;
      const commands = [
        // 创建新用户或更新密码
        `CREATE USER IF NOT EXISTS '${newUsername}'@'${host}' IDENTIFIED BY '${newPassword}';`,
        `ALTER USER '${newUsername}'@'${host}' IDENTIFIED BY '${newPassword}';`,
        // 授予所有权限
        `GRANT ALL PRIVILEGES ON *.* TO '${newUsername}'@'${host}' WITH GRANT OPTION;`,
        `FLUSH PRIVILEGES;`
      ];

      for (const cmd of commands) {
        await execAsync(`${mysql} -h ${host} -P ${port} -u${oldUsername} -p${oldPassword} -e "${cmd}"`, {
          timeout: 10000
        });
      }

      // 保存凭证
      const credentials = await this.loadCredentials();
      credentials['mysql'] = { username: newUsername, password: newPassword };
      await this.saveCredentials(credentials);

      return { username: newUsername, password: newPassword };
    } catch (error: any) {
      throw new Error(`Failed to reset MySQL password: ${error.message}`);
    }
  }

  /**
   * 重置 PostgreSQL 密码
   */
  async resetPostgreSQLPassword(config: any): Promise<DatabaseCredentials> {
    const { host, port, username: oldUsername, password: oldPassword } = config;
    
    const newPassword = this.generatePassword();
    const newUsername = 'panel_user';

    try {
      const psql = `/opt/homebrew/opt/postgresql/bin/psql`;
      const commands = [
        `CREATE USER ${newUsername} WITH PASSWORD '${newPassword}';`,
        `ALTER USER ${newUsername} WITH PASSWORD '${newPassword}';`,
        `GRANT ALL PRIVILEGES ON DATABASE ${config.database || 'postgres'} TO ${newUsername};`,
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${newUsername};`,
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${newUsername};`
      ];

      for (const cmd of commands) {
        await execAsync(`PGPASSWORD=${oldPassword} ${psql} -h ${host} -p ${port} -U ${oldUsername} -d ${config.database || 'postgres'} -c "${cmd}"`, {
          timeout: 10000,
          env: { ...process.env, PGPASSWORD: oldPassword }
        });
      }

      const credentials = await this.loadCredentials();
      credentials['postgresql'] = { username: newUsername, password: newPassword };
      await this.saveCredentials(credentials);

      return { username: newUsername, password: newPassword };
    } catch (error: any) {
      throw new Error(`Failed to reset PostgreSQL password: ${error.message}`);
    }
  }

  /**
   * 重置 MongoDB 密码
   */
  async resetMongoDBPassword(config: any): Promise<DatabaseCredentials> {
    const { host, port, username: oldUsername, password: oldPassword } = config;
    
    const newPassword = this.generatePassword();
    const newUsername = 'panel_user';

    try {
      const mongosh = `/opt/homebrew/opt/mongodb-community/bin/mongosh`;
      const commands = [
        `db.getSiblingDB('admin').createUser({user: '${newUsername}', pwd: '${newPassword}', roles: [{role: 'root', db: 'admin'}]})`,
        `db.getSiblingDB('admin').updateUser('${newUsername}', {pwd: '${newPassword}'})`
      ];

      for (const cmd of commands) {
        const auth = oldUsername ? `-u ${oldUsername} -p ${oldPassword}` : '';
        await execAsync(`${mongosh} ${host}:${port}/admin ${auth} --eval "${cmd}"`, {
          timeout: 10000
        });
      }

      const credentials = await this.loadCredentials();
      credentials['mongodb'] = { username: newUsername, password: newPassword };
      await this.saveCredentials(credentials);

      return { username: newUsername, password: newPassword };
    } catch (error: any) {
      throw new Error(`Failed to reset MongoDB password: ${error.message}`);
    }
  }

  /**
   * 重置 Redis 密码
   */
  async resetRedisPassword(config: any): Promise<DatabaseCredentials> {
    const { host, port } = config;
    
    const newPassword = this.generatePassword();
    const newUsername = ''; // Redis 通常不需要用户名

    try {
      const redisCli = `/opt/homebrew/opt/redis/bin/redis-cli`;
      
      // 设置 Redis 密码
      await execAsync(`${redisCli} -h ${host} -p ${port} CONFIG SET requirepass '${newPassword}'`, {
        timeout: 10000
      });

      const credentials = await this.loadCredentials();
      credentials['redis'] = { username: newUsername, password: newPassword };
      await this.saveCredentials(credentials);

      return { username: newUsername, password: newPassword };
    } catch (error: any) {
      throw new Error(`Failed to reset Redis password: ${error.message}`);
    }
  }

  /**
   * 获取保存的凭证
   */
  async getCredentials(dbType: string): Promise<DatabaseCredentials | null> {
    const credentials = await this.loadCredentials();
    return credentials[dbType] || null;
  }

  /**
   * 生成安全的随机密码
   */
  private generatePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const randomBytes = crypto.randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    return password;
  }
}

export const databasePasswordManager = new DatabasePasswordManager();
