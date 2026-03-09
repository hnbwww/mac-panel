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
  Statistic,
  Tabs,
  Menu,
  Layout,
  Typography,
  Alert,
  Divider,
  Progress,
} from 'antd';
import { Input as TextAreaInput } from 'antd';
const { TextArea } = TextAreaInput;
const { Sider, Content } = Layout;
const { Title, Text } = Typography;
import {
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  SettingOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import './Database.css';

interface Database {
  id: string;
  name: string;
  type: string;
  username: string;
  password?: string;
  host?: string;
  port?: number;
  status?: 'running' | 'stopped' | 'unknown';
  createdAt: string;
}

interface DatabaseType {
  key: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  defaultPort: number;
}

interface CreateDatabaseForm {
  name: string;
  type: string;
  username: string;
  password?: string;
  host?: string;
  port?: number;
}

const DATABASE_TYPES: DatabaseType[] = [
  {
    key: 'mysql',
    name: 'MySQL',
    icon: '🐬',
    color: '#00758F',
    description: '流行的关系型数据库',
    defaultPort: 3306,
  },
  {
    key: 'postgresql',
    name: 'PostgreSQL',
    icon: '🐘',
    color: '#336791',
    description: '强大的开源关系型数据库',
    defaultPort: 5432,
  },
  {
    key: 'redis',
    name: 'Redis',
    icon: '🔴',
    color: '#DC382D',
    description: '高性能键值存储数据库',
    defaultPort: 6379,
  },
  {
    key: 'mongodb',
    name: 'MongoDB',
    icon: '🍃',
    color: '#4DB33D',
    description: '流行的 NoSQL 文档数据库',
    defaultPort: 27017,
  },
];

export default function DatabasePage() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('mysql');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDb, setSelectedDb] = useState<Database | null>(null);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [form] = Form.useForm();

  const API_BASE_URL = import.meta.env.VITE_API_URL;

  const loadDatabases = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDatabases(data || []);
      } else {
        message.error('获取数据库列表失败');
      }
    } catch (error: any) {
      message.error('获取数据库列表失败');
      console.error('Error loading databases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabases();
  }, []);

  const handleCreate = async (values: CreateDatabaseForm) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success('创建成功');
        setModalOpen(false);
        form.resetFields();
        loadDatabases();
      } else {
        const error = await response.json();
        message.error(error.message || '创建失败');
      }
    } catch (error: any) {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        message.success('删除成功');
        loadDatabases();
      } else {
        message.error('删除失败');
      }
    } catch (error: any) {
      message.error('删除失败');
    }
  };

  const handleBackup = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/backup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        message.success('备份成功');
      } else {
        message.error('备份失败');
      }
    } catch (error: any) {
      message.error('备份失败');
    }
  };

  const handleExecuteSQL = async () => {
    if (!selectedDb || !sqlQuery) {
      message.warning('请选择数据库并输入 SQL 语句');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/database/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          databaseId: selectedDb.id,
          sql: sqlQuery,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setQueryResult(result);
        message.success('执行成功');
      } else {
        message.error('执行失败');
      }
    } catch (error: any) {
      message.error('执行失败');
    }
  };

  const filteredDatabases = databases.filter(db => db.type === selectedType);
  const currentDbType = DATABASE_TYPES.find(t => t.key === selectedType) || DATABASE_TYPES[0];

  const columns = [
    {
      title: '数据库名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Database) => (
        <Space>
          <Text strong>{name}</Text>
          {record.status === 'running' && <Tag color="success">运行中</Tag>}
          {record.status === 'stopped' && <Tag color="error">已停止</Tag>}
        </Space>
      ),
    },
    {
      title: '连接信息',
      key: 'connection',
      render: (_: any, record: Database) => (
        <Text type="secondary">{record.username}@{record.host || 'localhost'}:{record.port || currentDbType.defaultPort}</Text>
      ),
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      render: (password: string) => (
        <Space>
          <Text type="secondary" style={{ fontFamily: 'monospace' }}>
            {password ? '••••••••' : '未设置'}
          </Text>
          {password && (
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(password);
                message.success('密码已复制到剪贴板');
              }}
            >
              复制
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Database) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleBackup(record.id)}
          >
            备份
          </Button>
          <Popconfirm
            title="确定要删除这个数据库吗？"
            description="删除后无法恢复，请谨慎操作"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sidebarMenu = (
    <Menu
      mode="inline"
      selectedKeys={[selectedType]}
      onClick={({ key }) => setSelectedType(key)}
      style={{ height: '100%', borderRight: 0 }}
    >
      {DATABASE_TYPES.map(type => (
        <Menu.Item key={type.key}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <span style={{ fontSize: 20 }}>{type.icon}</span>
              <span>{type.name}</span>
            </Space>
            <Tag color={databases.filter(d => d.type === type.key).length > 0 ? 'blue' : 'default'}>
              {databases.filter(d => d.type === type.key).length}
            </Tag>
          </Space>
        </Menu.Item>
      ))}
    </Menu>
  );

  const tabItems = [
    {
      key: 'list',
      label: '数据库列表',
      children: (
        <div>
          <Alert
            message={`${currentDbType.icon} ${currentDbType.name} 数据库`}
            description={currentDbType.description}
            type="info"
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={columns}
            dataSource={filteredDatabases}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个数据库`,
            }}
          />
        </div>
      ),
    },
    {
      key: 'sql',
      label: 'SQL 查询',
      children: (
        <div className="sql-query-container">
          <Alert
            message="SQL 查询"
            description={`选择一个 ${currentDbType.name} 数据库执行 SQL 查询`}
            type="info"
            style={{ marginBottom: 16 }}
          />
          <div className="sql-selector" style={{ marginBottom: 16 }}>
            <Select
              placeholder={`选择 ${currentDbType.name} 数据库`}
              style={{ width: '100%' }}
              value={selectedDb?.id}
              onChange={(value) => setSelectedDb(filteredDatabases.find((d) => d.id === value) || null)}
              options={filteredDatabases.map((db) => ({
                label: `${db.name} (${db.username}@${db.host || 'localhost'})`,
                value: db.id,
              }))}
            />
          </div>
          <TextArea
            placeholder={`输入 ${currentDbType.name} 查询语句...`}
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            style={{ minHeight: 200, fontFamily: 'monospace', marginBottom: 16 }}
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecuteSQL}
            disabled={!selectedDb || !sqlQuery}
          >
            执行查询
          </Button>
          {queryResult && (
            <div className="query-result" style={{ marginTop: 16 }}>
              <Card title="查询结果" size="small">
                <pre style={{ maxHeight: 400, overflow: 'auto' }}>
                  {JSON.stringify(queryResult, null, 2)}
                </pre>
              </Card>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'info',
      label: '基本信息',
      children: (
        <Card>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic title="数据库类型" value={currentDbType.name} />
            </Col>
            <Col span={12}>
              <Statistic title="默认端口" value={currentDbType.defaultPort} />
            </Col>
            <Col span={12}>
              <Statistic title="数据库数量" value={filteredDatabases.length} suffix="个" />
            </Col>
            <Col span={12}>
              <Statistic title="运行状态" value="正常" />
            </Col>
          </Row>
          <Divider />
          <Title level={5}>特性说明</Title>
          <ul>
            <li>支持创建和删除数据库</li>
            <li>支持 SQL 查询执行</li>
            <li>支持数据库备份功能</li>
            <li>支持用户权限管理</li>
          </ul>
        </Card>
      ),
    },
  ];

  return (
    <div className="database-page">
      <Layout style={{ background: '#fff', minHeight: 'calc(100vh - 64px)' }}>
        <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: '16px' }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              <DatabaseOutlined /> 数据库类型
            </Title>
            {sidebarMenu}
          </div>
        </Sider>
        <Content style={{ padding: '24px', background: '#fff' }}>
          <div style={{ marginBottom: 24 }}>
            <Space size="large" align="center">
              <span style={{ fontSize: 32 }}>{currentDbType.icon}</span>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  {currentDbType.name} 管理
                </Title>
                <Text type="secondary">{currentDbType.description}</Text>
              </div>
            </Space>
          </div>

          <Card
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadDatabases}
                  loading={loading}
                >
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    form.setFieldsValue({ type: selectedType });
                    setModalOpen(true);
                  }}
                >
                  创建数据库
                </Button>
              </Space>
            }
          >
            <Tabs items={tabItems} />
          </Card>
        </Content>
      </Layout>

      <Modal
        title={`创建 ${currentDbType.name} 数据库`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            name="name"
            label="数据库名"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="my_database" />
          </Form.Item>

          <Form.Item
            name="type"
            label="数据库类型"
            initialValue={selectedType}
            hidden
          >
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="host"
                label="主机地址"
                initialValue="localhost"
              >
                <Input placeholder="localhost" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="port"
                label="端口"
                initialValue={currentDbType.defaultPort}
              >
                <Input type="number" placeholder={String(currentDbType.defaultPort)} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="root" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
            extra="安装数据库时设置的密码"
          >
            <Input.Password placeholder="请输入数据库密码" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
          >
            <Input.Password placeholder="留空则自动生成" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建数据库
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
