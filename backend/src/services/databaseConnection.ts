import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { createClient } from 'redis';
import { MongoClient } from 'mongodb';

interface DatabaseConnectionConfig {
  type: 'mysql' | 'postgresql' | 'redis' | 'mongodb';
  host: string;
  port: number;
  username?: string;
  password: string;
  database?: string;
  authSource?: string; // MongoDB
}

interface QueryResult {
  success: boolean;
  data?: any[];
  columns?: string[];
  rowsAffected?: number;
  error?: string;
  message?: string;
}

interface TableInfo {
  name: string;
  rows?: number;
  size?: string;
  engine?: string;
}

class DatabaseConnectionManager {
  private connections: Map<string, any> = new Map();

  /**
   * 测试数据库连接
   */
  async testConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      switch (config.type) {
        case 'mysql':
          return await this.testMySQLConnection(config);
        case 'postgresql':
          return await this.testPostgreSQLConnection(config);
        case 'redis':
          return await this.testRedisConnection(config);
        case 'mongodb':
          return await this.testMongoDBConnection(config);
        default:
          return { success: false, message: 'Unknown database type', error: 'Unsupported database type' };
      }
    } catch (error: any) {
      return { success: false, message: 'Connection failed', error: error.message };
    }
  }

  /**
   * 获取数据库连接
   */
  async getConnection(configId: string, config: DatabaseConnectionConfig): Promise<any> {
    // 检查是否已有缓存的连接
    if (this.connections.has(configId)) {
      const cached = this.connections.get(configId);
      try {
        // 验证连接是否仍然有效
        if (config.type === 'redis') {
          if (cached.isOpen) return cached;
        } else if (config.type === 'mongodb') {
          await cached.db().admin().ping();
          return cached;
        }
        return cached;
      } catch (error) {
        // 连接已失效，移除
        this.connections.delete(configId);
      }
    }

    // 创建新连接
    const connection = await this.createConnection(config);
    this.connections.set(configId, connection);
    return connection;
  }

  /**
   * 关闭连接
   */
  async closeConnection(configId: string): Promise<void> {
    const connection = this.connections.get(configId);
    if (connection) {
      try {
        if (connection.end) {
          await connection.end();
        } else if (connection.close) {
          await connection.close();
        } else if (connection.quit) {
          await connection.quit();
        } else if (connection.disconnect) {
          await connection.disconnect();
        }
      } catch (error) {
        // 忽略关闭错误
      }
      this.connections.delete(configId);
    }
  }

  /**
   * 执行 SQL 查询
   */
  async executeQuery(
    configId: string,
    config: DatabaseConnectionConfig,
    query: string,
    params?: any[]
  ): Promise<QueryResult> {
    try {
      const connection = await this.getConnection(configId, config);

      switch (config.type) {
        case 'mysql':
          return await this.executeQueryMySQL(connection, query, params);
        case 'postgresql':
          return await this.executeQueryPostgreSQL(connection, query, params);
        case 'redis':
          return await this.executeQueryRedis(connection, query);
        case 'mongodb':
          return await this.executeQueryMongoDB(connection, query, config.database);
        default:
          return { success: false, error: 'Unsupported database type' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取数据库列表（PostgreSQL）
   */
  private async getPostgreSQLDatabases(configId: string, config: DatabaseConnectionConfig): Promise<string[]> {
    const connection = await this.getConnection(configId, config);
    try {
      const query = `SELECT datname as name FROM pg_database WHERE NOT datistemplate AND datallowconn AND datname != 'postgres' ORDER BY datname`;
      const result = await connection.query(query);
      return result.rows.map((row: any) => row.name);
    } catch (error: any) {
      console.error('Failed to get PostgreSQL databases:', error);
      return [];
    }
  }

  /**
   * 获取数据库列表（MongoDB）
   */
  private async getMongoDBDatabases(configId: string, config: DatabaseConnectionConfig): Promise<string[]> {
    const connection = await this.getConnection(configId, config);
    try {
      const adminDb = connection.db().admin();
      const result = await adminDb.listDatabases();
      return result.databases.map((db: any) => db.name).filter((name: string) => !['admin', 'local', 'config'].includes(name));
    } catch (error: any) {
      console.error('Failed to get MongoDB databases:', error);
      return [];
    }
  }

  /**
   * 获取所有数据库列表
   */
  async getAllDatabases(configId: string, config: DatabaseConnectionConfig): Promise<string[]> {
    try {
      switch (config.type) {
        case 'postgresql':
          return await this.getPostgreSQLDatabases(configId, config);
        case 'mongodb':
          return await this.getMongoDBDatabases(configId, config);
        case 'redis':
          return Array.from({ length: 16 }, (_, i) => `DB ${i}`);
        default:
          return [];
      }
    } catch (error: any) {
      console.error('Failed to get databases:', error);
      return [];
    }
  }

  /**
   * 获取表列表
   */
  async getTables(configId: string, config: DatabaseConnectionConfig): Promise<TableInfo[]> {
    try {
      const connection = await this.getConnection(configId, config);

      switch (config.type) {
        case 'mysql':
          return await this.getTablesMySQL(connection, config.database);
        case 'postgresql':
          return await this.getTablesPostgreSQL(connection, config.database);
        case 'mongodb':
          return await this.getTablesMongoDB(connection, config.database);
        case 'redis':
          return []; // Redis 使用 keys 代替 tables
        default:
          return [];
      }
    } catch (error: any) {
      throw new Error(`Failed to get tables: ${error.message}`);
    }
  }

  /**
   * 获取表数据
   */
  async getTableData(
    configId: string,
    config: DatabaseConnectionConfig,
    table: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ success: boolean; data?: any[]; columns?: string[]; total?: number; error?: string }> {
    try {
      const connection = await this.getConnection(configId, config);

      switch (config.type) {
        case 'mysql':
          return await this.getTableDataMySQL(connection, table, page, limit);
        case 'postgresql':
          return await this.getTableDataPostgreSQL(connection, table, page, limit);
        case 'mongodb':
          return await this.getTableDataMongoDB(connection, config.database, table, page, limit);
        default:
          return { success: false, error: 'Unsupported database type' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== MySQL 实现 ====================

  private async testMySQLConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        connectTimeout: 10000
      });
      await connection.ping();
      await connection.end();
      return { success: true, message: 'MySQL connection successful' };
    } catch (error: any) {
      return { success: false, message: 'MySQL connection failed', error: error.message };
    }
  }

  private async executeQueryMySQL(connection: any, query: string, params?: any[]): Promise<QueryResult> {
    try {
      const [rows, fields] = await connection.execute(query, params);
      const columns = fields ? fields.map((f: any) => f.name) : [];
      return {
        success: true,
        data: rows,
        columns,
        rowsAffected: (rows as any).affectedRows || (rows as any[]).length
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async getTablesMySQL(connection: any, database?: string): Promise<TableInfo[]> {
    const db = database || 'information_schema';
    const query = `
      SELECT TABLE_NAME as name, TABLE_ROWS as \`rows\`, DATA_LENGTH + INDEX_LENGTH as size
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;
    const [rows] = await connection.execute(query, [db]);

    // 为每个表获取准确的行数
    const tables = await Promise.all((rows as any[]).map(async (row: any) => {
      const fullTableName = `\`${db}\`.\`${row.name}\``;

      // 使用 COUNT(*) 获取准确行数（对于 InnoDB 更准确）
      let actualRows = row.rows || 0;
      try {
        const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM ${fullTableName}`);
        actualRows = countResult[0].count;
      } catch (error) {
        // 如果 COUNT(*) 失败，使用估计值
        console.warn(`Failed to count rows for ${fullTableName}:`, error);
        actualRows = row.rows || 0;
      }

      return {
        name: `${db}.${row.name}`,
        rows: actualRows,
        size: this.formatSize(row.size || 0)
      };
    }));

    return tables;
  }

  private async getTableDataMySQL(
    connection: any,
    table: string,
    page: number,
    limit: number
  ): Promise<any> {
    try {
      // 分割数据库名和表名
      const [database, tableName] = table.includes('.') ? table.split('.') : [null, table];
      const fullTableName = database ? `\`${database}\`.\`${tableName}\`` : `\`${tableName}\``;

      // 获取总数
      const [countResult] = await connection.execute(`SELECT COUNT(*) as total FROM ${fullTableName}`);
      const total = (countResult as any)[0].total;

      // 获取数据
      const offset = (page - 1) * limit;
      const [rows] = await connection.execute(`SELECT * FROM ${fullTableName} LIMIT ${limit} OFFSET ${offset}`);
      const [columns] = await connection.execute(`DESCRIBE ${fullTableName}`);

      return {
        success: true,
        data: rows,
        columns: (columns as any[]).map((c: any) => c.Field),
        total
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== PostgreSQL 实现 ====================

  private async testPostgreSQLConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string; error?: string }> {
    const client = new PgClient({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database || 'postgres', // 默认使用 postgres 数据库
      connectionTimeoutMillis: 10000
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return { success: true, message: 'PostgreSQL connection successful' };
    } catch (error: any) {
      await client.end().catch(() => {});
      return { success: false, message: 'PostgreSQL connection failed', error: error.message };
    }
  }

  private async executeQueryPostgreSQL(connection: any, query: string, params?: any[]): Promise<QueryResult> {
    try {
      const result = await connection.query(query, params);
      const columns = result.fields ? result.fields.map((f: any) => f.name) : [];
      return {
        success: true,
        data: result.rows,
        columns,
        rowsAffected: result.rowCount || result.rows.length
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async getTablesPostgreSQL(connection: any, database?: string): Promise<TableInfo[]> {
    const query = `
      SELECT tablename as name, 0 as rows, '0 KB' as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    const result = await connection.query(query);

    // 为每个表获取准确的行数
    const tables = await Promise.all(result.rows.map(async (row: any) => {
      const tableName = row.name;

      // 使用 COUNT(*) 获取准确行数
      let actualRows = 0;
      try {
        const countResult = await connection.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        actualRows = parseInt(countResult.rows[0].count);
      } catch (error) {
        // 如果 COUNT(*) 失败，使用 0
        console.warn(`Failed to count rows for PostgreSQL table ${tableName}:`, error);
        actualRows = 0;
      }

      return {
        name: tableName,
        rows: actualRows,
        size: '0 KB' // PostgreSQL 表大小计算较复杂，这里先返回固定值
      };
    }));

    return tables;
  }

  private async getTableDataPostgreSQL(
    connection: any,
    table: string,
    page: number,
    limit: number
  ): Promise<any> {
    try {
      // 获取总数
      const countResult = await connection.query(`SELECT COUNT(*) as total FROM "${table}"`);
      const total = parseInt(countResult.rows[0].total);

      // 获取数据
      const offset = (page - 1) * limit;
      const result = await connection.query(
        `SELECT * FROM "${table}" LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // 获取列名
      const columnsResult = await connection.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      return {
        success: true,
        data: result.rows,
        columns: columnsResult.rows.map((r: any) => r.column_name),
        total
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== Redis 实现 ====================

  private async testRedisConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string; error?: string }> {
    const client = createClient({
      socket: {
        host: config.host,
        port: config.port,
        connectTimeout: 10000
      },
      password: config.password || undefined
    });

    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return { success: true, message: 'Redis connection successful' };
    } catch (error: any) {
      await client.quit().catch(() => {});
      return { success: false, message: 'Redis connection failed', error: error.message };
    }
  }

  private async executeQueryRedis(connection: any, command: string): Promise<QueryResult> {
    try {
      const args = command.trim().split(/\s+/);
      const cmd = args[0].toUpperCase();
      const params = args.slice(1);

      const result = await connection.sendCommand([...args]);

      return {
        success: true,
        data: [result],
        message: `Executed: ${cmd}`
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== MongoDB 实现 ====================

  private async testMongoDBConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; message: string; error?: string }> {
    // Build MongoDB connection string with or without credentials
    let mongoUri: string;
    if (config.username && config.password) {
      // Both username and password provided
      mongoUri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}`;
    } else {
      // No credentials provided (local MongoDB without auth)
      mongoUri = `mongodb://${config.host}:${config.port}`;
    }
    const client = new MongoClient(mongoUri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });

    try {
      await client.connect();
      await client.db(config.database || 'admin').command({ ping: 1 });
      await client.close();
      return { success: true, message: 'MongoDB connection successful' };
    } catch (error: any) {
      await client.close().catch(() => {});
      return { success: false, message: 'MongoDB connection failed', error: error.message };
    }
  }

  private async executeQueryMongoDB(connection: any, query: string, database?: string): Promise<QueryResult> {
    try {
      // 简单的 MongoDB 查询解析
      const db = connection.db(database || 'test');

      // 支持 show collections
      if (query.toLowerCase().startsWith('show')) {
        const collections = await db.listCollections().toArray();
        return {
          success: true,
          data: collections.map((c: any) => ({ name: c.name })),
          message: `Found ${collections.length} collections`
        };
      }

      // 支持 db.collection.find()
      const match = query.match(/db\.(\w+)\.find\((.*?)\)/);
      if (match) {
        const collectionName = match[1];
        const filter = match[2] ? JSON.parse(match[2]) : {};
        const data = await db.collection(collectionName).find(filter).limit(100).toArray();
        return {
          success: true,
          data,
          rowsAffected: data.length
        };
      }

      return { success: false, error: 'Unsupported MongoDB query format. Use: show collections or db.collectionName.find({...})' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async getTablesMongoDB(connection: any, database?: string): Promise<TableInfo[]> {
    try {
      const db = connection.db(database || 'test');
      const collections = await db.listCollections().toArray();

      // 为每个集合获取准确的行数
      const tables = await Promise.all(collections.map(async (collection: any) => {
        const collName = collection.name;

        // 使用 countDocuments 获取准确行数
        let actualRows = 0;
        try {
          actualRows = await db.collection(collName).countDocuments();
        } catch (error) {
          // 如果计数失败，使用 0
          console.warn(`Failed to count documents for MongoDB collection ${collName}:`, error);
          actualRows = 0;
        }

        return {
          name: collName,
          rows: actualRows,
          size: '0 KB' // MongoDB 集合大小计算较复杂，这里先返回固定值
        };
      }));

      return tables;
    } catch (error: any) {
      return [];
    }
  }

  private async getTableDataMongoDB(
    connection: any,
    database: string | undefined,
    collection: string,
    page: number,
    limit: number
  ): Promise<any> {
    try {
      const db = connection.db(database || 'test');
      const coll = db.collection(collection);

      // 获取总数
      const total = await coll.countDocuments();

      // 获取数据
      const skip = (page - 1) * limit;
      const data = await coll.find({}).skip(skip).limit(limit).toArray();

      // 获取字段名（从第一个文档）
      const columns = data.length > 0 ? Object.keys(data[0]) : [];

      return {
        success: true,
        data,
        columns,
        total
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== 辅助方法 ====================

  private async createConnection(config: DatabaseConnectionConfig): Promise<any> {
    switch (config.type) {
      case 'mysql':
        return mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database
        });

      case 'postgresql':
        const pgClient = new PgClient({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database
        });
        await pgClient.connect();
        return pgClient;

      case 'redis':
        const redisClient = createClient({
          socket: {
            host: config.host,
            port: config.port,
            connectTimeout: 10000
          },
          password: config.password || undefined
        });
        await redisClient.connect();
        return redisClient;

      case 'mongodb':
        // Build MongoDB connection string with or without credentials
        let mongoUri: string;
        if (config.username && config.password) {
          // Both username and password provided
          mongoUri = `mongodb://${config.username}:${config.password}@${config.host}:${config.port}`;
        } else {
          // No credentials provided (local MongoDB without auth)
          mongoUri = `mongodb://${config.host}:${config.port}`;
        }
        const mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
        return mongoClient;

      default:
        throw new Error('Unsupported database type');
    }
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 导出单例
export const databaseConnectionManager = new DatabaseConnectionManager();
