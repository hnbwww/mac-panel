import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Card,
  Statistic,
  Row,
  Col,
  Radio,
  Divider,
  Alert,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  DownloadOutlined,
  GlobalOutlined,
  SwapRightOutlined,
  FolderOutlined,
  ReloadOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
// import { api } from '../utils/api';
// import { API_ENDPOINTS } from '../config';
import './Websites.css';

const { TextArea } = Input;

interface ProxyConfig {
  enabled: boolean;
  targetUrl: string;
  preserveHost: boolean;
  websocket: boolean;
  customHeaders: Record<string, string>;
}

interface Website {
  id: string;
  domain: string;
  rootDir: string;
  type: 'static' | 'php' | 'java' | 'proxy';
  phpVersion: string;
  javaVersion: string;
  port: number;
  ssl: boolean;
  proxyConfig?: ProxyConfig;
  createdAt: string;
}

interface WebsiteForm {
  domain: string;
  rootDir: string;
  type: 'static' | 'php' | 'java' | 'proxy';
  phpVersion: string;
  javaVersion: string;
  port: number;
  proxyConfig?: ProxyConfig;
}

export default function Websites() {
  const navigate = useNavigate();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<Website | null>(null);
  const [websiteType, setWebsiteType] = useState<'static' | 'php' | 'java' | 'proxy'>('static');
  const [sslModalOpen, setSslModalOpen] = useState(false);
  const [sslWebsite, setSslWebsite] = useState<Website | null>(null);
  const [sslForm] = Form.useForm();
  const [form] = Form.useForm();
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configDomain, setConfigDomain] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [siteEnabledStatus, setSiteEnabledStatus] = useState<Record<string, boolean>>({});
  const [togglingSite, setTogglingSite] = useState<string | null>(null);
  const [reloadingNginx, setReloadingNginx] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  const loadWebsites = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/websites/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWebsites(data || []);
      } else {
        message.error('获取网站列表失败');
      }
    } catch (error: any) {
      message.error('获取网站列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebsites();
  }, []);

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const domain = e.target.value.trim();

    // 自动填充根目录
    if (domain && (websiteType === 'static' || websiteType === 'php' || websiteType === 'java')) {
      form.setFieldValue('rootDir', `~/www/wwwroot/${domain}`);
    }
  };

  const handleTypeChange = (type: 'static' | 'php' | 'java' | 'proxy') => {
    setWebsiteType(type);
    const domain = form.getFieldValue('domain');

    // 静态网站、PHP、Java 网站需要根目录
    if ((type === 'static' || type === 'php' || type === 'java') && domain) {
      form.setFieldValue('rootDir', `~/www/wwwroot/${domain}`);
    }

    // 根据类型设置默认版本
    if (type === 'php') {
      // 如果当前没有设置 PHP 版本，或者当前是 'none'，则设置默认版本
      const currentPhpVersion = form.getFieldValue('phpVersion');
      if (!currentPhpVersion || currentPhpVersion === 'none') {
        form.setFieldValue('phpVersion', '8.4'); // 默认使用 PHP 8.4
      }
    } else if (type === 'java') {
      const currentJavaVersion = form.getFieldValue('javaVersion');
      if (!currentJavaVersion || currentJavaVersion === 'none') {
        form.setFieldValue('javaVersion', '21'); // 默认使用 Java 21
      }
    } else if (type === 'static' || type === 'proxy') {
      form.setFieldValue('phpVersion', 'none');
      form.setFieldValue('javaVersion', 'none');
    }
  };

  const handleCreate = () => {
    setEditingWebsite(null);
    setWebsiteType('static');
    form.resetFields();
    form.setFieldsValue({
      type: 'static',
      phpVersion: 'none',
      javaVersion: 'none',
      port: 80,
    });
    setModalOpen(true);
  };

  const handleEdit = (website: Website) => {
    setEditingWebsite(website);
    setWebsiteType(website.type);

    // Map database field names to form field names
    const formData = {
      domain: website.domain,
      rootDir: website.rootDir,
      type: website.type,
      phpVersion: website.phpVersion || 'none',
      javaVersion: website.javaVersion || 'none',
      port: website.port,
      proxyConfig: website.proxyConfig || {
        enabled: true,
        targetUrl: '',
        preserveHost: true,
        websocket: false,
        customHeaders: {},
      },
    };

    form.setFieldsValue(formData);
    setModalOpen(true);
  };

  const handleSubmit = async (values: WebsiteForm) => {
    try {
      const token = localStorage.getItem('token');
      const url = editingWebsite
        ? `${API_BASE_URL}/api/websites/update`
        : `${API_BASE_URL}/api/websites/create`;

      const payload = editingWebsite
        ? { ...values, id: editingWebsite.id }
        : values;

      const response = await fetch(url, {
        method: editingWebsite ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        message.success(editingWebsite ? '网站更新成功，Nginx 配置已自动重新载入' : '网站创建成功，Nginx 配置已自动重新载入');
        setModalOpen(false);
        loadWebsites();
      } else {
        const error = await response.json();
        message.error(error.message || '操作失败');
      }
    } catch (error: any) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/websites/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        message.success('网站删除成功，Nginx 配置已自动重新载入');
        loadWebsites();
      } else {
        message.error('删除失败');
      }
    } catch (error: any) {
      message.error('删除失败');
    }
  };

  const handleSSL = (website: Website) => {
    setSslWebsite(website);
    sslForm.resetFields();
    setSslModalOpen(true);
  };

  const handleSSLSubmit = async (values: { type: 'custom' | 'letsencrypt'; cert?: string; key?: string }) => {
    if (!sslWebsite) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/websites/ssl`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: sslWebsite.id,
          ...values
        }),
      });

      if (response.ok) {
        message.success('SSL 证书配置成功，Nginx 配置已自动重新载入');
        setSslModalOpen(false);
        loadWebsites();
      } else {
        const error = await response.json();
        message.error(error.error || 'SSL 配置失败');
      }
    } catch (error: any) {
      message.error('SSL 配置失败');
    }
  };

  // 手动重新载入 Nginx 配置
  const handleReloadNginx = async () => {
    try {
      setReloadingNginx(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/nginx/reload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        message.success(data.message || 'Nginx 配置已重新载入');
      } else {
        const error = await response.json();
        message.error(error.error || '重新载入失败');
      }
    } catch (error: any) {
      message.error('重新载入失败');
    } finally {
      setReloadingNginx(false);
    }
  };

  // 测试 Nginx 配置
  const handleTestNginx = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/nginx/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          message.success('Nginx 配置测试通过');
        } else {
          message.error('Nginx 配置测试失败: ' + (data.error || ''));
        }
      } else {
        message.error('配置测试失败');
      }
    } catch (error: any) {
      message.error('配置测试失败');
    }
  };

  // 查看网站配置
  const handleViewConfig = async (domain: string) => {
    try {
      setConfigDomain(domain);
      setIsEditingConfig(false);
      setConfigModalVisible(true);

      const response = await fetch(`${API_BASE_URL}/api/nginx/sites/${domain}/config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConfigContent(data.config);
      } else {
        message.error('获取配置失败');
      }
    } catch (error: any) {
      message.error('获取配置失败');
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      const response = await fetch(`${API_BASE_URL}/api/nginx/sites/${configDomain}/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: configContent }),
      });

      if (response.ok) {
        message.success('配置已保存并重新加载');
        setConfigModalVisible(false);
      } else {
        const error = await response.json();
        if (error.error) {
          message.error('保存失败: ' + error.error);
          if (error.details) {
            message.error('配置错误: ' + error.details);
          }
        } else {
          message.error('保存失败');
        }
      }
    } catch (error: any) {
      message.error('保存失败');
    } finally {
      setSavingConfig(false);
    }
  };

  // 恢复默认配置
  const handleResetConfig = async () => {
    Modal.confirm({
      title: '确认恢复默认配置',
      icon: <ExclamationCircleOutlined />,
      content: '确定要恢复默认配置吗？当前的自定义配置将被删除。',
      onOk: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/nginx/sites/${configDomain}/reset-config`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            message.success('已恢复默认配置');
            setConfigModalVisible(false);
            await handleViewConfig(configDomain);
          } else {
            const error = await response.json();
            message.error('恢复失败: ' + error.error);
          }
        } catch (error: any) {
          message.error('恢复失败');
        }
      },
    });
  };

  // 启用/停用网站
  const handleToggleSite = async (domain: string, enabled: boolean) => {
    const action = enabled ? 'enable' : 'disable';
    const actionText = enabled ? '启用' : '停用';

    try {
      setTogglingSite(domain);
      const response = await fetch(`${API_BASE_URL}/api/nginx/sites/${domain}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        message.success(`网站${actionText}成功`);
        setSiteEnabledStatus(prev => ({
          ...prev,
          [domain]: enabled
        }));
      } else {
        const error = await response.json();
        message.error(`${actionText}失败: ${error.error}`);
      }
    } catch (error: any) {
      message.error(`${actionText}失败`);
    } finally {
      setTogglingSite(null);
    }
  };

  const columns = [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain: string, record: Website) => (
        <Space>
          <GlobalOutlined />
          <a
            href={`http://${record.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 8 }}
          >
            {domain}
          </a>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          static: { text: '静态网站', color: 'blue' },
          php: { text: 'PHP 网站', color: 'purple' },
          java: { text: 'Java 网站', color: 'orange' },
          proxy: { text: '反向代理', color: 'green' },
        };
        const config = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '路径/目标',
      key: 'path',
      ellipsis: true,
      render: (_: any, record: Website) => {
        if (record.type === 'proxy' && record.proxyConfig) {
          return (
            <span style={{ fontSize: '12px', color: '#666' }}>{record.proxyConfig.targetUrl}</span>
          );
        }
        return (
          <Space
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigate(`/files?path=${encodeURIComponent(record.rootDir)}`);
            }}
          >
            <FolderOutlined />
            <span style={{ color: '#1890ff', textDecoration: 'underline', marginLeft: 8, fontSize: '12px' }}>
              {record.rootDir}
            </span>
          </Space>
        );
      },
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      render: (port: number) => <span>{port}</span>,
    },
    {
      title: 'SSL',
      dataIndex: 'ssl',
      key: 'ssl',
      render: (ssl: boolean) => (
        ssl ? (
          <Tag icon={<SafetyOutlined />} color="green">
            已启用
          </Tag>
        ) : (
          <Tag color="default">未启用</Tag>
        )
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (_: any, record: Website) => (
        <Switch
          checked={siteEnabledStatus[record.domain] ?? true}
          onChange={(checked) => handleToggleSite(record.domain, checked)}
          checkedChildren="启用"
          unCheckedChildren="停用"
          loading={togglingSite === record.domain}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Website) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewConfig(record.domain)}
          >
            配置
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {!record.ssl && (
            <Button
              type="link"
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => handleSSL(record)}
            >
              SSL
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确定要删除这个网站吗？',
                content: '删除后无法恢复，包括所有配置和数据',
                okText: '确定',
                okButtonProps: { danger: true },
                onOk: () => handleDelete(record.id),
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="websites-page">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="网站总数" value={websites.length} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="静态网站"
              value={websites.filter((w) => w.type === 'static').length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="反向代理"
              value={websites.filter((w) => w.type === 'proxy').length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="SSL 启用"
              value={websites.filter((w) => w.ssl).length}
              suffix={`/ ${websites.length}`}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={<><ApiOutlined /> Nginx 服务管理</>}
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleTestNginx}
            >
              测试配置
            </Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleReloadNginx}
              loading={reloadingNginx}
            >
              重新载入配置
            </Button>
            <Button
              onClick={() => navigate('/nginx')}
            >
              Nginx 管理页面
            </Button>
          </Space>
        }
      >
        <Alert
          message="Nginx 自动配置说明"
          description={
            <div>
              <p>添加、删除、更新网站时，Nginx 配置会自动重新载入，无需手动操作。</p>
              <p>如果需要手动重新载入配置（例如配置文件被外部修改），请点击"重新载入配置"按钮。</p>
              <p>点击"测试配置"可以检查 Nginx 配置文件语法是否正确。</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Card>

      <Card
        title="网站列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建网站
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={websites}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个网站`,
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={editingWebsite ? '编辑网站' : '创建网站'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          initialValues={{
            type: 'static',
            phpVersion: 'none',
            port: 80,
            proxyConfig: {
              enabled: true,
              preserveHost: true,
              websocket: false,
            },
          }}
        >
          <Form.Item
            name="type"
            label="网站类型"
            rules={[{ required: true, message: '请选择网站类型' }]}
          >
            <Radio.Group onChange={(e) => handleTypeChange(e.target.value)}>
              <Radio value="static">
                <Space>
                  <GlobalOutlined />
                  静态网站
                </Space>
              </Radio>
              <Radio value="php">
                <Space>
                  <SafetyOutlined />
                  PHP 网站
                </Space>
              </Radio>
              <Radio value="java">
                <Space>
                  <DownloadOutlined />
                  Java 网站
                </Space>
              </Radio>
              <Radio value="proxy">
                <Space>
                  <SwapRightOutlined />
                  反向代理
                </Space>
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="domain"
            label="域名"
            rules={[{ required: true, message: '请输入域名' }]}
            extra="输入域名后将自动创建网站目录"
          >
            <Input
              placeholder="example.com"
              onChange={handleDomainChange}
              prefix={<GlobalOutlined />}
            />
          </Form.Item>

          {websiteType === 'static' && (
            <>
              <Form.Item
                name="rootDir"
                label="根目录"
                rules={[{ required: true, message: '请输入根目录' }]}
                extra="输入域名后自动填充，目录将自动创建"
              >
                <Input
                  placeholder="~/www/wwwroot/example.com"
                  prefix={<FolderOutlined />}
                />
              </Form.Item>
              {/* 隐藏字段：静态网站使用 none 作为版本 */}
              <Form.Item name="phpVersion" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="javaVersion" hidden>
                <Input />
              </Form.Item>
            </>
          )}

          {websiteType === 'php' && (
            <>
              <Alert
                message="PHP 网站配置"
                description="配置 PHP 运行环境和版本"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="rootDir"
                label="根目录"
                rules={[{ required: true, message: '请输入根目录' }]}
                extra="输入域名后自动填充，目录和配置将自动创建"
              >
                <Input
                  placeholder="~/www/wwwroot/example.com"
                  prefix={<FolderOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="phpVersion"
                label="PHP 版本"
                rules={[{ required: true, message: '请选择 PHP 版本' }]}
              >
                <Select>
                  <Select.Option value="8.4">PHP 8.4</Select.Option>
                  <Select.Option value="8.3">PHP 8.3</Select.Option>
                  <Select.Option value="8.2">PHP 8.2</Select.Option>
                  <Select.Option value="8.1">PHP 8.1</Select.Option>
                  <Select.Option value="8.0">PHP 8.0</Select.Option>
                </Select>
              </Form.Item>
              {/* 隐藏字段：PHP 网站不需要 Java 版本 */}
              <Form.Item name="javaVersion" hidden>
                <Input />
              </Form.Item>
            </>
          )}

          {websiteType === 'java' && (
            <>
              <Alert
                message="Java 网站配置"
                description="配置 Java 运行环境和版本"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="rootDir"
                label="根目录"
                rules={[{ required: true, message: '请输入根目录' }]}
                extra="输入域名后自动填充，目录和配置将自动创建"
              >
                <Input
                  placeholder="~/www/wwwroot/example.com"
                  prefix={<FolderOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="javaVersion"
                label="Java 版本"
                rules={[{ required: true, message: '请选择 Java 版本' }]}
              >
                <Select>
                  <Select.Option value="21">Java 21 (LTS)</Select.Option>
                  <Select.Option value="17">Java 17 (LTS)</Select.Option>
                  <Select.Option value="11">Java 11 (LTS)</Select.Option>
                  <Select.Option value="8">Java 8 (LTS)</Select.Option>
                </Select>
              </Form.Item>
              {/* 隐藏字段：Java 网站不需要 PHP 版本 */}
              <Form.Item name="phpVersion" hidden>
                <Input />
              </Form.Item>
            </>
          )}

          {websiteType === 'proxy' && (
            <>
              <Alert
                message="反向代理配置"
                description="将请求转发到目标服务器，适用于负载均衡、API 网关等场景"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name={['proxyConfig', 'targetUrl']}
                label="目标地址"
                rules={[{ required: true, message: '请输入目标地址' }]}
                extra="例如: http://localhost:3000 或 https://api.example.com"
              >
                <Input placeholder="http://localhost:3000" prefix={<SwapRightOutlined />} />
              </Form.Item>

              <Form.Item
                name={['proxyConfig', 'preserveHost']}
                label="保留 Host 头"
                valuePropName="checked"
              >
                <Radio.Group>
                  <Radio value={true}>是</Radio>
                  <Radio value={false}>否</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name={['proxyConfig', 'websocket']}
                label="启用 WebSocket"
                valuePropName="checked"
                extra="如果目标服务使用 WebSocket，请启用此选项"
              >
                <Radio.Group>
                  <Radio value={true}>是</Radio>
                  <Radio value={false}>否</Radio>
                </Radio.Group>
              </Form.Item>

              {/* 隐藏字段：反向代理不需要版本 */}
              <Form.Item name="phpVersion" hidden>
                <Input />
              </Form.Item>
              <Form.Item name="javaVersion" hidden>
                <Input />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="port"
            label="端口"
            initialValue={80}
          >
            <Input type="number" placeholder="80" />
          </Form.Item>

          <Divider />

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingWebsite ? '更新网站' : '创建网站'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`SSL 证书配置 - ${sslWebsite?.domain}`}
        open={sslModalOpen}
        onCancel={() => setSslModalOpen(false)}
        footer={null}
        width={700}
      >
        <Form
          form={sslForm}
          onFinish={handleSSLSubmit}
          layout="vertical"
        >
          <Alert
            message="SSL 证书配置"
            description="配置 SSL 证书后，您的网站将支持 HTTPS 访问"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="type"
            label="证书类型"
            rules={[{ required: true, message: '请选择证书类型' }]}
            initialValue="custom"
          >
            <Radio.Group>
              <Radio value="custom">自定义证书</Radio>
              <Radio value="letsencrypt">Let's Encrypt (自动申请)</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'custom' ? (
                <>
                  <Form.Item
                    name="cert"
                    label="SSL 证书 (PEM格式)"
                    rules={[{ required: true, message: '请输入SSL证书' }]}
                    extra="粘贴完整的证书链内容，包括-----BEGIN CERTIFICATE-----到-----END CERTIFICATE-----"
                  >
                    <TextArea
                      rows={6}
                      placeholder="-----BEGIN CERTIFICATE-----
你的证书内容
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
中间证书内容（如果有）
-----END CERTIFICATE-----"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="key"
                    label="私钥 (PEM格式)"
                    rules={[{ required: true, message: '请输入私钥' }]}
                    extra="粘贴私钥内容，包括-----BEGIN PRIVATE KEY-----到-----END PRIVATE KEY-----"
                  >
                    <TextArea
                      rows={6}
                      placeholder="-----BEGIN PRIVATE KEY-----
你的私钥内容
-----END PRIVATE KEY-----"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                </>
              ) : getFieldValue('type') === 'letsencrypt' ? (
                <Alert
                  message="Let's Encrypt 自动申请"
                  description="此功能将自动为您的域名申请免费的 SSL 证书。需要确保域名已正确解析到此服务器的公网IP。"
                  type="warning"
                  showIcon
                />
              ) : null
            }
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              配置 SSL 证书
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Nginx 配置编辑模态框 */}
      <Modal
        title={
          <Space>
            <ApiOutlined />
            <span>{isEditingConfig ? '编辑' : '查看'} Nginx 配置 - {configDomain}</span>
          </Space>
        }
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setConfigModalVisible(false)}>
            关闭
          </Button>,
          !isEditingConfig && (
            <Button key="edit" type="primary" onClick={() => setIsEditingConfig(true)}>
              <EditOutlined /> 编辑配置
            </Button>
          ),
          isEditingConfig && (
            <>
              <Button key="reset" onClick={handleResetConfig}>
                恢复默认
              </Button>
              <Button key="save" type="primary" onClick={handleSaveConfig} loading={savingConfig}>
                保存配置
              </Button>
            </>
          ),
        ]}
      >
        <Alert
          message={isEditingConfig ? "编辑模式" : "只读模式"}
          description={isEditingConfig
            ? "您可以修改配置内容。修改后点击「保存配置」将自动测试并重新加载 Nginx。"
            : "当前为只读模式，点击「编辑配置」可以修改。"}
          type={isEditingConfig ? "warning" : "info"}
          style={{ marginBottom: 16 }}
        />
        <Input.TextArea
          value={configContent}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConfigContent(e.target.value)}
          disabled={!isEditingConfig}
          style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
            fontSize: '13px',
            minHeight: '400px',
          }}
          spellCheck={false}
        />
      </Modal>
    </div>
  );
}
