import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Space,
  message,
  Modal,
  Typography,
  Statistic,
  Alert,
  Descriptions,
  Input,
  Switch,
} from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ApiOutlined,
  GlobalOutlined,
  SafetyOutlined,
  EditOutlined,
  EyeOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface NginxStatus {
  installed: boolean;
  version: string;
  running: boolean;
  pid?: number;
}

interface NginxSites {
  enabled: string[];
  available: string[];
  sites: Array<{
    id: string;
    domain: string;
    type: string;
    rootDir: string;
    port: number;
    ssl: boolean;
    enabled: boolean;
    hasConfig: boolean;
    createdAt: string;
  }>;
}

interface TestResult {
  success: boolean;
  output?: string;
  error?: string;
}

const NginxManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<NginxStatus | null>(null);
  const [sites, setSites] = useState<NginxSites | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [configContent, setConfigContent] = useState('');
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  // 获取 Nginx 状态
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/nginx/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setStatus(data);
    } catch (error: any) {
      message.error('获取 Nginx 状态失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取站点列表
  const fetchSites = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/nginx/sites`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setSites(data);
    } catch (error: any) {
      message.error('获取站点列表失败: ' + error.message);
    }
  };

  // 测试配置
  const testConfig = async () => {
    try {
      setActionLoading('test');
      const response = await fetch(`${API_BASE_URL}/api/nginx/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setTestResult(data);
      if (data.success) {
        message.success('配置测试通过');
      } else {
        message.error('配置测试失败: ' + data.error);
      }
    } catch (error: any) {
      message.error('配置测试失败: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 启动 Nginx
  const startNginx = async () => {
    Modal.confirm({
      title: '确认启动 Nginx',
      icon: <ExclamationCircleOutlined />,
      content: '确定要启动 Nginx 服务吗？',
      onOk: async () => {
        try {
          setActionLoading('start');
          const response = await fetch(`${API_BASE_URL}/api/nginx/start`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (data.success) {
            message.success(data.message || 'Nginx 已启动');
            await fetchStatus();
          } else {
            message.error(data.error || '启动失败');
          }
        } catch (error: any) {
          message.error('启动失败: ' + error.message);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  // 停止 Nginx
  const stopNginx = async () => {
    Modal.confirm({
      title: '确认停止 Nginx',
      icon: <ExclamationCircleOutlined />,
      content: '确定要停止 Nginx 服务吗？这将影响所有网站的访问。',
      okText: '确定停止',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setActionLoading('stop');
          const response = await fetch(`${API_BASE_URL}/api/nginx/stop`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (data.success) {
            message.success(data.message || 'Nginx 已停止');
            await fetchStatus();
          } else {
            message.error(data.error || '停止失败');
          }
        } catch (error: any) {
          message.error('停止失败: ' + error.message);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  // 重启 Nginx
  const restartNginx = async () => {
    Modal.confirm({
      title: '确认重启 Nginx',
      icon: <ExclamationCircleOutlined />,
      content: '确定要重启 Nginx 服务吗？这将短暂中断所有网站的访问。',
      onOk: async () => {
        try {
          setActionLoading('restart');
          const response = await fetch(`${API_BASE_URL}/api/nginx/restart`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (data.success) {
            message.success(data.message || 'Nginx 已重启');
            await fetchStatus();
          } else {
            message.error(data.error || '重启失败');
          }
        } catch (error: any) {
          message.error('重启失败: ' + error.message);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  // 重新加载配置
  const reloadNginx = async () => {
    try {
      setActionLoading('reload');
      const response = await fetch(`${API_BASE_URL}/api/nginx/reload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data.success) {
        message.success(data.message || 'Nginx 配置已重新加载');
        await fetchStatus();
      } else {
        message.error(data.error || '重新加载失败');
      }
    } catch (error: any) {
      message.error('重新加载失败: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 刷新所有数据
  const refreshAll = async () => {
    await Promise.all([fetchStatus(), fetchSites()]);
  };

  // 查看网站配置
  const handleViewConfig = async (domain: string) => {
    try {
      setCurrentDomain(domain);
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
      const response = await fetch(`${API_BASE_URL}/api/nginx/sites/${currentDomain}/config`, {
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
        refreshAll();
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
          const response = await fetch(`${API_BASE_URL}/api/nginx/sites/${currentDomain}/reset-config`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            message.success('已恢复默认配置');
            setConfigModalVisible(false);
            refreshAll();
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
      setActionLoading(`toggle-${domain}`);
      const response = await fetch(`${API_BASE_URL}/api/nginx/sites/${domain}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        message.success(`网站${actionText}成功`);
        await fetchSites();
      } else {
        const error = await response.json();
        message.error(`${actionText}失败: ${error.error}`);
      }
    } catch (error: any) {
      message.error(`${actionText}失败`);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    refreshAll();
    // 每 5 秒刷新一次状态
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // 站点表格列
  const siteColumns: ColumnsType<any> = [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain: string) => (
        <Space>
          <GlobalOutlined />
          <Text code>{domain}</Text>
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
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      render: (port: number) => <Text>{port}</Text>,
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
      title: '配置状态',
      dataIndex: 'hasConfig',
      key: 'hasConfig',
      render: (hasConfig: boolean, record: any) => {
        if (!hasConfig) {
          return <Tag color="red">未配置</Tag>;
        }
        return record.enabled ? (
          <Tag icon={<CheckCircleOutlined />} color="green">
            已启用
          </Tag>
        ) : (
          <Tag color="orange">已配置未启用</Tag>
        );
      },
    },
    {
      title: '根目录',
      dataIndex: 'rootDir',
      key: 'rootDir',
      ellipsis: true,
      render: (rootDir: string) => <Text style={{ fontSize: '12px' }}>{rootDir}</Text>,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      responsive: ['md', 'lg', 'xl', 'xxl'],
      render: (enabled: boolean, record: any) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleSite(record.domain, checked)}
          checkedChildren="启用"
          unCheckedChildren="停用"
          loading={actionLoading === `toggle-${record.domain}`}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      responsive: ['md', 'lg', 'xl', 'xxl'],
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewConfig(record.domain)}
        >
          查看配置
        </Button>
      ),
    },
  ];

  // 生成站点数据
  const siteData = React.useMemo(() => {
    if (!sites?.sites) return [];
    return sites.sites.map(site => ({
      key: site.id,
      ...site,
    }));
  }, [sites]);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <ApiOutlined /> Nginx 管理
        </Title>
        <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={loading}>
          刷新
        </Button>
      </div>

      {!status?.installed && (
        <Alert
          message="Nginx 未安装"
          description="系统中未检测到 Nginx，请先安装 Nginx 服务。"
          type="warning"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      {status?.installed && (
        <Alert
          message="启用自动配置"
          description={
            <div>
              <div>为了让 Mac Panel 能够自动管理 Nginx 配置，需要设置相关权限。</div>
              <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                请在终端执行以下命令：
              </div>
              <div style={{ marginTop: '8px', background: '#f5f5f5', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                cd /Users/www1/Desktop/claude/mac-panel && sudo ./setup-nginx-auto.sh
              </div>
              <div style={{ marginTop: '8px' }}>
                <SafetyOutlined /> 配置完成后，面板将能够：
              </div>
              <ul style={{ marginTop: '4px', marginLeft: '20px' }}>
                <li>✓ 自动生成网站配置</li>
                <li>✓ 自动测试配置语法</li>
                <li>✓ 自动重新加载 Nginx</li>
                <li>✓ 支持自定义端口号</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* 状态卡片 */}
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="运行状态"
              value={status?.running ? '运行中' : '已停止'}
              prefix={status?.running ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: status?.running ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="版本"
              value={status?.version || 'Unknown'}
              prefix={<SettingOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="进程 ID"
              value={status?.pid || '-'}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="站点数量"
              value={sites?.enabled.length || 0}
              suffix={`/ ${sites?.available.length || 0}`}
            />
          </Card>
        </Col>
      </Row>

      {/* 控制按钮 */}
      <Card title="服务控制" style={{ marginTop: '16px' }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={startNginx}
            loading={actionLoading === 'start'}
            disabled={!status?.installed || status?.running}
          >
            启动
          </Button>
          <Button
            danger
            icon={<StopOutlined />}
            onClick={stopNginx}
            loading={actionLoading === 'stop'}
            disabled={!status?.installed || !status?.running}
          >
            停止
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={restartNginx}
            loading={actionLoading === 'restart'}
            disabled={!status?.installed}
          >
            重启
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={reloadNginx}
            loading={actionLoading === 'reload'}
            disabled={!status?.installed || !status?.running}
          >
            重新加载配置
          </Button>
          <Button
            icon={<CheckCircleOutlined />}
            onClick={testConfig}
            loading={actionLoading === 'test'}
            disabled={!status?.installed}
          >
            测试配置
          </Button>
        </Space>

        {testResult && (
          <Alert
            message={testResult.success ? '配置测试通过' : '配置测试失败'}
            description={testResult.output || testResult.error}
            type={testResult.success ? 'success' : 'error'}
            style={{ marginTop: '16px' }}
            closable
            onClose={() => setTestResult(null)}
          />
        )}
      </Card>

      {/* 站点列表 */}
      <Card title="站点列表" style={{ marginTop: '16px' }}>
        <Table
          columns={siteColumns}
          dataSource={siteData}
          loading={loading}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 使用说明 */}
      <Card title="使用说明" style={{ marginTop: '16px' }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="启动">
            启动 Nginx 服务，使所有网站可以访问
          </Descriptions.Item>
          <Descriptions.Item label="停止">
            停止 Nginx 服务，所有网站将无法访问
          </Descriptions.Item>
          <Descriptions.Item label="重启">
            完全重启 Nginx 服务，会短暂中断服务
          </Descriptions.Item>
          <Descriptions.Item label="重新加载配置">
            平滑重载配置文件，不会中断服务（推荐）
          </Descriptions.Item>
          <Descriptions.Item label="测试配置">
            检查配置文件语法是否正确，不实际加载
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 配置编辑模态框 */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>{isEditingConfig ? '编辑' : '查看'} Nginx 配置 - {currentDomain}</span>
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
              <Button key="reset" onClick={handleResetConfig} icon={<UndoOutlined />}>
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
};

export default NginxManagement;
