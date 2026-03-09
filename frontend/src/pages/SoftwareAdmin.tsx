import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  Switch,
  InputNumber,
  Popconfirm,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ApiOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SoftwareConfig {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  icon?: string;
  installed: boolean;
  version?: string;
  status: string;
  config_path?: string;
  available_versions?: string[];
  requires_password?: boolean;
  default_password?: string;
  enabled: boolean;
  sort_order: number;
  commands: {
    install?: string;
    uninstall?: string;
    start?: string;
    stop?: string;
    restart?: string;
    status?: string;
    version?: string;
    logs?: string;
    repair?: string;
  };
  log_paths?: {
    application?: string;
    error?: string;
    access?: string;
  };
}

const SoftwareAdminPage: React.FC = () => {
  const [configs, setConfigs] = useState<SoftwareConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SoftwareConfig | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/software/list`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // 转换为配置格式
        const configData: SoftwareConfig[] = data.map((sw: any) => ({
          id: sw.name,
          name: sw.name,
          display_name: sw.displayName,
          description: sw.description,
          category: sw.category,
          icon: sw.icon,
          installed: sw.installed,
          version: sw.version,
          status: sw.status,
          config_path: sw.configPath,
          available_versions: sw.availableVersions,
          requires_password: sw.requiresPassword,
          default_password: sw.defaultPassword,
          enabled: true,
          sort_order: 0,
          commands: sw.commands || {},
          log_paths: sw.logPaths || {},
        }));
        setConfigs(configData);
      } else {
        message.error('获取软件配置失败');
      }
    } catch (error) {
      message.error('获取软件配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingConfig(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      sort_order: 0,
      requires_password: false,
      category: 'utility',
      commands: {},
      log_paths: {},
    });
    setModalVisible(true);
  };

  const handleEdit = (config: SoftwareConfig) => {
    setEditingConfig(config);
    form.setFieldsValue({
      ...config,
      requires_password: config.requires_password,
    });
    setModalVisible(true);
  };

  const handleDelete = async (name: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/software/${name}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        message.success('删除成功');
        loadConfigs();
      } else {
        const error = await response.json();
        message.error('删除失败: ' + error.error);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // 转换为后端格式
      const payload = {
        name: values.name,
        displayName: values.display_name,
        description: values.description,
        category: values.category,
        icon: values.icon,
        installed: false,
        status: 'unknown',
        configPath: values.config_path,
        availableVersions: values.available_versions,
        requiresPassword: values.requires_password,
        defaultPassword: values.default_password,
        enabled: values.enabled,
        sortOrder: values.sort_order,
        commands: values.commands || {},
        logPaths: values.log_paths || {},
      };

      const url = editingConfig
        ? `${API_BASE_URL}/api/software/${editingConfig.name}`
        : `${API_BASE_URL}/api/software`;

      const method = editingConfig ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        message.success(editingConfig ? '更新成功' : '添加成功');
        setModalVisible(false);
        loadConfigs();
      } else {
        const error = await response.json();
        message.error('操作失败: ' + error.error);
      }
    } catch (error) {
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
      render: (order: number) => order || 0,
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 60,
      render: (icon: string) => icon || '📦',
    },
    {
      title: '软件名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => {
        const colors: Record<string, string> = {
          development: 'blue',
          database: 'green',
          server: 'orange',
          ai: 'purple',
          utility: 'cyan',
          tool: 'geekblue',
        };
        return <Tag color={colors[category] || 'default'}>{category}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: SoftwareConfig) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个软件配置吗？"
            onConfirm={() => handleDelete(record.name)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              <ApiOutlined /> 软件配置管理
            </Title>
            <Text type="secondary">动态添加和管理软件配置</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadConfigs} loading={loading}>
                刷新
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                添加软件
              </Button>
            </Space>
          </Col>
        </Row>

        <Divider />

        <Table
          columns={columns}
          dataSource={configs}
          rowKey="name"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingConfig ? '编辑软件配置' : '添加软件配置'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={submitting}
        width={800}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            enabled: true,
            sort_order: 0,
            requires_password: false,
            category: 'utility',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="软件名称（英文标识）"
                name="name"
                rules={[{ required: true, message: '请输入软件名称' }]}
              >
                <Input placeholder="例如: mysql" disabled={!!editingConfig} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="显示名称"
                name="display_name"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="例如: MySQL 数据库" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="图标（Emoji）"
                name="icon"
              >
                <Input placeholder="例如: 🐬" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="分类"
                name="category"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="development">开发工具</Option>
                  <Option value="database">数据库</Option>
                  <Option value="server">服务器</Option>
                  <Option value="ai">AI 工具</Option>
                  <Option value="utility">实用工具</Option>
                  <Option value="tool">系统工具</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={2} placeholder="简要描述这个软件的用途" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="排序" name="sort_order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="是否启用" name="enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="配置文件路径（可选）"
            name="config_path"
          >
            <Input placeholder="/opt/homebrew/etc/mysql/my.cnf" />
          </Form.Item>

          <Divider >安装配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="需要密码" name="requires_password" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="默认密码" name="default_password">
                <Input placeholder="root" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="可选版本（用逗号分隔）"
            name="available_versions"
          >
            <Input placeholder="8.0, 5.7" />
          </Form.Item>

          <Divider >命令配置</Divider>

          <Form.Item label="安装命令" name={['commands', 'install']}>
            <TextArea rows={2} placeholder="brew install mysql" />
          </Form.Item>

          <Form.Item label="卸载命令" name={['commands', 'uninstall']}>
            <TextArea rows={2} placeholder="brew uninstall mysql" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="启动命令" name={['commands', 'start']}>
                <Input placeholder="brew services start mysql" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="停止命令" name={['commands', 'stop']}>
                <Input placeholder="brew services stop mysql" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="重启命令" name={['commands', 'restart']}>
                <Input placeholder="brew services restart mysql" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="状态检查命令" name={['commands', 'status']}>
                <Input placeholder="brew services list | grep mysql" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="版本检查命令" name={['commands', 'version']}>
                <Input placeholder="mysql --version" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="修复命令（可选）" name={['commands', 'repair']}>
            <TextArea rows={2} placeholder="brew upgrade mysql" />
          </Form.Item>

          <Divider >日志路径</Divider>

          <Form.Item label="应用日志路径" name={['log_paths', 'application']}>
            <Input placeholder="/opt/homebrew/var/log/mysql.log" />
          </Form.Item>

          <Form.Item label="错误日志路径" name={['log_paths', 'error']}>
            <Input placeholder="/opt/homebrew/var/log/mysql/error.log" />
          </Form.Item>

          <Form.Item label="访问日志路径" name={['log_paths', 'access']}>
            <Input placeholder="/opt/homebrew/var/log/nginx/access.log" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SoftwareAdminPage;
