import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { databaseConnectionManager } from '../services/databaseConnection';
import { requirePermission, AuthRequest } from '../middlewares/permission';
import { localDatabaseDetector } from '../services/localDatabaseDetector';

const router = Router();

// 辅助函数：转换日期格式为 MySQL DATETIME 格式
function convertDateTimeForMySQL(value: any): any {
  if (typeof value !== 'string') return value;

  // 检查是否是 ISO 8601 格式的日期字符串
  // 例如: 2026-03-06T06:23:00.000Z 或 2026-03-06T06:23:00.000+00:00
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  if (isoDatePattern.test(value)) {
    try {
      const date = new Date(value);
      // 转换为 MySQL DATETIME 格式: YYYY-MM-DD HH:MM:SS
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('Date conversion error:', error);
      return value; // 转换失败，返回原值
    }
  }

  return value;
}

// 辅助函数：递归转换对象中的所有日期字段
function convertObjectDatesForMySQL(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => convertObjectDatesForMySQL(item));
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // 检查字段名是否包含日期相关的关键词
        const isDateField = /date|time|at|on/i.test(key);
        const value = obj[key];

        if (isDateField) {
          converted[key] = convertDateTimeForMySQL(value);
        } else {
          converted[key] = convertObjectDatesForMySQL(value);
        }
      }
    }
    return converted;
  }

  return convertDateTimeForMySQL(obj);
}

// Detect local databases
router.get('/local/detect', async (req: Request, res: Response) => {
  try {
    const localDbs = await localDatabaseDetector.detectAll();
    res.json({ success: true, databases: localDbs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quick connect to local database
router.post('/local/connect', async (req: Request, res: Response) => {
  try {
    const { type, host, port, username, password, database } = req.body;

    // Create a temporary connection config
    const tempConfig = {
      type,
      host,
      port,
      username,
      password,
      database,
    };

    // Test connection
    const testResult = await databaseConnectionManager.testConnection(tempConfig);

    if (testResult.success) {
      // Save connection to database if it doesn't exist
      const existingDbs = await db.listDatabaseConfigs();
      const exists = existingDbs.some((d: any) =>
        d.type === type &&
        d.host === host &&
        d.port === port
      );

      if (!exists) {
        await db.createDatabaseConfig({
          name: `本地 ${type} ${host}:${port}`,
          type,
          host,
          port,
          username,
          password,
          database,
        });
      }

      res.json({
        success: true,
        message: testResult.message,
      });
    } else {
      res.status(400).json(testResult);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get database list
router.get('/list', requirePermission('database', 'read'), async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;
    let databases = await db.listDatabaseConfigs();

    if (type) {
      databases = databases.filter((d: any) => d.type === type);
    }

    res.json(databases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create database
router.post('/create', requirePermission('database', 'create'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, host, port, username, password, database: dbName } = req.body;

    const newDatabase = await db.createDatabaseConfig({
      name,
      type: type || 'mysql',
      host: host || 'localhost',
      port: port || 3306,
      username: username || 'root',
      password: password || '',
      database: dbName
    });

    res.json(newDatabase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test database connection
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 获取数据库配置
    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ success: false, message: 'Database configuration not found' });
    }

    // 测试连接
    const result = await databaseConnectionManager.testConnection({
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Connection test failed', error: error.message });
  }
});

// Delete database
router.delete('/:id', requirePermission('database', 'delete'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 关闭连接
    await databaseConnectionManager.closeConnection(id);

    // 删除配置
    await db.deleteDatabaseConfig(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get tables in database
router.get('/:id/tables', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { database } = req.query;

    // 获取数据库配置
    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    // 获取表列表（使用查询参数中的 database，如果没有则使用配置中的）
    const tables = await databaseConnectionManager.getTables(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: (database as string) || databaseConfig.database
    });

    res.json(tables);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Redis databases info
router.get('/:id/redis-databases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig || databaseConfig.type !== 'redis') {
      return res.status(400).json({ error: 'Not a Redis database' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    // Get info for all databases
    const dbInfo: any[] = [];
    for (let i = 0; i < 16; i++) {
      try {
        await connection.select(i);
        const keyCount = await connection.dbsize();
        const info = await connection.info('stats');

        dbInfo.push({
          index: i,
          name: `DB ${i}`,
          keys: keyCount,
          expires: 0,
        });
      } catch (error: any) {
        dbInfo.push({
          index: i,
          name: `DB ${i}`,
          keys: 0,
          expires: 0,
        });
      }
    }

    // Select DB 0 again
    await connection.select(0);

    res.json({ success: true, databases: dbInfo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Redis keys
router.get('/:id/redis-keys', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { db: dbIndex = 0, pattern = '*' } = req.query;

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig || databaseConfig.type !== 'redis') {
      return res.status(400).json({ error: 'Not a Redis database' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    // Select database
    await connection.select(parseInt(dbIndex as string));

    // Get keys
    const keys = await connection.keys(pattern as string);

    // Get key types and TTLs
    const keyInfo: any[] = [];
    for (const key of keys) {
      try {
        const type = await connection.type(key);
        const ttl = await connection.ttl(key);
        let size = 0;

        // Get size based on type
        if (type === 'string') {
          size = await connection.strlen(key);
        } else if (type === 'list') {
          size = await connection.llen(key);
        } else if (type === 'set') {
          size = await connection.scard(key);
        } else if (type === 'zset') {
          size = await connection.zcard(key);
        } else if (type === 'hash') {
          size = await connection.hlen(key);
        }

        keyInfo.push({
          key,
          type,
          ttl,
          size,
        });
      } catch (error) {
        // Skip keys that cause errors
      }
    }

    // Select DB 0 again
    await connection.select(0);

    res.json({ success: true, keys: keyInfo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Redis key value
router.get('/:id/redis-key', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { key, db: dbIndex = 0 } = req.query;

    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig || databaseConfig.type !== 'redis') {
      return res.status(400).json({ error: 'Not a Redis database' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    // Select database
    await connection.select(parseInt(dbIndex as string));

    const type = await connection.type(key as string);
    let value: any = null;

    switch (type) {
      case 'string':
        value = await connection.get(key as string);
        break;
      case 'list':
        const listLength = await connection.llen(key as string);
        const listValues = await connection.lrange(key as string, 0, -1);
        value = {
          type: 'list',
          length: listLength,
          values: listValues,
        };
        break;
      case 'set':
        const setMembers = await connection.smembers(key as string);
        value = {
          type: 'set',
          members: setMembers,
        };
        break;
      case 'zset':
        const zsetMembers = await connection.zrange(key as string, 0, -1, 'WITHSCORES');
        value = {
          type: 'zset',
          members: zsetMembers,
        };
        break;
      case 'hash':
        const hashFields = await connection.hgetall(key as string);
        value = {
          type: 'hash',
          fields: hashFields,
        };
        break;
      default:
        value = null;
    }

    const ttl = await connection.ttl(key as string);

    // Select DB 0 again
    await connection.select(0);

    res.json({
      success: true,
      key,
      type,
      value,
      ttl,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get table data
router.get('/:id/data', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table, page = 1, limit = 10 } = req.query;

    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    // 获取数据库配置
    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    // 获取表数据
    const result = await databaseConnectionManager.getTableData(
      id,
      {
        type: databaseConfig.type,
        host: databaseConfig.host,
        port: databaseConfig.port,
        username: databaseConfig.username,
        password: databaseConfig.password,
        database: databaseConfig.database
      },
      table as string,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute SQL/Query
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { databaseId, sql } = req.body;

    if (!databaseId) {
      return res.status(400).json({ success: false, error: 'Database ID is required' });
    }

    if (!sql || sql.trim() === '') {
      return res.status(400).json({ success: false, error: 'SQL query is required' });
    }

    // 获取数据库配置
    const databaseConfig = await db.getDatabaseConfigById(databaseId);
    if (!databaseConfig) {
      return res.status(404).json({ success: false, error: 'Database configuration not found' });
    }

    // 执行查询
    const result = await databaseConnectionManager.executeQuery(
      databaseId,
      {
        type: databaseConfig.type,
        host: databaseConfig.host,
        port: databaseConfig.port,
        username: databaseConfig.username,
        password: databaseConfig.password,
        database: databaseConfig.database
      },
      sql
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backup database (placeholder for future implementation)
router.post('/:id/backup', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // sql, dump

    // TODO: 实现真实的数据库备份功能
    res.json({
      success: true,
      message: 'Backup feature coming soon',
      backupPath: `/backups/database-${id}-${Date.now()}.${type || 'sql'}`,
      size: '0 KB'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get table structure
router.get('/:id/structure', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table } = req.query;

    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    const tableName = String(table);

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    let structure: any[] = [];

    if (databaseConfig.type === 'mysql') {
      // MySQL: 需要使用数据库名.表名格式
      let fullTableName = tableName;

      // 如果配置中有database，使用database.table格式
      if (databaseConfig.database) {
        if (!tableName.includes('.')) {
          fullTableName = `\`${databaseConfig.database}\`.\`${tableName}\``;
        } else {
          // 已经包含数据库名
          const [db, tbl] = tableName.split('.');
          fullTableName = `\`${db}\`.\`${tbl}\``;
        }
      } else {
        // 没有配置database，尝试从tableName中提取
        if (tableName.includes('.')) {
          const [db, tbl] = tableName.split('.');
          fullTableName = `\`${db}\`.\`${tbl}\``;
        } else {
          // 既没有配置database，表名也不包含数据库名，尝试使用mysql数据库
          fullTableName = `mysql.\`${tableName}\``;
        }
      }

      const [rows] = await connection.execute(`DESCRIBE ${fullTableName}`);
      structure = rows as any[];
    } else if (databaseConfig.type === 'postgresql') {
      const result = await connection.query(`
        SELECT
          column_name as Field,
          data_type as Type,
          is_nullable as Null,
          column_default as Default
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `);
      structure = result.rows;
    } else if (databaseConfig.type === 'mongodb') {
      const mongoDb = connection.db(databaseConfig.database);
      const collection = mongoDb.collection(tableName);
      const sampleDoc = await collection.findOne();
      structure = sampleDoc ? Object.keys(sampleDoc).map(key => ({
        Field: key,
        Type: typeof sampleDoc[key],
        Null: 'YES',
        Default: null
      })) : [];
    }

    res.json({ success: true, data: structure });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Insert data
router.post('/:id/insert', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table, data } = req.body;

    if (!table || !data) {
      return res.status(400).json({ error: 'Table name and data are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      // 处理带数据库前缀的表名
      let fullTableName = table;
      if (table.includes('.')) {
        const [db, tbl] = table.split('.');
        fullTableName = `\`${db}\`.\`${tbl}\``;
      } else {
        fullTableName = `\`${table}\``;
      }

      // 转换日期格式
      const convertedData = convertObjectDatesForMySQL(data);
      console.log('Insert original data:', data);
      console.log('Insert converted data:', convertedData);

      const columnKeys = Object.keys(convertedData);
      const columns = columnKeys.map(col => `\`${col}\``).join(', ');
      const values = Object.values(convertedData);
      const placeholders = columnKeys.map(() => '?').join(', ');
      const sql = `INSERT INTO ${fullTableName} (${columns}) VALUES (${placeholders})`;
      console.log('Insert SQL:', sql);
      console.log('Insert values:', values);
      await connection.execute(sql, values);
    } else if (databaseConfig.type === 'postgresql') {
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${placeholders})`;
      await connection.query(sql, values);
    } else if (databaseConfig.type === 'mongodb') {
      const mongoDb = connection.db(databaseConfig.database);
      await mongoDb.collection(table).insertOne(data);
    }

    res.json({ success: true, message: 'Data inserted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update data
router.put('/:id/update', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table, data, where } = req.body;

    if (!table || !data || !where) {
      return res.status(400).json({ error: 'Table name, data, and where clause are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      // 处理带数据库前缀的表名（如：my.users）
      let fullTableName = table;
      if (table.includes('.')) {
        const [db, tbl] = table.split('.');
        fullTableName = `\`${db}\`.\`${tbl}\``;
      } else {
        fullTableName = `\`${table}\``;
      }

      // 优先使用主键作为 WHERE 条件
      const possibleKeys = ['id', 'ID', 'Id', '_id', 'uuid', 'UUID'];
      let primaryKey = null;
      for (const key of possibleKeys) {
        if (where.hasOwnProperty(key)) {
          primaryKey = key;
          break;
        }
      }

      let whereClause: string;
      let whereValues: any[];
      let values: any[];

      if (primaryKey) {
        // 使用主键作为 WHERE 条件
        whereClause = `\`${primaryKey}\` = ?`;
        whereValues = [where[primaryKey]];
        console.log('Using primary key for WHERE:', primaryKey);
      } else {
        // 没有主键，使用所有字段作为 WHERE 条件
        whereClause = Object.keys(where).map(key => `\`${key}\` = ?`).join(' AND ');
        whereValues = Object.values(where);
        console.log('Using all fields for WHERE');
      }

      // 转换日期格式
      const convertedData = convertObjectDatesForMySQL(data);
      console.log('Original data:', data);
      console.log('Converted data:', convertedData);

      const setClause = Object.keys(convertedData).map(key => `\`${key}\` = ?`).join(', ');
      values = [...Object.values(convertedData), ...whereValues];
      const sql = `UPDATE ${fullTableName} SET ${setClause} WHERE ${whereClause}`;
      console.log('Update SQL:', sql);
      console.log('Update values:', values);
      console.log('WHERE clause:', whereClause);

      const [result] = await connection.execute(sql, values);
      console.log('Update result:', result); // 添加执行结果日志
    } else if (databaseConfig.type === 'postgresql') {
      // 优先使用主键作为 WHERE 条件
      const possibleKeys = ['id', 'ID', 'Id', '_id', 'uuid', 'UUID'];
      let primaryKey = null;
      for (const key of possibleKeys) {
        if (where.hasOwnProperty(key)) {
          primaryKey = key;
          break;
        }
      }

      let whereClause: string;
      let params: any[];

      if (primaryKey) {
        // 使用主键作为 WHERE 条件
        whereClause = `"${primaryKey}" = $${Object.keys(data).length + 1}`;
        params = [...Object.values(data), where[primaryKey]];
        console.log('Using primary key for WHERE:', primaryKey);
      } else {
        // 没有主键，使用所有字段作为 WHERE 条件
        const whereOffset = Object.keys(data).length;
        whereClause = Object.keys(where).map((key, i) => `"${key}" = $${whereOffset + i + 1}`).join(' AND ');
        params = [...Object.values(data), ...Object.values(where)];
        console.log('Using all fields for WHERE');
      }

      const setClause = Object.keys(data).map((key, i) => `"${key}" = $${i + 1}`).join(', ');
      const sql = `UPDATE "${table}" SET ${setClause} WHERE ${whereClause}`;
      console.log('PostgreSQL Update SQL:', sql);
      console.log('PostgreSQL Update params:', params);

      await connection.query(sql, params);
    } else if (databaseConfig.type === 'mongodb') {
      const mongoDb = connection.db(databaseConfig.database);
      await mongoDb.collection(table).updateMany(where, { $set: data });
    }

    res.json({ success: true, message: 'Data updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete data
router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table, where } = req.body;

    if (!table || !where) {
      return res.status(400).json({ error: 'Table name and where clause are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      // 处理带数据库前缀的表名
      let fullTableName = table;
      if (table.includes('.')) {
        const [db, tbl] = table.split('.');
        fullTableName = `\`${db}\`.\`${tbl}\``;
      } else {
        fullTableName = `\`${table}\``;
      }

      // 优先使用主键作为 WHERE 条件
      const possibleKeys = ['id', 'ID', 'Id', '_id', 'uuid', 'UUID'];
      let primaryKey = null;
      for (const key of possibleKeys) {
        if (where.hasOwnProperty(key)) {
          primaryKey = key;
          break;
        }
      }

      let whereClause: string;
      let whereValues: any[];

      if (primaryKey) {
        // 使用主键作为 WHERE 条件
        whereClause = `\`${primaryKey}\` = ?`;
        whereValues = [where[primaryKey]];
        console.log('DELETE using primary key:', primaryKey);
      } else {
        // 没有主键，使用所有字段作为 WHERE 条件
        whereClause = Object.keys(where).map(key => `\`${key}\` = ?`).join(' AND ');
        whereValues = Object.values(where);
        console.log('DELETE using all fields');
      }

      const sql = `DELETE FROM ${fullTableName} WHERE ${whereClause}`;
      console.log('Delete SQL:', sql);
      console.log('Delete values:', whereValues);
      const [result] = await connection.execute(sql, whereValues);
      console.log('Delete result:', result); // 添加执行结果日志
    } else if (databaseConfig.type === 'postgresql') {
      const whereClause = Object.keys(where).map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      const sql = `DELETE FROM "${table}" WHERE ${whereClause}`;
      await connection.query(sql, Object.values(where));
    } else if (databaseConfig.type === 'mongodb') {
      const mongoDb = connection.db(databaseConfig.database);
      await mongoDb.collection(table).deleteMany(where);
    }

    res.json({ success: true, message: 'Data deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add column
router.post('/:id/add-column', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table, column } = req.body;

    if (!table || !column) {
      return res.status(400).json({ error: 'Table name and column definition are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      const nullClause = column.nullable ? '' : 'NOT NULL';
      const defaultClause = column.defaultValue ? `DEFAULT ${column.defaultValue}` : '';

      // 处理带数据库前缀的表名（如：my.db_connections）
      let fullTableName = table;
      if (table.includes('.')) {
        const [db, tbl] = table.split('.');
        fullTableName = `\`${db}\`.\`${tbl}\``;
      } else {
        fullTableName = `\`${table}\``;
      }

      const sql = `ALTER TABLE ${fullTableName} ADD COLUMN \`${column.fieldName}\` ${column.fieldType} ${nullClause} ${defaultClause}`;
      await connection.execute(sql);
    } else if (databaseConfig.type === 'postgresql') {
      const nullClause = column.nullable ? '' : 'NOT NULL';
      const defaultClause = column.defaultValue ? `DEFAULT ${column.defaultValue}` : '';
      const sql = `ALTER TABLE "${table}" ADD COLUMN "${column.fieldName}" ${column.fieldType} ${nullClause} ${defaultClause}`;
      await connection.query(sql);
    } else {
      return res.status(400).json({ error: 'Column operations not supported for this database type' });
    }

    res.json({ success: true, message: 'Column added successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modify column
router.put('/:id/modify-column', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table, oldFieldName, newColumn } = req.body;

    if (!table || !oldFieldName || !newColumn) {
      return res.status(400).json({ error: 'Table name, old field name, and new column definition are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      const nullClause = newColumn.nullable ? '' : 'NOT NULL';
      const defaultClause = newColumn.defaultValue ? `DEFAULT ${newColumn.defaultValue}` : '';

      // 处理带数据库前缀的表名
      let fullTableName = table;
      if (table.includes('.')) {
        const [db, tbl] = table.split('.');
        fullTableName = `\`${db}\`.\`${tbl}\``;
      } else {
        fullTableName = `\`${table}\``;
      }

      const sql = `ALTER TABLE ${fullTableName} CHANGE COLUMN \`${oldFieldName}\` \`${newColumn.fieldName}\` ${newColumn.fieldType} ${nullClause} ${defaultClause}`;
      await connection.execute(sql);
    } else if (databaseConfig.type === 'postgresql') {
      const nullClause = newColumn.nullable ? '' : 'NOT NULL';
      const defaultClause = newColumn.defaultValue ? `DEFAULT ${newColumn.defaultValue}` : '';
      const sql = `ALTER TABLE "${table}" RENAME COLUMN "${oldFieldName}" TO "${newColumn.fieldName}"`;
      await connection.query(sql);
      const sql2 = `ALTER TABLE "${table}" ALTER COLUMN "${newColumn.fieldName}" TYPE ${newColumn.fieldType}, ALTER COLUMN "${newColumn.fieldName}" ${nullClause} ${defaultClause}`;
      await connection.query(sql2);
    } else {
      return res.status(400).json({ error: 'Column operations not supported for this database type' });
    }

    res.json({ success: true, message: 'Column modified successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Drop column
router.delete('/:id/drop-column', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { table, columnName } = req.body;

    if (!table || !columnName) {
      return res.status(400).json({ error: 'Table name and column name are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      // 处理带数据库前缀的表名
      let fullTableName = table;
      if (table.includes('.')) {
        const [db, tbl] = table.split('.');
        fullTableName = `\`${db}\`.\`${tbl}\``;
      } else {
        fullTableName = `\`${table}\``;
      }

      const sql = `ALTER TABLE ${fullTableName} DROP COLUMN \`${columnName}\``;
      await connection.execute(sql);
    } else if (databaseConfig.type === 'postgresql') {
      const sql = `ALTER TABLE "${table}" DROP COLUMN "${columnName}"`;
      await connection.query(sql);
    } else {
      return res.status(400).json({ error: 'Column operations not supported for this database type' });
    }

    res.json({ success: true, message: 'Column dropped successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rename table
router.post('/:id/rename-table', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { oldTableName, newTableName } = req.body;

    if (!oldTableName || !newTableName) {
      return res.status(400).json({ error: 'Old table name and new table name are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      // 处理包含数据库前缀的表名（如：my.users）
      let oldTable = oldTableName;
      let newTable = newTableName;

      if (oldTableName.includes('.')) {
        const [db, tbl] = oldTableName.split('.');
        oldTable = `\`${db}\`.\`${tbl}\``;
      } else {
        oldTable = `\`${oldTableName}\``;
      }

      if (newTableName.includes('.')) {
        const [db, tbl] = newTableName.split('.');
        newTable = `\`${db}\`.\`${tbl}\``;
      } else {
        newTable = `\`${newTableName}\``;
      }

      const sql = `RENAME TABLE ${oldTable} TO ${newTable}`;
      await connection.execute(sql);
    } else if (databaseConfig.type === 'postgresql') {
      const sql = `ALTER TABLE "${oldTableName}" RENAME TO "${newTableName}"`;
      await connection.query(sql);
    } else if (databaseConfig.type === 'mongodb') {
      const mongoDb = connection.db(databaseConfig.database);
      await mongoDb.collection(oldTableName).rename(newTableName);
    } else {
      return res.status(400).json({ error: 'Rename table not supported for this database type' });
    }

    res.json({ success: true, message: 'Table renamed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Drop table
router.post('/:id/drop-table', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tableName } = req.body;

    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      // 处理包含数据库前缀的表名（如：my.users）
      let fullTableName = tableName;
      if (tableName.includes('.')) {
        const [db, tbl] = tableName.split('.');
        fullTableName = `\`${db}\`.\`${tbl}\``;
      } else {
        fullTableName = `\`${tableName}\``;
      }
      const sql = `DROP TABLE ${fullTableName}`;
      await connection.execute(sql);
    } else if (databaseConfig.type === 'postgresql') {
      const sql = `DROP TABLE "${tableName}"`;
      await connection.query(sql);
    } else if (databaseConfig.type === 'mongodb') {
      const mongoDb = connection.db(databaseConfig.database);
      await mongoDb.collection(tableName).drop();
    } else {
      return res.status(400).json({ error: 'Drop table not supported for this database type' });
    }

    res.json({ success: true, message: 'Table dropped successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export database
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type = 'sql', tables } = req.query;

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    let exportData = '';

    if (databaseConfig.type === 'mysql' && type === 'sql') {
      exportData = `-- MySQL Export\n-- Database: ${databaseConfig.database}\n-- Generated: ${new Date().toISOString()}\n\n`;

      const tablesList = tables ? (tables as string).split(',') : [];
      if (tablesList.length === 0) {
        const [rows] = await connection.execute('SHOW TABLES');
        const tableKey = Object.keys((rows as any[])[0] || {})[0];
        tablesList.push(...(rows as any[]).map((r: any) => r[tableKey]));
      }

      for (const table of tablesList) {
        exportData += `-- Table structure for ${table}\n`;
        exportData += `DROP TABLE IF EXISTS \`${table}\`;\n`;

        const [createTable] = await connection.execute(`SHOW CREATE TABLE ${table}`);
        exportData += (createTable as any)[0]['Create Table'] + ';\n\n';

        exportData += `-- Data for ${table}\n`;
        const [data] = await connection.execute(`SELECT * FROM ${table}`);
        for (const row of data as any[]) {
          const values = Object.values(row).map((v: any) =>
            v === null ? 'NULL' : `'${String(v).replace(/'/g, "\\'")}'`
          );
          exportData += `INSERT INTO \`${table}\` VALUES (${values.join(', ')});\n`;
        }
        exportData += '\n';
      }
    } else if (databaseConfig.type === 'postgresql' && type === 'sql') {
      exportData = `-- PostgreSQL Export\n-- Database: ${databaseConfig.database}\n-- Generated: ${new Date().toISOString()}\n\n`;

      const tablesList = tables ? (tables as string).split(',') : [];
      if (tablesList.length === 0) {
        const result = await connection.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        tablesList.push(...result.rows.map((r: any) => r.tablename));
      }

      for (const table of tablesList) {
        exportData += `-- Table structure for ${table}\n`;
        exportData += `DROP TABLE IF EXISTS "${table}" CASCADE;\n`;

        const [createTable] = await connection.query(`
          SELECT 'CREATE TABLE ' || tablename || ' (' ||
          string_agg(column_name || ' ' || data_type ||
            CASE WHEN character_maximum_length IS NOT NULL
              THEN '(' || character_maximum_length || ')'
              ELSE '' END
          , ', ') || ');' as sql
          FROM information_schema.columns
          WHERE table_name = '${table}'
          GROUP BY tablename
        `);
        exportData += createTable.rows[0].sql + '\n\n';

        exportData += `-- Data for ${table}\n`;
        const data = await connection.query(`SELECT * FROM "${table}"`);
        for (const row of data.rows) {
          const values = Object.values(row).map((v: any) =>
            v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`
          );
          exportData += `INSERT INTO "${table}" VALUES (${values.join(', ')});\n`;
        }
        exportData += '\n';
      }
    } else if (databaseConfig.type === 'mongodb' && type === 'json') {
      const mongoDb = connection.db(databaseConfig.database);
      const collections = tables ? (tables as string).split(',') : [];

      if (collections.length === 0) {
        const cols = await mongoDb.listCollections().toArray();
        collections.push(...cols.map((c: any) => c.name));
      }

      const exportObj: any = {};
      for (const coll of collections) {
        exportObj[coll] = await mongoDb.collection(coll).find().toArray();
      }
      exportData = JSON.stringify(exportObj, null, 2);
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="database-${id}-${Date.now()}.${type}"`);
    res.send(exportData);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import database
router.post('/:id/import', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sql } = req.body;

    if (!sql) {
      return res.status(400).json({ error: 'SQL content is required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    // Split SQL by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        if (databaseConfig.type === 'mysql') {
          await connection.execute(statement);
        } else if (databaseConfig.type === 'postgresql') {
          await connection.query(statement);
        }
      } catch (error: any) {
        console.error('Error executing statement:', statement, error);
      }
    }

    res.json({ success: true, message: 'Database imported successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get database users
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    let users: any[] = [];

    if (databaseConfig.type === 'mysql') {
      const [rows] = await connection.execute('SELECT user, host FROM mysql.user');
      users = rows as any[];
    } else if (databaseConfig.type === 'postgresql') {
      const result = await connection.query('SELECT usename as user, usehost as host FROM pg_user');
      users = result.rows;
    }

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create database user
router.post('/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password, host = '%', privileges } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      await connection.execute(`CREATE USER '${username}'@'${host}' IDENTIFIED BY '${password}'`);
      if (privileges && privileges.length > 0) {
        const privs = privileges.join(', ');
        await connection.execute(`GRANT ${privs} ON *.* TO '${username}'@'${host}'`);
        await connection.execute('FLUSH PRIVILEGES');
      }
    } else if (databaseConfig.type === 'postgresql') {
      await connection.query(`CREATE USER ${username} WITH PASSWORD '${password}'`);
      if (privileges && privileges.length > 0) {
        for (const priv of privileges) {
          await connection.query(`GRANT ${priv} ON ALL TABLES IN SCHEMA public TO ${username}`);
        }
      }
    }

    res.json({ success: true, message: 'User created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete database user
router.delete('/:id/users/:username', async (req: Request, res: Response) => {
  try {
    const { id, username } = req.params;
    const { host = '%' } = req.body;

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      await connection.execute(`DROP USER '${username}'@'${host}'`);
    } else if (databaseConfig.type === 'postgresql') {
      await connection.query(`DROP USER ${username}`);
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backup database (real implementation)
router.post('/:id/backup', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type = 'sql' } = req.body;

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    // 使用自适应路径
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '../..');
    const backupDir = path.join(projectRoot, 'backups', 'database');
    await require('fs-extra').ensureDir(backupDir);

    const backupFile = `${backupDir}/${databaseConfig.database}-${Date.now()}.${type}`;

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    let sqlContent = '';

    if (databaseConfig.type === 'mysql') {
      const { exec } = require('child_process');
      const command = `mysqldump -h ${databaseConfig.host} -u ${databaseConfig.username} -p${databaseConfig.password} ${databaseConfig.database} > ${backupFile}`;
      await new Promise((resolve, reject) => {
        exec(command, (error: any) => {
          if (error) reject(error);
          else resolve(true);
        });
      });
    } else if (databaseConfig.type === 'postgresql') {
      const { exec } = require('child_process');
      const command = `pg_dump -h ${databaseConfig.host} -U ${databaseConfig.username} ${databaseConfig.database} > ${backupFile}`;
      await new Promise((resolve, reject) => {
        exec(command, { env: { ...process.env, PGPASSWORD: databaseConfig.password } }, (error: any) => {
          if (error) reject(error);
          else resolve(true);
        });
      });
    } else {
      sqlContent = `-- ${databaseConfig.type} backup\n-- Database: ${databaseConfig.database}\n-- Generated: ${new Date().toISOString()}\n`;

      const tables = await databaseConnectionManager.getTables(id, {
        type: databaseConfig.type,
        host: databaseConfig.host,
        port: databaseConfig.port,
        username: databaseConfig.username,
        password: databaseConfig.password,
        database: databaseConfig.database
      });

      for (const table of tables) {
        const result = await databaseConnectionManager.getTableData(
          id,
          {
            type: databaseConfig.type,
            host: databaseConfig.host,
            port: databaseConfig.port,
            username: databaseConfig.username,
            password: databaseConfig.password,
            database: databaseConfig.database
          },
          table.name,
          1,
          10000
        );

        if (result.success && result.data) {
          sqlContent += `\n-- Table: ${table.name}\n`;
          sqlContent += JSON.stringify(result.data, null, 2);
        }
      }

      await require('fs-extra').writeFile(backupFile, sqlContent);
    }

    const stats = require('fs').statSync(backupFile);

    res.json({
      success: true,
      message: 'Backup created successfully',
      backupPath: backupFile,
      size: `${(stats.size / 1024).toFixed(2)} KB`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new database
router.post('/:id/create-database', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { databaseName, characterSet = 'utf8mb4', collation = 'utf8mb4_unicode_ci' } = req.body;

    if (!databaseName) {
      return res.status(400).json({ success: false, error: 'Database name is required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ success: false, error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      const sql = `CREATE DATABASE \`${databaseName}\` CHARACTER SET ${characterSet} COLLATE ${collation}`;
      await connection.execute(sql);
    } else if (databaseConfig.type === 'postgresql') {
      const sql = `CREATE DATABASE "${databaseName}" ENCODING 'UTF8'`;
      await connection.query(sql);
    } else if (databaseConfig.type === 'mongodb') {
      // MongoDB创建数据库需要创建一个集合来触发数据库创建
      const mongoDb = connection.db(databaseName);
      try {
        // 创建一个占位集合来确保数据库被创建和保留
        // MongoDB 的特性：数据库必须至少有一个集合才能存在
        await mongoDb.createCollection('__init__');
        // 插入一个文档标记这是系统创建的集合
        await mongoDb.collection('__init__').insertOne({
          created: new Date(),
          purpose: 'database_placeholder',
          note: 'This collection ensures the database exists in MongoDB'
        });
      } catch (mongoError: any) {
        // 如果集合已存在，忽略错误
        if (!mongoError.message.includes('already exists')) {
          throw mongoError;
        }
      }
    } else if (databaseConfig.type === 'redis') {
      // Redis doesn't have databases in the same sense
      return res.status(400).json({ success: false, error: 'Redis uses numbered databases (0-15)' });
    }

    res.json({
      success: true,
      message: `Database '${databaseName}' created successfully`,
      databaseName
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all databases
router.get('/:id/list-databases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ success: false, error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    let databases: string[] = [];

    if (databaseConfig.type === 'mysql') {
      const [rows] = await connection.execute('SHOW DATABASES');
      databases = (rows as any[])
        .map((r: any) => r.Database)
        .filter((d: string) => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(d));
    } else if (databaseConfig.type === 'postgresql') {
      const result = await connection.query(
        "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname"
      );
      databases = result.rows.map((r: any) => r.datname);
    } else if (databaseConfig.type === 'mongodb') {
      const adminDb = connection.db().admin();
      const dbs = await adminDb.listDatabases();
      databases = dbs.databases
        .map((d: any) => d.name)
        .filter((d: string) => d !== 'local' && d !== 'admin');
    } else if (databaseConfig.type === 'redis') {
      // Redis uses numbered databases
      databases = Array.from({ length: 16 }, (_, i) => `DB ${i}`);
    }

    res.json({ success: true, databases });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rename database
router.post('/:id/rename-database', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ success: false, error: 'Old name and new name are required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ success: false, error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      // MySQL doesn't support direct database renaming
      // We need to create a new database and copy all tables
      return res.status(400).json({
        success: false,
        error: 'MySQL does not support direct database renaming. Please create a new database and migrate data manually.'
      });
    } else if (databaseConfig.type === 'postgresql') {
      const sql = `ALTER DATABASE "${oldName}" RENAME TO "${newName}"`;
      await connection.query(sql);
    } else if (databaseConfig.type === 'mongodb') {
      // MongoDB 4.2+ doesn't support database renaming
      return res.status(400).json({
        success: false,
        error: 'MongoDB does not support database renaming. Please create a new database and migrate data manually.'
      });
    } else if (databaseConfig.type === 'redis') {
      return res.status(400).json({ success: false, error: 'Redis databases cannot be renamed' });
    }

    res.json({
      success: true,
      message: `Database renamed from '${oldName}' to '${newName}'`,
      oldName,
      newName
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Drop database
router.delete('/:id/drop-database', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { databaseName } = req.body;

    if (!databaseName) {
      return res.status(400).json({ success: false, error: 'Database name is required' });
    }

    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ success: false, error: 'Database configuration not found' });
    }

    const connection = await databaseConnectionManager.getConnection(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    if (databaseConfig.type === 'mysql') {
      const sql = `DROP DATABASE \`${databaseName}\``;
      await connection.execute(sql);
    } else if (databaseConfig.type === 'postgresql') {
      const sql = `DROP DATABASE "${databaseName}"`;
      await connection.query(sql);
    } else if (databaseConfig.type === 'mongodb') {
      const mongoDb = connection.db(databaseName);
      await mongoDb.dropDatabase();
    } else if (databaseConfig.type === 'redis') {
      return res.status(400).json({ success: false, error: 'Cannot drop Redis database. Use FLUSHDB to clear all keys.' });
    }

    res.json({
      success: true,
      message: `Database '${databaseName}' dropped successfully`,
      databaseName
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all databases for PostgreSQL and MongoDB
router.get('/:id/all-databases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 获取数据库配置
    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const databases = await databaseConnectionManager.getAllDatabases(id, {
      type: databaseConfig.type,
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database
    });

    res.json({ success: true, databases });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

// Reset database credentials
router.post('/:id/reset-credentials', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 获取数据库配置
    const databaseConfig = await db.getDatabaseConfigById(id);
    if (!databaseConfig) {
      return res.status(404).json({ error: 'Database configuration not found' });
    }

    const { databasePasswordManager } = await import('../services/databasePasswordManager');

    let newCredentials;
    switch (databaseConfig.type) {
      case 'mysql':
        newCredentials = await databasePasswordManager.resetMySQLPassword(databaseConfig);
        break;
      case 'postgresql':
        newCredentials = await databasePasswordManager.resetPostgreSQLPassword(databaseConfig);
        break;
      case 'mongodb':
        newCredentials = await databasePasswordManager.resetMongoDBPassword(databaseConfig);
        break;
      case 'redis':
        newCredentials = await databasePasswordManager.resetRedisPassword(databaseConfig);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported database type' });
    }

    // 更新数据库配置
    await db.updateDatabaseConfig(id, {
      username: newCredentials.username,
      password: newCredentials.password
    });

    res.json({
      success: true,
      message: 'Credentials reset successfully',
      credentials: {
        username: newCredentials.username,
        password: '***' // 不返回实际密码
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get saved credentials
router.get('/credentials/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { databasePasswordManager } = await import('../services/databasePasswordManager');
    const credentials = await databasePasswordManager.getCredentials(type);

    if (!credentials) {
      return res.status(404).json({ error: 'No saved credentials found' });
    }

    res.json({
      success: true,
      credentials: {
        username: credentials.username,
        password: '***' // 不返回实际密码
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
