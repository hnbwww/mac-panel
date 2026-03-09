import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Tabs,
  Menu,
  Layout,
  Typography,
  Alert,
  Divider,
  Drawer,
  Descriptions,
  Badge,
  Tooltip,
  Dropdown,
  Switch,
} from 'antd';
import { Input as TextAreaInput } from 'antd';
const { TextArea } = TextAreaInput;
const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  TableOutlined,
  CodeOutlined,
  SettingOutlined,
  UserOutlined,
  ImportOutlined,
  ExportOutlined,
  EditOutlined,
  FileTextOutlined,
  HistoryOutlined,
  CloseOutlined,
  KeyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import './Database.css';

interface Database {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'mongodb' | 'redis';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
}

interface TableInfo {
  name: string;
  rows?: number;
  size?: string;
}

interface QueryResult {
  success: boolean;
  data?: any[];
  columns?: string[];
  rowsAffected?: number;
  error?: string;
  message?: string;
}

export default function DatabaseAdmin() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [allDatabases, setAllDatabases] = useState<string[]>([]); // 所有数据库列表
  const [currentDatabase, setCurrentDatabase] = useState<string>(''); // 当前选中的数据库
  const [activeTab, setActiveTab] = useState<string>('databases'); // 当前活动的标签页
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableStructure, setTableStructure] = useState<any[]>([]);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [showQueryHistory, setShowQueryHistory] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [selectedDbType, setSelectedDbType] = useState<'mysql' | 'postgresql' | 'mongodb' | 'redis' | 'all'>('all');
  const [localDatabases, setLocalDatabases] = useState<any[]>([]);
  const [showLocalDatabases, setShowLocalDatabases] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Modal states
  const [addDbModalVisible, setAddDbModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [createDbModalVisible, setCreateDbModalVisible] = useState(false);
  const [renameDbModalVisible, setRenameDbModalVisible] = useState(false);
  const [dropDbModalVisible, setDropDbModalVisible] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [selectedLocalDb, setSelectedLocalDb] = useState<any>(null);
  const [addColumnModalVisible, setAddColumnModalVisible] = useState(false);
  const [editColumnModalVisible, setEditColumnModalVisible] = useState(false);
  const [renameTableModalVisible, setRenameTableModalVisible] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [dropTableFirstConfirm, setDropTableFirstConfirm] = useState(false);

  const [resetCredentialModalVisible, setResetCredentialModalVisible] = useState(false);
  const [resettingDb, setResettingDb] = useState<any>(null);
  const [editingColumn, setEditingColumn] = useState<any>(null);

  // Form instances
  const [addDbForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [addUserForm] = Form.useForm();
  const [importForm] = Form.useForm();
  const [createDbForm] = Form.useForm();
  const [renameDbForm] = Form.useForm();
  const [connectForm] = Form.useForm();
  const [addColumnForm] = Form.useForm();
  const [editColumnForm] = Form.useForm();

  // Data states
  const [editingRow, setEditingRow] = useState<any>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnName: string } | null>(null);
  const [editingValue, setEditingValue] = useState<any>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [importSql, setImportSql] = useState('');
  const [redisDatabases, setRedisDatabases] = useState<any[]>([]);
  const [selectedRedisDb, setSelectedRedisDb] = useState<number>(0);
  const [redisKeys, setRedisKeys] = useState<any[]>([]);
  const [selectedRedisKey, setSelectedRedisKey] = useState<any>(null);

  // Database list state
  const [databaseList, setDatabaseList] = useState<string[]>([]);

  const API_BASE_URL = import.meta.env.VITE_API_URL;

  // Load databases
  const loadDatabases = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/list`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDatabases(data);
      }
    } catch (error) {
      message.error('加载数据库列表失败');
    } finally {
      setLoading(false);
    }
  };

  // Load database list from server
  const loadDatabaseList = async () => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // 根据数据库类型选择不同的端点
      let endpoint: string;
      if (selectedDatabase.type === 'mysql') {
        endpoint = `/api/database/${selectedDatabase.id}/list-databases`;
      } else if (selectedDatabase.type === 'postgresql' || selectedDatabase.type === 'mongodb') {
        endpoint = `/api/database/${selectedDatabase.id}/all-databases`;
      } else {
        // Redis 或其他类型不支持数据库列表
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setDatabaseList(result.databases || []);
        // 同时更新 allDatabases 状态
        setAllDatabases(result.databases || []);
      } else {
        // Fallback: try to execute SHOW DATABASES
        const queryResponse = await fetch(`${API_BASE_URL}/api/database/execute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            databaseId: selectedDatabase.id,
            sql: selectedDatabase.type === 'mysql' ? 'SHOW DATABASES' :
                 selectedDatabase.type === 'postgresql' ? "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname" :
                 'show databases',
          }),
        });

        if (queryResponse.ok) {
          const queryResult = await queryResponse.json();
          if (queryResult.success && queryResult.data) {
            let dbList: string[] = [];
            if (selectedDatabase.type === 'mysql') {
              dbList = queryResult.data
                .map((r: any) => r.Database || r.database)
                .filter((d: string) => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(d));
            } else if (selectedDatabase.type === 'postgresql') {
              dbList = queryResult.data.map((r: any) => r.datname || r.database);
            } else if (selectedDatabase.type === 'mongodb') {
              dbList = queryResult.data.map((r: any) => r.name);
            }
            setDatabaseList(dbList);
          }
        }
      }
    } catch (error) {
      message.error('加载数据库列表失败');
    } finally {
      setLoading(false);
    }
  };

  // Create new database
  const createDatabase = async (values: any) => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/create-database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const result = await response.json();
        message.success(result.message);
        setCreateDbModalVisible(false);
        createDbForm.resetFields();

        // 刷新数据库列表
        await loadDatabaseList();
        // 重新加载所有数据库
        await loadAllDatabases(selectedDatabase);
      } else {
        const error = await response.json();
        message.error(error.error || '创建数据库失败');
      }
    } catch (error: any) {
      message.error(error.message || '创建数据库失败');
    } finally {
      setLoading(false);
    }
  };

  // Rename database
  const renameDatabase = async (values: any) => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/rename-database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const result = await response.json();
        message.success(result.message);
        setRenameDbModalVisible(false);
        renameDbForm.resetFields();
        loadDatabaseList();
      } else {
        const error = await response.json();
        message.error(error.error || '重命名数据库失败');
      }
    } catch (error) {
      message.error('重命名数据库失败');
    } finally {
      setLoading(false);
    }
  };

  // Drop database
  const dropDatabase = async (databaseName: string) => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/drop-database`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ databaseName }),
      });

      if (response.ok) {
        const result = await response.json();
        message.success(result.message);
        setDropDbModalVisible(false);
        loadDatabaseList();
      }
    } catch (error) {
      message.error('删除数据库失败');
    } finally {
      setLoading(false);
    }
  };

  // Load tables
  const loadTables = async (database: Database, targetDatabase?: string) => {
    setTableLoading(true);
    try {
      const token = localStorage.getItem('token');

      // 如果指定了目标数据库，先加载数据库列表
      if (!targetDatabase) {
        await loadAllDatabases(database);
      }

      const url = targetDatabase
        ? `${API_BASE_URL}/api/database/${database.id}/tables?database=${targetDatabase}`
        : `${API_BASE_URL}/api/database/${database.id}/tables`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTables(data);

        // If Redis, load databases info
        if (database.type === 'redis') {
          loadRedisDatabases(database.id);
        }

        // 设置当前数据库
        if (targetDatabase) {
          setCurrentDatabase(targetDatabase);
        }
      }
    } catch (error) {
      message.error('加载表列表失败');
    } finally {
      setTableLoading(false);
    }
  };

  // Load all databases
  const loadAllDatabases = async (database: Database) => {
    try {
      const token = localStorage.getItem('token');

      // 根据数据库类型选择不同的 API
      let endpoint: string;
      if (database.type === 'mysql') {
        endpoint = `/api/database/${database.id}/list-databases`;
      } else if (database.type === 'postgresql' || database.type === 'mongodb') {
        endpoint = `/api/database/${database.id}/all-databases`;
      } else {
        // Redis 或其他类型
        return;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.databases) {
          setAllDatabases(result.databases);

          // 设置默认数据库（第一个非系统数据库）
          const nonSystemDbs = result.databases.filter((db: string) => {
            const systemDbs = database.type === 'postgresql'
              ? ['postgres', 'template0', 'template1']
              : ['information_schema', 'performance_schema', 'mysql', 'sys', 'admin', 'local', 'config'];
            return !systemDbs.includes(db);
          });

          if (nonSystemDbs.length > 0 && !currentDatabase) {
            setCurrentDatabase(nonSystemDbs[0]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load databases:', error);
    }
  };

  // Switch database
  const switchDatabase = async (databaseName: string) => {
    if (!selectedDatabase) return;

    setCurrentDatabase(databaseName);
    await loadTables(selectedDatabase, databaseName);

    message.success(`已切换到数据库: ${databaseName}`);
  };

  // Load Redis databases
  const loadRedisDatabases = async (dbId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${dbId}/redis-databases`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setRedisDatabases(result.databases);
          // Select DB 0 by default if it has keys
          const db0 = result.databases.find((d: any) => d.index === 0);
          if (db0 && db0.keys > 0) {
            setSelectedRedisDb(0);
            loadRedisKeys(dbId, 0);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load Redis databases:', error);
    }
  };

  // Load Redis keys
  const loadRedisKeys = async (dbId: string, dbIndex: number) => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/database/${dbId}/redis-keys?db=${dbIndex}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setRedisKeys(result.keys);
        }
      }
    } catch (error) {
      message.error('加载 Redis 键失败');
    } finally {
      setLoading(false);
    }
  };

  // Load Redis key value
  const loadRedisKeyValue = async (key: string) => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/database/${selectedDatabase.id}/redis-key?key=${key}&db=${selectedRedisDb}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSelectedRedisKey(result);
        }
      }
    } catch (error) {
      message.error('加载键值失败');
    } finally {
      setLoading(false);
    }
  };

  // Load table data
  const loadTableData = async (table: string, page: number = 1) => {
    if (!selectedDatabase) return;
    console.log('加载表数据:', { table, page });
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/database/${selectedDatabase.id}/data?table=${table}&page=${page}&limit=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const result = await response.json();
        console.log('表数据加载结果:', result);
        const newData = result.data || [];
        console.log('设置新数据，行数:', newData.length);
        setTableData(newData);
      } else {
        console.error('加载表数据失败:', response.status);
      }
    } catch (error) {
      console.error('加载表数据异常:', error);
      message.error('加载表数据失败');
    } finally {
      setLoading(false);
    }
  };

  // Load table structure
  const loadTableStructure = async (table: string) => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/database/${selectedDatabase.id}/structure?table=${table}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const result = await response.json();
        setTableStructure(result.data || []);
      }
    } catch (error) {
      message.error('加载表结构失败');
    } finally {
      setLoading(false);
    }
  };

  // Execute query
  const executeQuery = async () => {
    if (!selectedDatabase || !currentQuery.trim()) {
      message.warning('请选择数据库并输入 SQL 查询');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          databaseId: selectedDatabase.id,
          sql: currentQuery,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setQueryResult(result);

        // Add to history
        if (!queryHistory.includes(currentQuery)) {
          setQueryHistory([currentQuery, ...queryHistory.slice(0, 9)]);
        }

        if (result.success) {
          message.success(result.message || '查询执行成功');
        } else {
          message.error(result.error || '查询执行失败');
        }
      }
    } catch (error) {
      message.error('查询执行失败');
    } finally {
      setLoading(false);
    }
  };

  // Export database
  const exportDatabase = async (type: 'sql' | 'json' = 'sql') => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/database/${selectedDatabase.id}/export?type=${type}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `database-${selectedDatabase.name}-${Date.now()}.${type}`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('导出成功');
      }
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  // Import database
  const importDatabase = async () => {
    if (!selectedDatabase || !importSql.trim()) {
      message.warning('请输入要导入的 SQL 内容');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: importSql }),
      });

      if (response.ok) {
        message.success('导入成功');
        setImportModalVisible(false);
        setImportSql('');
        if (selectedTable) {
          loadTableData(selectedTable);
        }
      }
    } catch (error) {
      message.error('导入失败');
    } finally {
      setLoading(false);
    }
  };

  // Load users
  const loadUsers = async () => {
    if (!selectedDatabase) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/database/${selectedDatabase.id}/users`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const result = await response.json();
        setUsers(result.data || []);
      }
    } catch (error) {
      message.error('加载用户列表失败');
    }
  };

  // Delete row
  const deleteRow = async (row: any) => {
    if (!selectedDatabase || !selectedTable) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          where: row,
        }),
      });

      if (response.ok) {
        message.success('删除成功');
        loadTableData(selectedTable);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // Handle cell double-click edit
  const handleCellEdit = (rowIndex: number, columnName: string, value: any) => {
    setEditingCell({ rowIndex, columnName });
    setEditingValue(value);
  };

  // Handle cell update on blur/enter
  const handleCellUpdate = async (record: any, columnName: string, newValue: any) => {
    console.log('开始更新单元格:', { record, columnName, newValue });

    // 防止重复提交
    if (isSubmitting) {
      console.log('正在提交中，跳过');
      return;
    }

    // 检查值是否发生变化
    if (record[columnName] === newValue) {
      console.log('值没有变化，跳过更新');
      setEditingCell(null);
      setEditingValue('');
      return;
    }

    // 设置提交状态
    setIsSubmitting(true);

    // 准备更新数据
    const updatedRecord = { ...record };
    updatedRecord[columnName] = newValue;

    console.log('提交更新数据:', updatedRecord);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          data: updatedRecord,
          where: record,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('更新成功:', result);
        message.success('更新成功');

        // 先重置编辑状态
        setEditingCell(null);
        setEditingValue('');

        // 刷新表格数据
        console.log('开始刷新表格数据...');
        await loadTableData(selectedTable);
        console.log('表格数据刷新完成');
      } else {
        const error = await response.json();
        console.error('更新失败:', error);
        message.error(error.error || '更新失败');
        // 失败时也要重置状态，让用户可以重试
        setEditingCell(null);
        setEditingValue('');
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
      setEditingCell(null);
      setEditingValue('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update row
  const updateRow = async (oldRow: any, newRow: any) => {
    if (!selectedDatabase || !selectedTable) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          data: newRow,
          where: oldRow,
        }),
      });

      if (response.ok) {
        message.success('更新成功');
        setEditingRow(null);
        loadTableData(selectedTable);
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  // Insert row
  const insertRow = async (data: any) => {
    if (!selectedDatabase || !selectedTable) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/insert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          data,
        }),
      });

      if (response.ok) {
        message.success('插入成功');
        setEditModalVisible(false);
        editForm.resetFields();
        loadTableData(selectedTable);
      }
    } catch (error) {
      message.error('插入失败');
    }
  };

  // Rename table
  const renameTable = async () => {
    if (!selectedDatabase || !selectedTable || !newTableName) {
      message.error('请输入新表名');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/rename-table`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldTableName: selectedTable,
          newTableName: newTableName,
        }),
      });

      if (response.ok) {
        message.success('表重命名成功');
        setRenameTableModalVisible(false);
        setNewTableName('');
        setSelectedTable(newTableName);
        loadTables();
      } else {
        const error = await response.json();
        message.error(error.error || '重命名失败');
      }
    } catch (error) {
      message.error('重命名失败');
    }
  };

  // Drop table
  const dropTable = async () => {
    if (!selectedDatabase || !selectedTable) {
      message.error('请选择要删除的表');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/drop-table`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableName: selectedTable,
        }),
      });

      if (response.ok) {
        message.success('表删除成功');
        setSelectedTable(null);
        setTableData([]);
        setTableStructure([]);
        loadTables();
      } else {
        const error = await response.json();
        message.error(error.error || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // Drop table by name (for table list delete button)
  const handleDropTableByName = async (tableName: string) => {
    if (!selectedDatabase) {
      message.error('请先选择数据库');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/drop-table`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableName: tableName,
        }),
      });

      if (response.ok) {
        message.success(`表 "${tableName}" 删除成功`);
        // If the deleted table was selected, clear selection
        if (selectedTable === tableName) {
          setSelectedTable(null);
          setTableData([]);
          setTableStructure([]);
        }
        loadTables();
      } else {
        const error = await response.json();
        message.error(error.error || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // Add column
  const addColumn = async (values: any) => {
    if (!selectedDatabase || !selectedTable) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/add-column`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          column: values,
        }),
      });

      if (response.ok) {
        message.success('列添加成功');
        setAddColumnModalVisible(false);
        addColumnForm.resetFields();
        await loadTableStructure(selectedTable);
      } else {
        const error = await response.json();
        message.error(error.error || '添加列失败');
      }
    } catch (error: any) {
      message.error(error.message || '添加列失败');
    } finally {
      setLoading(false);
    }
  };

  // Edit column
  const editColumn = (column: any) => {
    setEditingColumn(column);
    editColumnForm.setFieldsValue({
      fieldName: column.Field || column.field,
      fieldType: column.Type || column.type,
      nullable: (column.Null || column.null) === 'YES',
      defaultValue: column.Default || column.default,
    });
    setEditColumnModalVisible(true);
  };

  // Update column
  const updateColumn = async (values: any) => {
    if (!selectedDatabase || !selectedTable || !editingColumn) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/modify-column`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          oldFieldName: editingColumn.Field || editingColumn.field,
          newColumn: values,
        }),
      });

      if (response.ok) {
        message.success('列修改成功');
        setEditColumnModalVisible(false);
        editColumnForm.resetFields();
        setEditingColumn(null);
        await loadTableStructure(selectedTable);
      } else {
        const error = await response.json();
        message.error(error.error || '修改列失败');
      }
    } catch (error: any) {
      message.error(error.message || '修改列失败');
    } finally {
      setLoading(false);
    }
  };

  // Drop column
  const dropColumn = async (fieldName: string) => {
    if (!selectedDatabase || !selectedTable) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/drop-column`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table: selectedTable,
          columnName: fieldName,
        }),
      });

      if (response.ok) {
        message.success('列删除成功');
        await loadTableStructure(selectedTable);
      } else {
        const error = await response.json();
        message.error(error.error || '删除列失败');
      }
    } catch (error: any) {
      message.error(error.message || '删除列失败');
    } finally {
      setLoading(false);
    }
  };

  // Backup database
  const backupDatabase = async () => {
    if (!selectedDatabase) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/backup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'sql' }),
      });

      if (response.ok) {
        const result = await response.json();
        message.success(`备份成功：${result.backupPath}`);
      }
    } catch (error) {
      message.error('备份失败');
    } finally {
      setLoading(false);
    }
  };

  // Create user
  const createUser = async (values: any) => {
    if (!selectedDatabase) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/${selectedDatabase.id}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success('用户创建成功');
        setAddUserModalVisible(false);
        addUserForm.resetFields();
        loadUsers();
      }
    } catch (error) {
      message.error('用户创建失败');
    }
  };

  // Delete user
  const deleteUser = async (username: string) => {
    if (!selectedDatabase) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/database/${selectedDatabase.id}/users/${username}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ host: '%' }),
        }
      );

      if (response.ok) {
        message.success('用户删除成功');
        loadUsers();
      }
    } catch (error) {
      message.error('用户删除失败');
    }
  };

  useEffect(() => {
    loadDatabases();
    loadLocalDatabases();
  }, []);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load local databases
  const loadLocalDatabases = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/local/detect`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLocalDatabases(result.databases);
        }
      }
    } catch (error) {
      console.error('Failed to load local databases:', error);
    }
  };

  // Quick connect to local database
  const quickConnect = (localDb: any) => {
    setSelectedLocalDb(localDb);
    setConnectModalVisible(true);
  };

  // Connect with password
  const connectWithPassword = async (values: any) => {
    if (!selectedLocalDb) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Prepare connection payload
      const payload: any = {
        type: selectedLocalDb.type,
        host: selectedLocalDb.host,
        port: selectedLocalDb.port,
      };

      // Add authentication based on database type
      if (selectedLocalDb.type === 'mysql') {
        payload.username = values.username || selectedLocalDb.defaultConnection.username;
        payload.password = values.password || '';
        payload.database = selectedLocalDb.defaultConnection.database || '';
      } else if (selectedLocalDb.type === 'postgresql') {
        payload.username = values.username || selectedLocalDb.defaultConnection.username;
        payload.password = values.password || '';
        payload.database = 'postgres'; // PostgreSQL 必须指定一个存在的数据库
      } else if (selectedLocalDb.type === 'mongodb') {
        payload.database = selectedLocalDb.defaultConnection.database || 'admin';
      }

      const response = await fetch(`${API_BASE_URL}/api/database/local/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          message.success('连接成功');
          setConnectModalVisible(false);
          setSelectedLocalDb(null);
          await loadDatabases();
        } else {
          message.error(result.message || '连接失败');
        }
      } else {
        const error = await response.json().catch(() => ({ error: '未知错误' }));
        message.error(error.error || error.message || '连接失败');
      }
    } catch (error) {
      console.error('Connection error:', error);
      message.error('连接失败');
    } finally {
      setLoading(false);
    }
  };

  // Reset database credentials
  const resetCredentials = async (db: any) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/database/${db.id}/reset-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          message.success('凭证重置成功！新用户名和密码已保存。');
          await loadDatabases();
          setResetCredentialModalVisible(false);
          setResettingDb(null);
        } else {
          message.error(result.message || '重置失败');
        }
      } else {
        const error = await response.json().catch(() => ({ error: '未知错误' }));
        message.error(error.error || '重置失败');
      }
    } catch (error) {
      console.error('Reset credentials error:', error);
      message.error('重置失败');
    } finally {
      setLoading(false);
    }
  };

  // Table data columns
  const dataColumns = tableData.length > 0 ? Object.keys(tableData[0]).map(key => ({
    title: key,
    dataIndex: key,
    key,
    ellipsis: true,
    render: (text: any, record: any, index: number) => {
      const isEditing = editingCell?.rowIndex === index && editingCell?.columnName === key;

      if (isEditing) {
        return (
          <Input
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onPressEnter={() => handleCellUpdate(record, key, editingValue)}
            onBlur={() => handleCellUpdate(record, key, editingValue)}
            autoFocus
            disabled={isSubmitting}
            style={{ width: '100%' }}
          />
        );
      }

      if (text === null) return <Tag color="default">NULL</Tag>;
      if (typeof text === 'object') return <Tag color="blue">JSON</Tag>;

      return (
        <div
          onDoubleClick={() => handleCellEdit(index, key, text)}
          style={{ cursor: 'pointer', padding: '4px 0' }}
          title="双击编辑"
        >
          {String(text)}
        </div>
      );
    },
  })) : [];

  // Add action column
  dataColumns.push({
    title: '操作',
    key: 'action',
    width: 150,
    render: (_: any, record: any) => (
      <Space size="small">
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => setEditingRow(record)}
        />
        <Popconfirm
          title="确定要删除这条记录吗？"
          onConfirm={() => deleteRow(record)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  } as any);

  // Helper functions for default database credentials
  const getDefaultUsername = (dbType: string): string => {
    switch (dbType) {
      case 'mysql':
        return 'root';
      case 'postgresql':
        return 'admin'; // 使用 admin 用户
      case 'mongodb':
        return '';
      case 'redis':
        return '';
      default:
        return 'root';
    }
  };

  const getUsernameHelp = (dbType: string): string => {
    switch (dbType) {
      case 'mysql':
        return 'Homebrew 安装的 MySQL 默认用户名是 root';
      case 'postgresql':
        return 'PostgreSQL 默认使用 admin 用户';
      case 'mongodb':
        return 'MongoDB 默认无需认证';
      case 'redis':
        return 'Redis 默认无需认证';
      default:
        return '';
    }
  };

  return (
    <Layout className={`database-admin ${isMobile && selectedDatabase ? 'sidebar-hidden' : ''}`}>
      <Sider width={280} theme="light" className="database-sidebar">
        <div className="sidebar-header">
          <span style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>数据库管理</span>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8' }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>数据库类型</Text>
          <Select
            value={selectedDbType}
            onChange={setSelectedDbType}
            style={{ width: '100%' }}
            placeholder="选择数据库类型"
          >
            <Select.Option value="all">
              <Space>
                <DatabaseOutlined />
                全部类型
              </Space>
            </Select.Option>
            <Select.Option value="mysql">
              <Space>
                <span style={{ color: '#00758F' }}>🐬</span>
                MySQL
              </Space>
            </Select.Option>
            <Select.Option value="postgresql">
              <Space>
                <span style={{ color: '#336791' }}>🐘</span>
                PostgreSQL
              </Space>
            </Select.Option>
            <Select.Option value="mongodb">
              <Space>
                <span style={{ color: '#4DB33D' }}>🍃</span>
                MongoDB
              </Space>
            </Select.Option>
            <Select.Option value="redis">
              <Space>
                <span style={{ color: '#DC382D' }}>🔴</span>
                Redis
              </Space>
            </Select.Option>
          </Select>
        </div>

        <div className="sidebar-header" style={{ borderTop: '1px solid #e8e8e8', borderBottom: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>数据库连接</span>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setAddDbModalVisible(true)}
          >
            添加
          </Button>
        </div>

        {/* Local Databases Quick Connect */}
        {localDatabases.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                cursor: 'pointer',
              }}
              onClick={() => setShowLocalDatabases(!showLocalDatabases)}
            >
              <Text strong style={{ fontSize: 13 }}>
                🖥️ 本地数据库
              </Text>
              <Text style={{ fontSize: 12 }} type="secondary">
                {showLocalDatabases ? '▼' : '▶'}
              </Text>
            </div>

            {showLocalDatabases && (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {localDatabases.map((db, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      background: db.status === 'running' ? '#f6ffed' : '#fff1f0',
                      border: '1px solid ' + (db.status === 'running' ? '#b7eb8f' : '#ffccc7'),
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => quickConnect(db)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size="small">
                        <span style={{ fontSize: 16 }}>
                          {db.type === 'mysql' ? '🐬' :
                           db.type === 'postgresql' ? '🐘' :
                           db.type === 'mongodb' ? '🍃' : '🔴'}
                        </span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {db.name}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.7 }}>
                            {db.host}:{db.port}
                          </div>
                        </div>
                      </Space>
                      <div style={{ textAlign: 'right' }}>
                        <Tag
                          color={db.status === 'running' ? 'success' : 'default'}
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          {db.status === 'running' ? '运行中' : '未运行'}
                        </Tag>
                      </div>
                    </div>
                  </div>
                ))}
              </Space>
            )}
          </div>
        )}

        <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Text strong style={{ fontSize: 13 }}>已保存的连接</Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={selectedDatabase ? [selectedDatabase.id] : []}
          onSelect={({ key }) => {
            const db = databases.find(d => d.id === key);
            if (db) {
              setSelectedDatabase(db);
              setCurrentDatabase(''); // 重置当前数据库
              setAllDatabases([]); // 清空数据库列表
              setTables([]); // 清空表列表
              loadTables(db); // 这会触发 loadAllDatabases
              setSelectedTable('');
              setTableData([]);
              setTableStructure([]);
              setActiveTab('tables'); // 切换到数据表标签
            }
          }}
        >
          {databases
            .filter(db => selectedDbType === 'all' || db.type === selectedDbType)
            .map(db => (
              <Menu.Item key={db.id}>
                <Space>
                  <DatabaseOutlined />
                  <span>{db.name}</span>
                  <Tag color={
                    db.type === 'mysql' ? 'blue' :
                    db.type === 'postgresql' ? 'cyan' :
                    db.type === 'mongodb' ? 'green' : 'red'
                  }>
                    {db.type}
                  </Tag>
                </Space>
              </Menu.Item>
            ))}
        </Menu>
      </Sider>

      <Content className="database-content">
        {selectedDatabase ? (
          <>
            {isMobile && (
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setSelectedDatabase(null)}
                style={{ marginBottom: 8 }}
              >
                返回连接列表
              </Button>
            )}
            <Card className="database-header">
              <Row justify="space-between" align="middle">
                <Col>
                  <Space direction="vertical" size="small">
                    <Space>
                      <Title level={4} style={{ margin: 0 }}>
                        {selectedDatabase.name}
                      </Title>
                      <Tag color={selectedDatabase.type === 'mysql' ? 'blue' : selectedDatabase.type === 'postgresql' ? 'cyan' : 'red'}>
                        {selectedDatabase.type.toUpperCase()}
                      </Tag>
                      <Text type="secondary">{selectedDatabase.host}:{selectedDatabase.port}</Text>
                    </Space>

                    {/* 数据库选择器 */}
                    {(selectedDatabase.type === 'mysql' || selectedDatabase.type === 'postgresql' || selectedDatabase.type === 'mongodb') && allDatabases.length > 0 && (
                      <Space>
                        <Text strong style={{ fontSize: 12 }}>当前数据库:</Text>
                        <Select
                          value={currentDatabase}
                          onChange={(value) => switchDatabase(value)}
                          style={{ width: 200 }}
                          placeholder="选择数据库"
                          showSearch
                          optionFilterProp="children"
                        >
                          {allDatabases.map(db => (
                            <Select.Option key={db} value={db}>
                              <Space>
                                <DatabaseOutlined />
                                {db}
                                {db === currentDatabase && <Tag color="blue" style={{ marginLeft: 4 }}>当前</Tag>}
                              </Space>
                            </Select.Option>
                          ))}
                        </Select>
                      </Space>
                    )}
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => loadTables(selectedDatabase)}>
                      刷新
                    </Button>
                    <Button
                      icon={<KeyOutlined />}
                      onClick={() => {
                        setResettingDb(selectedDatabase);
                        setResetCredentialModalVisible(true);
                      }}
                      type="primary"
                    >
                      重置凭证
                    </Button>
                    <Button icon={<PlusOutlined />} onClick={() => { setCreateDbModalVisible(true); loadDatabaseList(); }}>
                      创建数据库
                    </Button>
                    <Button icon={<EditOutlined />} onClick={() => { setRenameDbModalVisible(true); loadDatabaseList(); }}>
                      重命名
                    </Button>
                    <Button icon={<DeleteOutlined />} danger onClick={() => { setDropDbModalVisible(true); loadDatabaseList(); }}>
                      删除数据库
                    </Button>
                    <Button icon={<BackupOutlined />} onClick={backupDatabase}>
                      备份
                    </Button>
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'sql', icon: <ExportOutlined />, label: '导出 SQL', onClick: () => exportDatabase('sql') },
                          { key: 'json', icon: <ExportOutlined />, label: '导出 JSON', onClick: () => exportDatabase('json') },
                          { key: 'import', icon: <ImportOutlined />, label: '导入', onClick: () => setImportModalVisible(true) },
                        ],
                      }}
                    >
                      <Button icon={<ExportOutlined />}>导入/导出</Button>
                    </Dropdown>
                    <Button icon={<UserOutlined />} onClick={() => { setUserModalVisible(true); loadUsers(); }}>
                      用户管理
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>

            <Card className="database-browser">
              <Tabs defaultActiveKey="databases" activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
                <TabPane tab={<span><DatabaseOutlined />数据库</span>} key="databases">
                  {/* 数据库列表 */}
                  {selectedDatabase && (
                    <>
                      {selectedDatabase.type === 'mysql' || selectedDatabase.type === 'postgresql' || selectedDatabase.type === 'mongodb' ? (
                        <>
                          <Alert
                            message="数据库管理"
                            description={`在 ${selectedDatabase.name} 服务器上管理数据库`}
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                          />
                          <Space direction="vertical" style={{ width: '100%' }} size="large">
                            {allDatabases.map(db => (
                              <Card
                                key={db}
                                size="small"
                                title={
                                  <Space>
                                    <DatabaseOutlined />
                                    <span>{db}</span>
                                    {db === currentDatabase && <Tag color="blue">当前</Tag>}
                                  </Space>
                                }
                                extra={
                                  <Space>
                                    <Button
                                      size="small"
                                      type={db === currentDatabase ? 'primary' : 'default'}
                                      onClick={() => switchDatabase(db)}
                                    >
                                      {db === currentDatabase ? '当前数据库' : '切换'}
                                    </Button>
                                    <Dropdown
                                      menu={{
                                        items: [
                                          {
                                            key: 'browse',
                                            label: '浏览表',
                                            icon: <TableOutlined />,
                                            onClick: () => {
                                              switchDatabase(db);
                                              setActiveTab('tables');
                                            }
                                          },
                                          {
                                            key: 'query',
                                            label: '查询数据',
                                            icon: <CodeOutlined />,
                                            onClick: () => {
                                              switchDatabase(db);
                                              setActiveTab('query');
                                            }
                                          },
                                          {
                                            key: 'structure',
                                            label: '查看结构',
                                            icon: <SettingOutlined />,
                                            onClick: () => {
                                              switchDatabase(db);
                                              setActiveTab('structure');
                                            }
                                          },
                                        ]
                                      }}
                                    >
                                      <Button size="small">操作</Button>
                                    </Dropdown>
                                  </Space>
                                }
                                style={{ cursor: 'pointer' }}
                                hoverable
                                onClick={() => switchDatabase(db)}
                              >
                                <Descriptions size="small" column={2}>
                                  <Descriptions.Item label="类型">{selectedDatabase.type.toUpperCase()}</Descriptions.Item>
                                  <Descriptions.Item label="状态">可用</Descriptions.Item>
                                </Descriptions>
                              </Card>
                            ))}
                          </Space>
                        </>
                      ) : (
                        <Alert
                          message={selectedDatabase.type === 'mongodb' ? 'MongoDB 数据库' : 'Redis 数据库'}
                          description={`${selectedDatabase.type === 'mongodb' ? '请使用数据表标签浏览集合' : '请使用数据表标签浏览数据库'}`}
                          type="info"
                          showIcon
                        />
                      )}
                    </>
                  )}
                </TabPane>

                <TabPane tab={<span><TableOutlined />数据表</span>} key="tables">
                  {selectedDatabase?.type === 'redis' ? (
                    <>
                      {/* Redis Database Selector */}
                      <div style={{ marginBottom: 16 }}>
                        <Space>
                          <Text strong>选择数据库：</Text>
                          <Select
                            value={selectedRedisDb}
                            onChange={(value) => {
                              setSelectedRedisDb(value);
                              loadRedisKeys(selectedDatabase.id, value);
                            }}
                            style={{ width: 200 }}
                          >
                            {redisDatabases.map((db) => (
                              <Select.Option key={db.index} value={db.index}>
                                DB {db.index} ({db.keys} 键)
                              </Select.Option>
                            ))}
                          </Select>
                          <Button
                            icon={<ReloadOutlined />}
                            onClick={() => loadRedisKeys(selectedDatabase.id, selectedRedisDb)}
                          >
                            刷新
                          </Button>
                        </Space>
                      </div>

                      {/* Redis Keys Table */}
                      <Table
                        dataSource={redisKeys}
                        rowKey={(record, index) => index ?? 0}
                        loading={loading}
                        pagination={{ pageSize: 50 }}
                        scroll={{ x: 'max-content' }}
                        onRow={(keyInfo) => ({
                          onClick: () => loadRedisKeyValue(keyInfo.key),
                          style: { cursor: 'pointer' },
                        })}
                        columns={[
                          {
                            title: '键名',
                            dataIndex: 'key',
                            key: 'key',
                            ellipsis: true,
                            render: (text) => <Text code>{text}</Text>,
                          },
                          {
                            title: '类型',
                            dataIndex: 'type',
                            key: 'type',
                            width: 100,
                            render: (type) => (
                              <Tag color={
                                type === 'string' ? 'blue' :
                                type === 'list' ? 'green' :
                                type === 'set' ? 'orange' :
                                type === 'zset' ? 'purple' :
                                type === 'hash' ? 'cyan' : 'default'
                              }>
                                {type}
                              </Tag>
                            ),
                          },
                          {
                            title: '大小',
                            dataIndex: 'size',
                            key: 'size',
                            width: 100,
                            render: (size) => size.toLocaleString(),
                          },
                          {
                            title: 'TTL',
                            dataIndex: 'ttl',
                            key: 'ttl',
                            width: 120,
                            render: (ttl) => (
                              ttl === -1 ? <Tag color="default">永不过期</Tag> :
                              ttl === -2 ? <Tag color="red">不存在</Tag> :
                              <Tag color="orange">{ttl}秒</Tag>
                            ),
                          },
                        ]}
                      />

                      {/* Redis Key Value Detail */}
                      {selectedRedisKey && (
                        <Card
                          title={
                            <Space>
                              <Text code>{selectedRedisKey.key}</Text>
                              <Tag color={
                                selectedRedisKey.type === 'string' ? 'blue' :
                                selectedRedisKey.type === 'list' ? 'green' :
                                selectedRedisKey.type === 'set' ? 'orange' :
                                selectedRedisKey.type === 'zset' ? 'purple' :
                                selectedRedisKey.type === 'hash' ? 'cyan' : 'default'
                              }>
                                {selectedRedisKey.type}
                              </Tag>
                            </Space>
                          }
                          style={{ marginTop: 16 }}
                          extra={
                            <Button
                              size="small"
                              icon={<CloseOutlined />}
                              onClick={() => setSelectedRedisKey(null)}
                            />
                          }
                        >
                          <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="TTL">
                              {selectedRedisKey.ttl === -1 ? '永不过期' :
                               selectedRedisKey.ttl === -2 ? '不存在' :
                               `${selectedRedisKey.ttl} 秒`}
                            </Descriptions.Item>
                            <Descriptions.Item label="值">
                              {selectedRedisKey.type === 'string' && (
                                <Text code style={{ wordBreak: 'break-all' }}>
                                  {selectedRedisKey.value}
                                </Text>
                              )}
                              {selectedRedisKey.type === 'list' && (
                                <div>
                                  <Text>长度: {selectedRedisKey.value.length}</Text>
                                  <pre style={{ marginTop: 8 }}>
                                    {JSON.stringify(selectedRedisKey.value.values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {selectedRedisKey.type === 'set' && (
                                <div>
                                  <Text>成员数: {selectedRedisKey.value.members.length}</Text>
                                  <pre style={{ marginTop: 8 }}>
                                    {JSON.stringify(selectedRedisKey.value.members, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {selectedRedisKey.type === 'zset' && (
                                <div>
                                  <Text>成员数: {selectedRedisKey.value.members.length / 2}</Text>
                                  <pre style={{ marginTop: 8 }}>
                                    {JSON.stringify(
                                      Array.from({ length: selectedRedisKey.value.members.length / 2 }, (_, i) => ({
                                        member: selectedRedisKey.value.members[i * 2],
                                        score: selectedRedisKey.value.members[i * 2 + 1],
                                      })),
                                      null,
                                      2
                                    )}
                                  </pre>
                                </div>
                              )}
                              {selectedRedisKey.type === 'hash' && (
                                <div>
                                  <Text>字段数: {Object.keys(selectedRedisKey.value.fields).length}</Text>
                                  <pre style={{ marginTop: 8 }}>
                                    {JSON.stringify(selectedRedisKey.value.fields, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      )}
                    </>
                  ) : (
                    <Table
                      dataSource={tables}
                      rowKey="name"
                      loading={tableLoading}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      onRow={(table) => ({
                        onClick: () => {
                          setSelectedTable(table.name);
                          loadTableData(table.name);
                          loadTableStructure(table.name);
                        },
                        style: { cursor: 'pointer', background: selectedTable === table.name ? '#e6f7ff' : '' },
                      })}
                    >
                      <Table.Column title="表名" dataIndex="name" key="name" />
                      <Table.Column title="行数" dataIndex="rows" key="rows" />
                      <Table.Column title="大小" dataIndex="size" key="size" />
                      <Table.Column
                        title="操作"
                        key="action"
                        width={100}
                        render={(text, record) => (
                          <Popconfirm
                            title="确认删除"
                            description={`确定要删除表 "${record.name}" 吗？此操作不可恢复。`}
                            onConfirm={() => handleDropTableByName(record.name)}
                            okText="确认"
                            cancelText="取消"
                            okType="danger"
                          >
                            <Button
                              type="link"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        )}
                      />
                    </Table>
                  )}
                </TabPane>

                <TabPane tab={<span><CodeOutlined />SQL 查询</span>} key="sql">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert
                      message="SQL 查询"
                      description="输入 SQL 查询语句并执行"
                      type="info"
                      showIcon
                    />
                    <TextArea
                      rows={8}
                      value={currentQuery}
                      onChange={(e) => setCurrentQuery(e.target.value)}
                      placeholder="SELECT * FROM users LIMIT 10"
                      style={{ fontFamily: 'monospace' }}
                    />
                    <Space>
                      <Button type="primary" icon={<PlayCircleOutlined />} onClick={executeQuery} loading={loading}>
                        执行查询
                      </Button>
                      <Dropdown
                        menu={{
                          items: queryHistory.length > 0 ? queryHistory.map((sql, index) => ({
                            key: index.toString(),
                            label: (
                              <div style={{ maxWidth: 500 }}>
                                <div style={{ fontSize: '12px', color: '#999', marginBottom: 4 }}>
                                  #{index + 1}
                                </div>
                                <div style={{
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  wordBreak: 'break-all',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {sql}
                                </div>
                              </div>
                            ),
                            onClick: () => {
                              setCurrentQuery(sql);
                              setShowQueryHistory(false);
                              message.success('已加载历史查询');
                            }
                          })) : [{
                            key: 'empty',
                            label: '暂无历史记录',
                            disabled: true
                          }],
                          onClick: () => {},
                        }}
                        trigger={['click']}
                        onOpenChange={(visible) => {
                          setShowQueryHistory(visible);
                        }}
                      >
                        <Button icon={<HistoryOutlined />}>
                          历史 {queryHistory.length > 0 && <Tag color="blue">{queryHistory.length}</Tag>}
                        </Button>
                      </Dropdown>
                    </Space>

                    {queryResult && (
                      <div>
                        {queryResult.success ? (
                          <>
                            <Alert
                              message="查询成功"
                              description={queryResult.message || `返回 ${queryResult.data?.length || 0} 行`}
                              type="success"
                              showIcon
                              style={{ marginBottom: 16 }}
                            />
                            {queryResult.data && queryResult.data.length > 0 && (
                              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                                <Table
                                  dataSource={queryResult.data}
                                  columns={queryResult.columns?.map(col => ({
                                    title: col,
                                    dataIndex: col,
                                    key: col,
                                    ellipsis: true,
                                  }))}
                                  pagination={{ pageSize: 10 }}
                                  scroll={{ x: 1500, y: 'calc(100vh - 500px)' }}
                                  bordered
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <Alert
                            message="查询失败"
                            description={queryResult.error}
                            type="error"
                            showIcon
                          />
                        )}
                      </div>
                    )}
                  </Space>
                </TabPane>
              </Tabs>
            </Card>

            {selectedTable && (
              <Card
                title={
                  <Space>
                    <TableOutlined />
                    {selectedTable}
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setRenameTableModalVisible(true)}
                    >
                      重命名表
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => setDropTableFirstConfirm(true)}
                    >
                      删除表
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setEditModalVisible(true)}
                    >
                      插入数据
                    </Button>
                  </Space>
                }
                className="table-detail"
              >
                <Tabs defaultActiveKey="data">
                  <TabPane tab={<span><FileTextOutlined />数据</span>} key="data">
                    <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                      <Table
                        dataSource={tableData}
                        columns={dataColumns}
                        loading={loading}
                        pagination={{ pageSize: 50 }}
                        scroll={{ x: 1500, y: 'calc(100vh - 420px)' }}
                        rowKey={(record, index) => {
                          // 尝试找到唯一键作为 rowKey
                          const possibleKeys = ['id', 'ID', 'Id', '_id', 'uuid', 'UUID'];
                          for (const key of possibleKeys) {
                            if (record[key] !== undefined) {
                              return `${key}-${record[key]}`;
                            }
                          }
                          // 如果没有找到唯一键，使用所有字段值组合
                          return `row-${index}-${Object.values(record).join('-')}`;
                        }}
                        size="small"
                        bordered
                      />
                    </div>
                  </TabPane>

                  <TabPane tab={<span><SettingOutlined />结构</span>} key="structure">
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      {/* MySQL/PostgreSQL 表结构 */}
                      {(selectedDatabase.type === 'mysql' || selectedDatabase.type === 'postgresql') && (
                        <>
                          <Space>
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => setAddColumnModalVisible(true)}
                            >
                              添加列
                            </Button>
                            <Button
                              icon={<ReloadOutlined />}
                              onClick={() => loadTableStructure(selectedTable)}
                            >
                              刷新结构
                            </Button>
                          </Space>
                          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                            <Table
                              dataSource={tableStructure}
                              rowKey={(record, index) => index ?? 0}
                              pagination={false}
                              size="small"
                              scroll={{ x: 1000 }}
                              bordered
                              columns={[
                                {
                                  title: '字段名',
                                  dataIndex: 'Field',
                                  key: 'field',
                                  width: 200,
                                  render: (text, record) => text || record.field
                                },
                                {
                                  title: '类型',
                                  dataIndex: 'Type',
                                  key: 'type',
                                  width: 150,
                                  render: (text, record) => <Tag color="blue">{text || record.type}</Tag>
                                },
                                {
                                  title: '允许 NULL',
                                  dataIndex: 'Null',
                                  key: 'null',
                                  width: 100,
                                  render: (text, record) => {
                                    const nullValue = text || record.null;
                                    return (
                                      <Tag color={nullValue === 'YES' ? 'green' : 'red'}>
                                        {nullValue === 'YES' ? '是' : '否'}
                                      </Tag>
                                    );
                                  }
                                },
                                {
                                  title: '默认值',
                                  dataIndex: 'Default',
                                  key: 'default',
                                  width: 120,
                                  render: (text, record) => text || record.default
                                },
                                {
                                  title: '键',
                                  dataIndex: 'Key',
                                  key: 'key',
                                  width: 80,
                                  render: (text, record) => text || record.key || ''
                                },
                                {
                                  title: '操作',
                                  key: 'action',
                                  width: 150,
                                  fixed: 'right',
                                  render: (_, record) => (
                                    <Space size="small">
                                      <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => editColumn(record)}
                                      >
                                        修改
                                      </Button>
                                      <Popconfirm
                                        title="确定要删除这个列吗？"
                                        onConfirm={() => dropColumn(record.Field || record.field)}
                                        okText="确定"
                                        cancelText="取消"
                                      >
                                        <Button size="small" danger icon={<DeleteOutlined />}>
                                          删除
                                        </Button>
                                      </Popconfirm>
                                    </Space>
                                  ),
                                },
                              ]}
                            />
                          </div>
                        </>
                      )}

                      {/* MongoDB 集合结构 */}
                      {selectedDatabase.type === 'mongodb' && (
                        <>
                          <Alert
                            message="MongoDB 文档结构"
                            description="MongoDB 使用灵活的文档结构，以下是基于示例文档推断的字段类型"
                            type="info"
                            showIcon
                          />
                          <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                            <Table
                              dataSource={tableStructure}
                              rowKey={(record, index) => index ?? 0}
                              pagination={false}
                              size="small"
                              scroll={{ x: 800 }}
                              bordered
                              columns={[
                              { title: '字段名', dataIndex: 'Field', key: 'field', width: 250 },
                              {
                                title: '类型',
                                dataIndex: 'Type',
                                key: 'type',
                                width: 120,
                                render: (text) => {
                                  const typeColors: Record<string, string> = {
                                    string: 'blue',
                                    number: 'green',
                                    boolean: 'orange',
                                    object: 'purple',
                                    Array: 'cyan',
                                  };
                                  return <Tag color={typeColors[text] || 'default'}>{text}</Tag>;
                                },
                              },
                              {
                                title: '说明',
                                key: 'description',
                                render: (_, record) => {
                                  const descriptions: Record<string, string> = {
                                    string: '文本字符串',
                                    number: '数字（整数或浮点数）',
                                    boolean: '布尔值（true/false）',
                                    object: '嵌套对象',
                                    Array: '数组',
                                  };
                                  return descriptions[record.Type] || '-';
                                },
                              },
                            ]}
                            />
                          </div>
                        </>
                      )}

                      {/* Redis 键结构 */}
                      {selectedDatabase.type === 'redis' && (
                        <Alert
                          message="Redis 数据结构"
                          description="Redis 使用键值对存储，请在数据标签页查看具体的数据"
                          type="info"
                          showIcon
                        />
                      )}
                    </Space>
                  </TabPane>
                </Tabs>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <Alert
              message="请选择一个数据库"
              description="从左侧列表选择一个数据库开始管理"
              type="info"
              showIcon
            />
          </Card>
        )}
      </Content>

      {/* Add Database Modal */}
      <Modal
        title="添加数据库连接"
        open={addDbModalVisible}
        onCancel={() => setAddDbModalVisible(false)}
        onOk={() => {
          addDbForm.validateFields().then((values) => {
            // TODO: Create database connection
            message.success('数据库连接已添加');
            setAddDbModalVisible(false);
            addDbForm.resetFields();
            loadDatabases();
          });
        }}
      >
        <Form form={addDbForm} layout="vertical">
          <Form.Item name="name" label="连接名称" rules={[{ required: true }]}>
            <Input placeholder="本地 MySQL" />
          </Form.Item>
          <Form.Item name="type" label="数据库类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="mysql">MySQL</Select.Option>
              <Select.Option value="postgresql">PostgreSQL</Select.Option>
              <Select.Option value="mongodb">MongoDB</Select.Option>
              <Select.Option value="redis">Redis</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="host" label="主机" rules={[{ required: true }]} initialValue="localhost">
            <Input />
          </Form.Item>
          <Form.Item name="port" label="端口" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="database" label="数据库名">
            <Input />
          </Form.Item>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      {/* Connect to Local Database Modal */}
      <Modal
        title={
          <Space>
            <span>连接到本地数据库</span>
            {selectedLocalDb && (
              <Tag color={
                selectedLocalDb.type === 'mysql' ? 'blue' :
                selectedLocalDb.type === 'postgresql' ? 'cyan' :
                selectedLocalDb.type === 'mongodb' ? 'green' : 'red'
              }>
                {selectedLocalDb.type.toUpperCase()}
              </Tag>
            )}
          </Space>
        }
        open={connectModalVisible}
        onCancel={() => {
          setConnectModalVisible(false);
          setSelectedLocalDb(null);
          connectForm.resetFields();
        }}
        onOk={() => {
          connectForm.validateFields().then((values) => {
            connectWithPassword(values);
          });
        }}
      >
        {selectedLocalDb && (
          <>
            <Alert
              message="数据库连接信息"
              description={
                <div>
                  <div><strong>主机：</strong>{selectedLocalDb.host}:{selectedLocalDb.port}</div>
                  <div><strong>状态：</strong>{selectedLocalDb.status === 'running' ? '运行中' : '未运行'}</div>
                  {selectedLocalDb.version && <div><strong>版本：</strong>{selectedLocalDb.version}</div>}
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {selectedLocalDb.status !== 'running' && (
              <Alert
                message="⚠️ 警告"
                description="此数据库当前未运行，请先启动数据库服务"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {selectedLocalDb.type === 'mysql' && (
              <Alert
                message="💡 MySQL 默认配置"
                description="Homebrew 安装的 MySQL 默认：用户名 root，密码 root123。已为您预填充，直接连接即可。"
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {selectedLocalDb.type === 'postgresql' && (
              <Alert
                message="💡 PostgreSQL 默认配置"
                description="PostgreSQL 默认用户名是 admin，密码是 admin123。已为您预填充。"
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {(selectedLocalDb.type === 'mongodb' || selectedLocalDb.type === 'redis') && (
              <Alert
                message="✅ 无需认证"
                description={`${selectedLocalDb.type === 'mongodb' ? 'MongoDB' : 'Redis'} 默认安装无需用户名和密码，直接连接即可。`}
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Form
              form={connectForm}
              layout="vertical"
              initialValues={{
                username: getDefaultUsername(selectedLocalDb.type),
                password: '',
              }}
            >
              {selectedLocalDb.type === 'mysql' && (
                <>
                  <Form.Item
                    name="username"
                    label="用户名"
                    rules={[{ required: true, message: '请输入用户名' }]}
                    extra="Homebrew MySQL 默认用户名是 root"
                  >
                    <Input placeholder="root" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="密码"
                    initialValue="root123"
                    extra="MySQL root 密码"
                  >
                    <Input.Password placeholder="root123" />
                  </Form.Item>
                </>
              )}

              {selectedLocalDb.type === 'postgresql' && (
                <>
                  <Form.Item
                    name="username"
                    label="用户名"
                    rules={[{ required: true, message: '请输入用户名' }]}
                    extra="PostgreSQL 默认用户名是 postgres 或当前系统用户"
                  >
                    <Input placeholder="postgres" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label="密码"
                    initialValue="admin123"
                    extra="PostgreSQL admin 用户的密码"
                  >
                    <Input.Password placeholder="admin123" />
                  </Form.Item>
                </>
              )}

              {selectedLocalDb.type === 'mongodb' && (
                <Alert
                  message="MongoDB 连接"
                  description="MongoDB 默认安装无需认证，点击连接即可。"
                  type="info"
                  showIcon
                />
              )}

              {selectedLocalDb.type === 'redis' && (
                <Alert
                  message="Redis 连接"
                  description="Redis 默认安装无需认证，点击连接即可。"
                  type="info"
                  showIcon
                />
              )}
            </Form>
          </>
        )}
      </Modal>

      {/* Insert Data Modal */}
      <Modal
        title="插入数据"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => {
          editForm.validateFields().then((values) => {
            insertRow(values);
          });
        }}
        width={700}
      >
        <Alert
          message="插入新数据"
          description={`在表 "${selectedTable}" 中插入一条新记录`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={editForm} layout="vertical">
          {tableStructure.length > 0 ? (
            tableStructure.map((field: any, index: number) => {
              const fieldName = field.Field || field.field;
              const fieldType = field.Type || field.type || '';
              const nullValue = field.Null || field.null;
              const defaultValue = field.Default || field.default;

              const isRequired = nullValue === 'NO' && defaultValue === null;
              const typeLower = fieldType?.toLowerCase() || '';

              // 根据字段类型决定使用什么输入控件
              let InputComponent = Input;
              let inputProps: any = { placeholder: fieldType };

              if (typeLower.includes('text') || typeLower.includes('varchar') || typeLower.includes('character')) {
                if (typeLower.includes('longtext') || typeLower.includes('varying') && parseInt(fieldType.match(/\d+/)?.[0] || '0') > 500) {
                  InputComponent = TextAreaInput;
                  inputProps = { rows: 3, placeholder: fieldType };
                }
              } else if (typeLower.includes('int') || typeLower.includes('bigint') || typeLower.includes('decimal') || typeLower.includes('float') || typeLower.includes('double') || typeLower.includes('numeric')) {
                inputProps = { type: 'number', placeholder: fieldType };
              } else if (typeLower.includes('date')) {
                inputProps = { type: 'date', placeholder: 'YYYY-MM-DD' };
              } else if (typeLower.includes('datetime') || typeLower.includes('timestamp')) {
                inputProps = { type: 'datetime-local', placeholder: 'YYYY-MM-DD HH:mm:ss' };
              } else if (typeLower.includes('bool')) {
                InputComponent = Select;
                inputProps = {
                  placeholder: '选择值',
                  children: [
                    <Select.Option key="true" value="true">True</Select.Option>,
                    <Select.Option key="false" value="false">False</Select.Option>,
                  ]
                };
              }

              return (
                <Form.Item
                  key={index}
                  name={fieldName}
                  label={
                    <Space>
                      <span>{fieldName}</span>
                      <Tag color="blue" style={{ fontSize: 11 }}>{fieldType}</Tag>
                      {isRequired && <Tag color="red" style={{ fontSize: 11 }}>必填</Tag>}
                    </Space>
                  }
                  initialValue={defaultValue}
                  rules={isRequired ? [{ required: true, message: `${fieldName} 是必填项` }] : []}
                  tooltip={fieldName}
                >
                  <InputComponent
                    {...inputProps}
                    onPressEnter={(e: any) => {
                      // 只对非 TextArea、非 Select 的输入框支持回车提交
                      if (InputComponent === Input) {
                        e.preventDefault();
                        // 找到下一个输入框或提交表单
                        const formItems = tableStructure;
                        const currentIndex = formItems.findIndex((f: any) => (f.Field || f.field) === fieldName);

                        if (currentIndex < formItems.length - 1) {
                          // 聚焦到下一个输入框
                          const nextField = formItems[currentIndex + 1];
                          const nextFieldName = nextField.Field || nextField.field;
                          editForm.focusField(nextFieldName);
                        } else {
                          // 最后一个输入框，提交表单
                          editForm.validateFields().then((values) => {
                            insertRow(values);
                          });
                        }
                      }
                    }}
                  />
                </Form.Item>
              );
            })
          ) : (
            <Alert
              message="无字段信息"
              description="请先在结构标签页查看表结构"
              type="warning"
              showIcon
            />
          )}
        </Form>
      </Modal>

      {/* Users Modal */}
      <Modal
        title="数据库用户"
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
        width={800}
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddUserModalVisible(true)}
          style={{ marginBottom: 16 }}
        >
          添加用户
        </Button>
        <Table
          dataSource={users}
          rowKey={(record, index) => index ?? 0}
          pagination={false}
          columns={[
            { title: '用户名', dataIndex: 'user', key: 'user' },
            { title: '主机', dataIndex: 'host', key: 'host' },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record: any) => (
                <Popconfirm
                  title="确定要删除此用户吗？"
                  onConfirm={() => deleteUser(record.user)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="link" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>

      {/* Add User Modal */}
      <Modal
        title="添加数据库用户"
        open={addUserModalVisible}
        onCancel={() => setAddUserModalVisible(false)}
        onOk={() => {
          addUserForm.validateFields().then((values) => {
            createUser(values);
          });
        }}
      >
        <Form form={addUserForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="newuser" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="host" label="主机" initialValue="%">
            <Input placeholder="%" />
          </Form.Item>
          <Form.Item name="privileges" label="权限">
            <Select mode="tags" placeholder="选择权限">
              <Select.Option value="ALL PRIVILEGES">ALL PRIVILEGES</Select.Option>
              <Select.Option value="SELECT">SELECT</Select.Option>
              <Select.Option value="INSERT">INSERT</Select.Option>
              <Select.Option value="UPDATE">UPDATE</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
              <Select.Option value="CREATE">CREATE</Select.Option>
              <Select.Option value="DROP">DROP</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="导入数据"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={importDatabase}
        width={800}
      >
        <Alert
          message="导入 SQL 数据"
          description="粘贴要导入的 SQL 内容"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <TextArea
          rows={15}
          value={importSql}
          onChange={(e) => setImportSql(e.target.value)}
          placeholder="-- 粘贴 SQL 内容
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100)
);"
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>

      {/* Create Database Modal */}
      <Modal
        title="创建数据库"
        open={createDbModalVisible}
        onCancel={() => setCreateDbModalVisible(false)}
        onOk={() => {
          createDbForm.validateFields().then((values) => {
            createDatabase(values);
          });
        }}
      >
        <Alert
          message="创建新数据库"
          description="在数据库服务器上创建一个新的数据库"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={createDbForm} layout="vertical">
          <Form.Item
            name="databaseName"
            label="数据库名称"
            rules={[{ required: true, message: '请输入数据库名称' }]}
          >
            <Input placeholder="my_database" />
          </Form.Item>
          {selectedDatabase?.type === 'mysql' && (
            <>
              <Form.Item
                name="characterSet"
                label="字符集"
                initialValue="utf8mb4"
              >
                <Select>
                  <Select.Option value="utf8mb4">utf8mb4</Select.Option>
                  <Select.Option value="utf8">utf8</Select.Option>
                  <Select.Option value="latin1">latin1</Select.Option>
                  <Select.Option value="gbk">gbk</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="collation"
                label="排序规则"
                initialValue="utf8mb4_unicode_ci"
              >
                <Select>
                  <Select.Option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</Select.Option>
                  <Select.Option value="utf8mb4_general_ci">utf8mb4_general_ci</Select.Option>
                  <Select.Option value="utf8_unicode_ci">utf8_unicode_ci</Select.Option>
                  <Select.Option value="utf8_general_ci">utf8_general_ci</Select.Option>
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Rename Database Modal */}
      <Modal
        title="重命名数据库"
        open={renameDbModalVisible}
        onCancel={() => setRenameDbModalVisible(false)}
        onOk={() => {
          renameDbForm.validateFields().then((values) => {
            renameDatabase(values);
          });
        }}
      >
        <Alert
          message="重命名数据库"
          description={selectedDatabase?.type === 'mysql'
            ? "MySQL 不支持直接重命名数据库。请创建新数据库并手动迁移数据。"
            : selectedDatabase?.type === 'mongodb'
            ? "MongoDB 不支持重命名数据库。请创建新数据库并手动迁移数据。"
            : "重命名数据库（注意：此操作可能会影响正在运行的程序）"
          }
          type={selectedDatabase?.type === 'mysql' || selectedDatabase?.type === 'mongodb' ? "warning" : "info"}
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={renameDbForm} layout="vertical">
          <Form.Item
            name="oldName"
            label="原数据库名称"
            rules={[{ required: true, message: '请选择原数据库名称' }]}
          >
            <Select
              placeholder="选择要重命名的数据库"
              disabled={selectedDatabase?.type === 'mysql' || selectedDatabase?.type === 'mongodb'}
            >
              {databaseList.map(db => (
                <Select.Option key={db} value={db}>{db}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="newName"
            label="新数据库名称"
            rules={[{ required: true, message: '请输入新数据库名称' }]}
          >
            <Input
              placeholder="new_database_name"
              disabled={selectedDatabase?.type === 'mysql' || selectedDatabase?.type === 'mongodb'}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drop Database Modal */}
      <Modal
        title="删除数据库"
        open={dropDbModalVisible}
        onCancel={() => setDropDbModalVisible(false)}
        footer={null}
      >
        <Alert
          message="⚠️ 危险操作"
          description="删除数据库将永久删除其中的所有数据，此操作无法撤销！"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>选择要删除的数据库：</Text>
          {!selectedDatabase ? (
            <Alert
              message="请先选择数据库配置"
              description="请先在左侧选择一个数据库配置（MySQL、PostgreSQL 等）"
              type="warning"
              showIcon
            />
          ) : (
            <Select
              placeholder="选择要删除的数据库"
              style={{ width: '100%' }}
              loading={loading}
              onChange={(value) => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除数据库 "${value}" 吗？此操作无法撤销！`,
                  okText: '确定删除',
                  okType: 'danger',
                  cancelText: '取消',
                  onOk: () => {
                    dropDatabase(value);
                    setDropDbModalVisible(false);
                  },
                });
              }}
            >
              {databaseList.map(db => (
                <Select.Option key={db} value={db}>{db}</Select.Option>
              ))}
            </Select>
          )}
          {selectedDatabase && databaseList.length === 0 && !loading && (
            <Alert
              message="暂无可删除的数据库"
              description={`当前 ${selectedDatabase.type} 数据库中没有找到可删除的数据库`}
              type="info"
              showIcon
            />
          )}
        </Space>
      </Modal>

      {/* Add Column Modal */}
      <Modal
        title="添加列"
        open={addColumnModalVisible}
        onCancel={() => setAddColumnModalVisible(false)}
        onOk={() => {
          addColumnForm.validateFields().then((values) => {
            addColumn(values);
          });
        }}
      >
        <Alert
          message="添加新列"
          description={`在表 "${selectedTable}" 中添加一个新的列`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={addColumnForm} layout="vertical">
          <Form.Item
            name="fieldName"
            label="列名"
            rules={[{ required: true, message: '请输入列名' }]}
          >
            <Input placeholder="column_name" />
          </Form.Item>
          <Form.Item
            name="fieldType"
            label="数据类型"
            rules={[{ required: true, message: '请选择数据类型' }]}
            initialValue="VARCHAR(255)"
          >
            <Select>
              <Select.OptGroup label="字符串类型">
                <Select.Option value="VARCHAR(255)">VARCHAR(255)</Select.Option>
                <Select.Option value="VARCHAR(500)">VARCHAR(500)</Select.Option>
                <Select.Option value="TEXT">TEXT</Select.Option>
                <Select.Option value="LONGTEXT">LONGTEXT</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="数值类型">
                <Select.Option value="INT">INT</Select.Option>
                <Select.Option value="BIGINT">BIGINT</Select.Option>
                <Select.Option value="DECIMAL(10,2)">DECIMAL(10,2)</Select.Option>
                <Select.Option value="FLOAT">FLOAT</Select.Option>
                <Select.Option value="DOUBLE">DOUBLE</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="日期时间类型">
                <Select.Option value="DATE">DATE</Select.Option>
                <Select.Option value="DATETIME">DATETIME</Select.Option>
                <Select.Option value="TIMESTAMP">TIMESTAMP</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="其他类型">
                <Select.Option value="BOOLEAN">BOOLEAN</Select.Option>
                <Select.Option value="JSON">JSON</Select.Option>
              </Select.OptGroup>
            </Select>
          </Form.Item>
          <Form.Item
            name="nullable"
            label="允许 NULL"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="defaultValue"
            label="默认值"
          >
            <Input placeholder="可选，例如: 0, '', NULL" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Column Modal */}
      <Modal
        title="修改列"
        open={editColumnModalVisible}
        onCancel={() => {
          setEditColumnModalVisible(false);
          setEditingColumn(null);
          editColumnForm.resetFields();
        }}
        onOk={() => {
          editColumnForm.validateFields().then((values) => {
            updateColumn(values);
          });
        }}
      >
        <Alert
          message="修改列结构"
          description={`修改表 "${selectedTable}" 中的列 "${editingColumn?.Field || ''}"`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={editColumnForm} layout="vertical">
          <Form.Item
            name="fieldName"
            label="新列名"
            rules={[{ required: true, message: '请输入列名' }]}
          >
            <Input placeholder="column_name" />
          </Form.Item>
          <Form.Item
            name="fieldType"
            label="数据类型"
            rules={[{ required: true, message: '请选择数据类型' }]}
          >
            <Select>
              <Select.OptGroup label="字符串类型">
                <Select.Option value="VARCHAR(255)">VARCHAR(255)</Select.Option>
                <Select.Option value="VARCHAR(500)">VARCHAR(500)</Select.Option>
                <Select.Option value="TEXT">TEXT</Select.Option>
                <Select.Option value="LONGTEXT">LONGTEXT</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="数值类型">
                <Select.Option value="INT">INT</Select.Option>
                <Select.Option value="BIGINT">BIGINT</Select.Option>
                <Select.Option value="DECIMAL(10,2)">DECIMAL(10,2)</Select.Option>
                <Select.Option value="FLOAT">FLOAT</Select.Option>
                <Select.Option value="DOUBLE">DOUBLE</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="日期时间类型">
                <Select.Option value="DATE">DATE</Select.Option>
                <Select.Option value="DATETIME">DATETIME</Select.Option>
                <Select.Option value="TIMESTAMP">TIMESTAMP</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="其他类型">
                <Select.Option value="BOOLEAN">BOOLEAN</Select.Option>
                <Select.Option value="JSON">JSON</Select.Option>
              </Select.OptGroup>
            </Select>
          </Form.Item>
          <Form.Item
            name="nullable"
            label="允许 NULL"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="defaultValue"
            label="默认值"
          >
            <Input placeholder="可选，例如: 0, '', NULL" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Credentials Modal */}
      <Modal
        title={
          <Space>
            <KeyOutlined />
            <span>重置数据库凭证</span>
          </Space>
        }
        open={resetCredentialModalVisible}
        onCancel={() => {
          setResetCredentialModalVisible(false);
          setResettingDb(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setResetCredentialModalVisible(false)}>
            取消
          </Button>,
          <Popconfirm
            key="confirm"
            title="重置凭证确认"
            description={
              <div>
                <p>此操作将：</p>
                <ul>
                  <li>创建新的数据库用户 <strong>panel_user</strong></li>
                  <li>生成新的随机密码（16位）</li>
                  <li>授予该用户所有权限</li>
                  <li>更新所有使用此数据库的连接</li>
                  <li>加密保存新密码到本地文件</li>
                </ul>
                <p style={{ color: 'red', fontWeight: 'bold' }}>⚠️ 旧的用户名和密码将无法使用！</p>
              </div>
            }
            onConfirm={() => resetCredentials(resettingDb)}
            okText="确认重置"
            okType="danger"
            cancelText="取消"
          >
            <Button type="primary" danger loading={loading}>
              确认重置
            </Button>
          </Popconfirm>,
        ]}
        width={600}
      >
        {resettingDb && (
          <>
            <Alert
              message="重置数据库凭证"
              description={
                <div>
                  <p>将为以下数据库重置凭证：</p>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="数据库名称">{resettingDb.name}</Descriptions.Item>
                    <Descriptions.Item label="类型">{resettingDb.type.toUpperCase()}</Descriptions.Item>
                    <Descriptions.Item label="主机">{resettingDb.host}:{resettingDb.port}</Descriptions.Item>
                    <Descriptions.Item label="当前用户名">{resettingDb.username}</Descriptions.Item>
                    <Descriptions.Item label="当前密码">••••••••</Descriptions.Item>
                  </Descriptions>
                  <div style={{ marginTop: 16 }}>
                    <p><strong>重置后：</strong></p>
                    <ul>
                      <li>用户名：<code>panel_user</code></li>
                      <li>密码：自动生成（16位随机字符）</li>
                      <li>密码保存位置：<code>backend/data/db_credentials.json</code>（AES-256加密）</li>
                    </ul>
                  </div>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Alert
              message="安全提示"
              description="新密码将使用 AES-256 加密算法保存在本地文件中。请确保文件访问权限正确，避免未授权访问。"
              type="info"
              showIcon
            />
          </>
        )}
      </Modal>

      {/* Rename Table Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>重命名表</span>
          </Space>
        }
        open={renameTableModalVisible}
        onCancel={() => {
          setRenameTableModalVisible(false);
          setNewTableName('');
        }}
        onOk={() => renameTable()}
        okText="重命名"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="当前表名">
            <Input value={selectedTable} disabled />
          </Form.Item>
          <Form.Item label="新表名">
            <Input
              placeholder="请输入新的表名"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              onPressEnter={() => renameTable()}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drop Table Confirmation Modal (Two-step confirmation) */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>删除表 - 二次确认</span>
          </Space>
        }
        open={dropTableFirstConfirm}
        onCancel={() => setDropTableFirstConfirm(false)}
        footer={[
          <Button key="cancel" onClick={() => setDropTableFirstConfirm(false)}>
            取消
          </Button>,
          <Popconfirm
            key="final-confirm"
            title={
              <div>
                <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  ⚠️ 最终确认：删除表 "{selectedTable}"
                </p>
                <div style={{ backgroundColor: '#fff2f0', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
                  <p style={{ margin: 0, color: '#cf1322' }}>
                    <strong>您即将执行以下操作：</strong>
                  </p>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px', color: '#cf1322' }}>
                    <li>删除表：<strong>{selectedTable}</strong></li>
                    <li>删除该表的所有数据</li>
                    <li>删除该表的所有结构和索引</li>
                    <li>此操作 <strong>不可恢复</strong></li>
                  </ul>
                </div>
                <p style={{ fontSize: '14px', color: '#8c8c8c' }}>
                  请再次确认您真的要删除这个表吗？
                </p>
              </div>
            }
            onConfirm={() => {
              setDropTableFirstConfirm(false);
              dropTable();
            }}
            okText="确认删除"
            okType="danger"
            cancelText="再想想"
            icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          >
            <Button danger>确认删除</Button>
          </Popconfirm>,
        ]}
        width={500}
      >
        <div style={{ padding: '16px 0' }}>
          <Alert
            message="危险操作警告"
            description={
              <div>
                <p>您正在删除表：<strong>{selectedTable}</strong></p>
                <p style={{ marginTop: '12px' }}>
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: '8px' }} />
                  <span style={{ color: '#faad14', fontWeight: 'bold' }}>
                    此操作将永久删除该表及其所有数据，无法恢复！
                  </span>
                </p>
                <p style={{ marginTop: '12px', fontSize: '14px', color: '#8c8c8c' }}>
                  如果您确定要删除，请点击右下角的"确认删除"按钮进行最终确认。
                </p>
              </div>
            }
            type="error"
            showIcon
          />
        </div>
      </Modal>
    </Layout>
  );
}

const BackupOutlined = () => <span>⬇️</span>;
