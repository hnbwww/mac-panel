import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  Select,
  message,
  Tabs,
  Typography,
  Tooltip,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Alert,
  Drawer,
  Divider,
  Switch,
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  StopOutlined,
  SyncOutlined,
  FileTextOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ToolOutlined,
  RocketOutlined,
  FileMarkdownOutlined,
} from '@ant-design/icons';
import './Software/Software.css';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface Software {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  installed: boolean;
  version?: string;
    repair?: string;
  status: 'running' | 'stopped' | 'unknown';
  configPath?: string;
  availableVersions?: string[];
  requiresPassword?: boolean;
  defaultPassword?: string;
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
}

const SoftwarePage: React.FC = () => {
  const [softwareList, setSoftwareList] = useState<Software[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const [configContent, setConfigContent] = useState('');
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [installModalVisible, setInstallModalVisible] = useState(false);
  const [installSoftware, setInstallSoftware] = useState<Software | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [databasePassword, setDatabasePassword] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [claudeConfigDrawerVisible, setClaudeConfigDrawerVisible] = useState(false);
  const [yoloEnabled, setYoloEnabled] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [yoloChecking, setYoloChecking] = useState(false);
  const [creatingClaudeMd, setCreatingClaudeMd] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    loadSoftwareList();
  }, []);

  const loadSoftwareList = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/software/list`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSoftwareList(data);
      } else {
        message.error('获取软件列表失败');
      }
    } catch (error) {
      message.error('获取软件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = (software: Software) => {
    if (software.availableVersions && software.availableVersions.length > 0) {
      // 如果有可选版本，打开安装对话框
      setInstallSoftware(software);
      setSelectedVersion(software.availableVersions[0]);
      if (software.requiresPassword) {
        setDatabasePassword(software.defaultPassword || 'root');
      }
      setInstallModalVisible(true);
    } else if (software.requiresPassword) {
      // 如果需要密码，打开密码输入对话框
      setInstallSoftware(software);
      setDatabasePassword(software.defaultPassword || 'root');
      setInstallModalVisible(true);
    } else {
      // 直接安装
      handleAction(software.id, 'install');
    }
  };

  const handleInstallWithVersion = async () => {
    if (!installSoftware) return;

    setActionLoading(`${installSoftware.id}-install`);

    try {
      const requestBody: any = {};
      if (selectedVersion) {
        requestBody.version = selectedVersion;
      }
      if (installSoftware.requiresPassword && databasePassword) {
        requestBody.password = databasePassword;
      }

      const response = await fetch(`${API_BASE_URL}/api/software/install/${installSoftware.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          message.success(result.message);
          await loadSoftwareList();
          setInstallModalVisible(false);
        } else {
          message.error(result.message);
        }
      } else {
        message.error('安装失败');
      }
    } catch (error) {
      message.error('安装失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (id: string, action: string) => {
    setActionLoading(`${id}-${action}`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/software/${action}/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          message.success(result.message);
          await loadSoftwareList();
        } else {
          message.error(result.message);
        }
      } else {
        message.error(`${action} 失败`);
      }
    } catch (error) {
      message.error(`${action} 失败`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRepair = async (id: string) => {
    setActionLoading(`${id}-repair`);
    try {
      const response = await fetch(`${API_BASE_URL}/api/software/repair/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          message.success(result.message);
          await loadSoftwareList();
        } else {
          message.error(result.message);
        }
      } else {
        message.error('修复失败');
      }
    } catch (error) {
      message.error('修复失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewConfig = async (software: Software) => {
    if (!software.configPath) {
      message.warning('此软件不支持配置文件管理');
      return;
    }

    setSelectedSoftware(software);
    setConfigModalVisible(true);
    setConfigContent('加载中...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/software/config/${software.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const content = await response.text();
        setConfigContent(content);
      } else {
        message.error('获取配置文件失败');
        setConfigContent('');
      }
    } catch (error) {
      message.error('获取配置文件失败');
      setConfigContent('');
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedSoftware) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/software/config/${selectedSoftware.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: configContent })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          message.success(result.message);
          setConfigModalVisible(false);
        } else {
          message.error(result.message);
        }
      } else {
        message.error('保存配置文件失败');
      }
    } catch (error) {
      message.error('保存配置文件失败');
    }
  };

  const handleViewLogs = async (software: Software) => {
    setSelectedSoftware(software);
    setLogsModalVisible(true);
    setLogs([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/software/logs/${software.id}?lines=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        message.error('获取日志失败');
      }
    } catch (error) {
      message.error('获取日志失败');
    }
  };

  // 打开 Claude Code 配置
  const handleOpenClaudeConfig = async () => {
    setClaudeConfigDrawerVisible(true);
    // 检查 Yolo 状态
    await checkYoloStatus();
  };

  // 检查 Yolo 状态
  const checkYoloStatus = async () => {
    try {
      setYoloChecking(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/yolo/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setYoloEnabled(data.enabled);
      }
    } catch (error) {
      console.error('检查 Yolo 状态失败:', error);
    } finally {
      setYoloChecking(false);
    }
  };

  // 配置 Yolo
  const handleYoloToggle = async (enabled: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/yolo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setYoloEnabled(enabled);
        message.success(enabled ? 'Yolo 快捷启动已启用' : 'Yolo 快捷启动已禁用');

        // 重新检查状态
        setTimeout(checkYoloStatus, 1000);
      } else {
        const error = await response.json();
        message.error('操作失败: ' + (error.error || '未知错误'));
      }
    } catch (error: unknown) {
      console.error('配置 Yolo 失败:', error);
      const err = error as { message?: string };
      message.error('操作失败: ' + (err.message || '未知错误'));
    }
  };

  // 创建 CLAUDE.md
  const handleCreateClaudeMd = async () => {
    if (!projectPath.trim()) {
      message.warning('请输入项目路径');
      return;
    }

    try {
      setCreatingClaudeMd(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/claude-md`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectPath: projectPath.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        message.success('CLAUDE.md 和 AI_MEMORY 结构创建成功！');
        message.info(data.message);

        if (data.files) {
          message.info(`已创建文件:\n${data.files.join('\n')}`, 5);
        }

        setProjectPath('');
      } else {
        const error = await response.json();
        message.error('创建失败: ' + error.error);
      }
    } catch (error: unknown) {
      console.error('创建 CLAUDE.md 失败:', error);
      const err = error as { message?: string };
      message.error('创建失败: ' + (err.message || '未知错误'));
    } finally {
      setCreatingClaudeMd(false);
    }
  };

  const getFilteredSoftware = () => {
    if (activeTab === 'all') return softwareList;
    if (activeTab === 'installed') return softwareList.filter(s => s.installed);
    if (activeTab === 'server') return softwareList.filter(s => s.category === 'server');
    if (activeTab === 'database') return softwareList.filter(s => s.category === 'database');
    if (activeTab === 'development') return softwareList.filter(s => s.category === 'development');
    if (activeTab === 'utility') return softwareList.filter(s => s.category === 'utility');
    if (activeTab === 'tool') return softwareList.filter(s => s.category === 'tool');
    if (activeTab === 'ai') return softwareList.filter(s => s.category === 'ai');
    return softwareList;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'stopped':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return <WarningOutlined style={{ color: '#faad14' }} />;
    }
  };

  const columns = [
    {
      title: '软件名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string, record: Software) => (
        <Space>
          <Text strong>{text}</Text>
          {record.installed && record.version && (
            <Tag color="blue">v{record.version}</Tag>
          )}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <Text type="secondary">{text}</Text>
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const categoryMap: { [key: string]: { text: string; color: string } } = {
          server: { text: '服务器', color: 'blue' },
          database: { text: '数据库', color: 'green' },
          development: { text: '开发工具', color: 'orange' },
          utility: { text: '实用工具', color: 'purple' },
          tool: { text: '系统工具', color: 'red' },
          ai: { text: 'AI工具', color: 'magenta' },
          other: { text: '其他', color: 'default' }
        };
        const info = categoryMap[category] || { text: category, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Software) => (
        <Space>
          {getStatusIcon(record.status)}
          <Tag color={record.installed ? 'success' : 'default'}>
            {record.installed ? '已安装' : '未安装'}
          </Tag>
          {record.installed && record.status !== 'unknown' && (
            <Tag color={record.status === 'running' ? 'success' : 'error'}>
              {record.status === 'running' ? '运行中' : '已停止'}
            </Tag>
          )}
          {record.id === 'openclaw' && record.installed && (
            <Tag color="blue" icon={<CheckCircleOutlined />}>
              可扫描
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Software) => (
        <Space size="small">
          {!record.installed ? (
            <Tooltip title="安装">
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                loading={actionLoading === `${record.id}-install`}
                onClick={() => handleInstallClick(record)}
              >
                安装
              </Button>
            </Tooltip>
          ) : (
            <>
              {record.commands.start && (
                <Tooltip title="启动">
                  <Button
                    size="small"
                    icon={<PlayCircleOutlined />}
                    loading={actionLoading === `${record.id}-start`}
                    onClick={() => handleAction(record.id, 'start')}
                    disabled={record.status === 'running'}
                  />
                </Tooltip>
              )}
              {record.commands.stop && (
                <Tooltip title="停止">
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    loading={actionLoading === `${record.id}-stop`}
                    onClick={() => handleAction(record.id, 'stop')}
                    disabled={record.status !== 'running'}
                  />
                </Tooltip>
              )}
              {record.commands.restart && (
                <Tooltip title="重启">
                  <Button
                    size="small"
                    icon={<SyncOutlined />}
                    loading={actionLoading === `${record.id}-restart`}
                    onClick={() => handleAction(record.id, 'restart')}
                  />
                </Tooltip>
              )}
              {record.configPath && (
                <Tooltip title="配置文件">
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => handleViewConfig(record)}
                  />
                </Tooltip>
              )}
              {record.commands.repair && record.installed && (
                <Tooltip title="修复">
                  <Button
                    type="primary"
                    size="small"
                    icon={<ToolOutlined />}
                    loading={actionLoading === `${record.id}-repair`}
                    onClick={() => handleRepair(record.id)}
                    style={{ backgroundColor: '#faad14', borderColor: '#faad14' }}
                  >
                    修复
                  </Button>
                </Tooltip>
              )}
              {record.id === 'claude-code' && (
                <Tooltip title="管理配置">
                  <Button
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => handleOpenClaudeConfig()}
                  >
                    管理
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="日志">
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => handleViewLogs(record)}
                />
              </Tooltip>
              <Popconfirm
                title={`确认卸载 ${record.displayName}?`}
                description="卸载后需要重新安装才能使用"
                onConfirm={() => handleAction(record.id, 'uninstall')}
              >
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  loading={actionLoading === `${record.id}-uninstall`}
                />
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  const filteredSoftware = getFilteredSoftware();
  const stats = {
    total: softwareList.length,
    installed: softwareList.filter(s => s.installed).length,
    running: softwareList.filter(s => s.status === 'running').length
  };

  return (
    <div className="software-page">
      <div className="software-header">
        <Title level={2}>软件管理</Title>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={loadSoftwareList}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总软件数"
              value={stats.total}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已安装"
              value={stats.installed}
              suffix="个"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="运行中"
              value={stats.running}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="全部" key="all" />
          <TabPane tab="已安装" key="installed" />
          <TabPane tab="服务器" key="server" />
          <TabPane tab="数据库" key="database" />
          <TabPane tab="开发工具" key="development" />
          <TabPane tab="实用工具" key="utility" />
          <TabPane tab="系统工具" key="tool" />
          <TabPane tab="AI工具" key="ai" />
        </Tabs>

        <Alert
          message="提示"
          description="安装和卸载操作可能需要几分钟时间，请耐心等待。部分软件需要管理员权限才能启动或停止。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={filteredSoftware}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={`${selectedSoftware?.displayName} - 配置文件`}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Alert
          message="配置文件路径"
          description={selectedSoftware?.configPath}
          type="info"
          style={{ marginBottom: 16 }}
        />
        <TextArea
          value={configContent}
          onChange={(e) => setConfigContent(e.target.value)}
          rows={20}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>

      <Modal
        title={`${selectedSoftware?.displayName} - 日志`}
        open={logsModalVisible}
        onCancel={() => setLogsModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setLogsModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ maxHeight: 400, overflow: 'auto', backgroundColor: '#f5f5f5', padding: 16 }}>
          {logs.map((log, index) => (
            <div key={index} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>
              {log}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title={`安装 ${installSoftware?.displayName}`}
        open={installModalVisible}
        onCancel={() => setInstallModalVisible(false)}
        onOk={handleInstallWithVersion}
        confirmLoading={actionLoading === `${installSoftware?.id}-install`}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {installSoftware?.availableVersions && installSoftware.availableVersions.length > 0 && (
            <div>
              <Text strong>选择版本：</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={selectedVersion}
                onChange={setSelectedVersion}
              >
                {installSoftware.availableVersions.map((version) => (
                  <Option key={version} value={version}>
                    {version}
                  </Option>
                ))}
              </Select>
            </div>
          )}
          {installSoftware?.requiresPassword && (
            <div>
              <Text strong>数据库密码：</Text>
              <Input.Password
                style={{ marginTop: 8 }}
                value={databasePassword}
                onChange={(e) => setDatabasePassword(e.target.value)}
                placeholder="请输入数据库密码"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                提示：安装后请妥善保管密码
              </Text>
            </div>
          )}
        </Space>
      </Modal>

      {/* Claude Code 配置抽屉 */}
      <Drawer
        title={
          <Space>
            <RocketOutlined />
            <span>Claude Code 配置管理</span>
          </Space>
        }
        placement="right"
        width={600}
        open={claudeConfigDrawerVisible}
        onClose={() => setClaudeConfigDrawerVisible(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Yolo 快捷启动 */}
          <Card
            title="Yolo 快捷启动"
            extra={
              yoloEnabled ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  已启用
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="default">
                  未启用
                </Tag>
              )
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Text strong>功能说明</Text>
                <Paragraph type="secondary" style={{ marginTop: 8 }}>
                  为 Claude Code CLI 添加 <Text code>yolo</Text> 快捷命令，
                  等同于 <Text code>claude --dangerously-skip-permissions</Text>
                </Paragraph>
              </div>

              <Alert
                message="便捷体验"
                description="启用后可在终端直接使用 'yolo' 命令，跳过权限检查"
                type="info"
                showIcon
              />

              <Divider style={{ margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>快捷启动：</Text>
                <Switch
                  checked={yoloEnabled}
                  onChange={handleYoloToggle}
                  loading={yoloChecking}
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                />
              </div>

              {yoloEnabled && (
                <Alert
                  message="配置成功"
                  description='alias yolo="claude --dangerously-skip-permissions" 已添加到 ~/.zshrc'
                  type="success"
                  showIcon
                />
              )}
            </Space>
          </Card>

          {/* CLAUDE.md 创建 */}
          <Card title="CLAUDE.md 配置">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <Paragraph>
                  <Text strong>一键创建 CLAUDE.md 和 AI_MEMORY 结构</Text>
                </Paragraph>
                <Paragraph type="secondary">
                  自动创建项目记忆文件，让 Claude Code 记住项目上下文和工作规范
                </Paragraph>
              </div>

              <Alert
                message="自动记忆功能"
                description={
                  <div>
                    <div>• 启动时阅读 AI_MEMORY 全部文件</div>
                    <div>• 执行前自动备份（2小时间隔）</div>
                    <div>• 执行后更新认知、进度、日志</div>
                  </div>
                }
                type="info"
                showIcon
              />

              <div>
                <Text strong>项目路径：</Text>
                <Input
                  placeholder="/Users/www1/Desktop/project"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  onPressEnter={handleCreateClaudeMd}
                  disabled={creatingClaudeMd}
                  style={{ marginTop: 8 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  输入项目根目录路径，按 Enter 创建
                </Text>
              </div>

              <Button
                type="primary"
                icon={<FileMarkdownOutlined />}
                onClick={handleCreateClaudeMd}
                loading={creatingClaudeMd}
                block
              >
                创建 CLAUDE.md
              </Button>
            </Space>
          </Card>

          <Alert
            message="安全提示"
            description="Yolo 命令会跳过权限检查，仅在开发环境使用。生产环境请使用完整的 claude 命令。"
            type="warning"
            showIcon
          />
        </Space>
      </Drawer>
    </div>
  );
};

export default SoftwarePage;
