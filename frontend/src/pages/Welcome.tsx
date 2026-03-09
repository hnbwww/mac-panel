import React, { useState, useEffect } from 'react';
import { Card, Steps, Button, Typography, Space, Divider, Progress, Alert, Tag } from 'antd';
import {
  RocketOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  FileOutlined,
  SettingOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Paragraph, Text } = Typography;

interface WelcomeWizardProps {
  onComplete: () => void;
}

const WelcomeWizard: React.FC<WelcomeWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [systemCheck, setSystemCheck] = useState({
    backend: false,
    frontend: false,
    nginx: false,
    database: false,
  });
  const [checkProgress, setCheckProgress] = useState(0);

  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');

  // 系统检查
  const performSystemCheck = async () => {
    setLoading(true);
    setCheckProgress(0);

    const checks = [
      { key: 'backend', url: `${API_BASE_URL}/api/system/info` },
      { key: 'frontend', url: `${API_BASE_URL}/api/system/info` },
      { key: 'nginx', url: `${API_BASE_URL}/api/nginx/status` },
      { key: 'database', url: `${API_BASE_URL}/api/databases/connections` },
    ];

    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];
      try {
        const response = await axios.get(check.url, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        });
        setSystemCheck((prev) => ({ ...prev, [check.key]: response.status === 200 }));
      } catch (error) {
        setSystemCheck((prev) => ({ ...prev, [check.key]: false }));
      }
      setCheckProgress(((i + 1) / checks.length) * 100);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setLoading(false);
  };

  useEffect(() => {
    if (currentStep === 2) {
      performSystemCheck();
    }
  }, [currentStep]);

  const steps = [
    {
      title: '欢迎使用',
      content: (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <RocketOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 24 }} />
          <Title level={2}>欢迎来到 Mac Panel</Title>
          <Paragraph style={{ fontSize: 16, color: '#666', maxWidth: 600, margin: '0 auto' }}>
            Mac Panel 是一个功能强大的服务器管理系统，让您轻松管理 Mac 服务器。
            <br />
            本向导将帮助您快速了解系统功能并进行初始配置。
          </Paragraph>
          <Divider />
          <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
            <Title level={4}>✨ 主要功能</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>📁 <strong>文件管理</strong> - 浏览、编辑、上传文件</Text>
              <Text>🖥️ <strong>系统监控</strong> - CPU、内存、磁盘实时监控</Text>
              <Text>🌐 <strong>网站管理</strong> - Nginx 配置、SSL 证书</Text>
              <Text>🗄️ <strong>数据库管理</strong> - MySQL、PostgreSQL、MongoDB</Text>
              <Text>⚙️ <strong>软件管理</strong> - 一键安装常用软件</Text>
              <Text>👥 <strong>用户管理</strong> - 权限控制和用户管理</Text>
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: '安全建议',
      content: (
        <div style={{ padding: '40px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <SafetyOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
            <Title level={2}>保护您的服务器</Title>
            <Paragraph style={{ fontSize: 16, color: '#666' }}>
              在开始使用之前，请务必完成以下安全配置
            </Paragraph>
          </div>

          <Space direction="vertical" style={{ width: '100%', maxWidth: 800, margin: '0 auto' }} size="large">
            <Card>
              <Space>
                <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    修改默认密码
                  </Title>
                  <Text type="secondary">
                    当前使用默认密码 admin/admin123，请立即修改
                  </Text>
                </div>
              </Space>
              <Button type="primary" onClick={() => navigate('/profile')} style={{ marginTop: 16 }}>
                立即修改
              </Button>
            </Card>

            <Card>
              <Space>
                <SettingOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    配置防火墙
                  </Title>
                  <Text type="secondary">
                    仅开放必要的端口（3001, 5173），避免暴露所有端口
                  </Text>
                </div>
              </Space>
            </Card>

            <Card>
              <Space>
                <DashboardOutlined style={{ fontSize: 24, color: '#faad14' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    定期备份
                  </Title>
                  <Text type="secondary">
                    设置定期自动备份，保护重要数据
                  </Text>
                </div>
              </Space>
            </Card>

            <Card>
              <Space>
                <FileOutlined style={{ fontSize: 24, color: '#722ed1' }} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    更新系统
                  </Title>
                  <Text type="secondary">
                    定期更新系统和软件包，修复安全漏洞
                  </Text>
                </div>
              </Space>
            </Card>
          </Space>
        </div>
      ),
    },
    {
      title: '系统检查',
      content: (
        <div style={{ padding: '40px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <ThunderboltOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 24 }} />
            <Title level={2}>系统健康检查</Title>
            <Paragraph style={{ fontSize: 16, color: '#666' }}>
              正在检查各项服务状态...
            </Paragraph>
          </div>

          {loading && (
            <div style={{ maxWidth: 600, margin: '0 auto 32px' }}>
              <Progress percent={Math.round(checkProgress)} status="active" />
              <Text type="secondary">正在检查服务状态...</Text>
            </div>
          )}

          <Space direction="vertical" style={{ width: '100%', maxWidth: 800, margin: '0 auto' }} size="middle">
            <Card>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <DashboardOutlined style={{ fontSize: 20 }} />
                  <Text strong>后端服务</Text>
                </Space>
                {systemCheck.backend ? (
                  <Tag color="success" icon={<CheckOutlined />}>
                    运行中
                  </Tag>
                ) : (
                  <Tag color="error">未运行</Tag>
                )}
              </Space>
            </Card>

            <Card>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <FileOutlined style={{ fontSize: 20 }} />
                  <Text strong>前端服务</Text>
                </Space>
                {systemCheck.frontend ? (
                  <Tag color="success" icon={<CheckOutlined />}>
                    运行中
                  </Tag>
                ) : (
                  <Tag color="error">未运行</Tag>
                )}
              </Space>
            </Card>

            <Card>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <SettingOutlined style={{ fontSize: 20 }} />
                  <Text strong>Nginx 服务</Text>
                </Space>
                {systemCheck.nginx ? (
                  <Tag color="success" icon={<CheckOutlined />}>
                    运行中
                  </Tag>
                ) : (
                  <Tag color="warning">未安装</Tag>
                )}
              </Space>
            </Card>

            <Card>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <FileOutlined style={{ fontSize: 20 }} />
                  <Text strong>数据库服务</Text>
                </Space>
                {systemCheck.database ? (
                  <Tag color="success" icon={<CheckOutlined />}>
                    可用
                  </Tag>
                ) : (
                  <Tag color="warning">未配置</Tag>
                )}
              </Space>
            </Card>
          </Space>

          {!loading && (
            <Alert
              message={
                systemCheck.backend && systemCheck.frontend
                  ? '✅ 系统状态良好，所有核心服务运行正常'
                  : '⚠️ 部分服务未运行，请检查服务状态'
              }
              type={systemCheck.backend && systemCheck.frontend ? 'success' : 'warning'}
              showIcon
              style={{ marginTop: 24, maxWidth: 800, margin: '24px auto 0' }}
            />
          )}
        </div>
      ),
    },
    {
      title: '快速开始',
      content: (
        <div style={{ padding: '40px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
            <Title level={2}>准备就绪！</Title>
            <Paragraph style={{ fontSize: 16, color: '#666' }}>
              您已成功完成初始配置，现在可以开始使用 Mac Panel 了
            </Paragraph>
          </div>

          <Space direction="vertical" style={{ width: '100%', maxWidth: 800, margin: '0 auto' }} size="large">
            <Card title="📚 推荐阅读" hoverable onClick={() => navigate('/files')}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• 查看 <Text strong>安装文档</Text> 了解详细功能</Text>
                <Text>• 阅读 <Text strong>故障排查指南</Text> 解决常见问题</Text>
                <Text>• 了解 <Text strong>网络配置</Text> 设置公网访问</Text>
              </Space>
            </Card>

            <Card title="🚀 常用操作" hoverable onClick={() => navigate('/dashboard')}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>• <strong>文件管理</strong> - 浏览和编辑服务器文件</Text>
                <Text>• <strong>网站管理</strong> - 创建和管理网站</Text>
                <Text>• <strong>系统监控</strong> - 查看系统资源使用情况</Text>
                <Text>• <strong>软件管理</strong> - 安装常用软件</Text>
              </Space>
            </Card>

            <Card title="⌨️ 命令行工具" hoverable>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text code>mac-panel start</Text>
                <Text type="secondary">启动所有服务</Text>
                <Divider style={{ margin: '8px 0' }} />
                <Text code>mac-panel stop</Text>
                <Text type="secondary">停止所有服务</Text>
                <Divider style={{ margin: '8px 0' }} />
                <Text code>mac-panel status</Text>
                <Text type="secondary">查看服务状态</Text>
                <Divider style={{ margin: '8px 0' }} />
                <Text code>mac-panel logs</Text>
                <Text type="secondary">查看后端日志</Text>
              </Space>
            </Card>
          </Space>
        </div>
      ),
    },
  ];

  const next = () => {
    setCurrentStep(currentStep + 1);
  };

  const prev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleComplete = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/users/welcome-completed`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      onComplete();
      navigate('/dashboard');
    } catch (error) {
      console.error('标记完成状态失败:', error);
      // 即使API失败也继续
      onComplete();
      navigate('/dashboard');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '24px' }}>
      <Card style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Steps
          current={currentStep}
          style={{ marginBottom: 32 }}
          items={steps.map((step, index) => ({ title: step.title, key: index }))}
        />

        <div>{steps[currentStep].content}</div>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={prev} disabled={currentStep === 0}>
            上一步
          </Button>
          <Space>
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={next} loading={loading}>
                下一步
                {currentStep < steps.length - 1 && <ArrowRightOutlined />}
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button type="primary" onClick={handleComplete} icon={<CheckCircleOutlined />}>
                开始使用
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default WelcomeWizard;
