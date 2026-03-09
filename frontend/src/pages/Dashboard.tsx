import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Space, Progress, Tag, Modal, message, Badge } from 'antd';
import {
  FolderOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ChromeOutlined,
  CodeOutlined,
  LineChartOutlined,
  DesktopOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  MonitorOutlined,
  SafetyOutlined,
  ReloadOutlined,
  PoweroffOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

interface SystemInfo {
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    release: string;
  };
  cpu: {
    cores: number;
    speed: number;
    manufacturer?: string;
    brand?: string;
    family?: string;
  };
  memory: {
    total: number;
  };
}

interface SystemStats {
  cpu: number;
  memory: number;
  disk: number;
}

interface ServiceStatus {
  backend: { running: boolean; pid: string | null };
  frontend: { running: boolean; pid: string | null };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [servicesStatus, setServicesStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 获取API基础URL（支持开发和生产环境）
  const getApiBaseUrl = () => {
    // 优先使用环境变量
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }

    // 生产环境使用相对路径
    if (import.meta.env.PROD) {
      return window.location.origin;
    }

    // 开发环境默认使用localhost:3001
    return import.meta.env.VITE_API_URL;
  };

  useEffect(() => {
    fetchSystemInfo();
    fetchSystemStats();
    fetchServicesStatus();

    // 每秒更新时间
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // 每5秒更新系统状态
    const statsInterval = setInterval(() => {
      fetchSystemStats();
    }, 5000);

    // 每10秒更新服务状态
    const servicesInterval = setInterval(() => {
      fetchServicesStatus();
    }, 10000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(statsInterval);
      clearInterval(servicesInterval);
    };
  }, []);

  const fetchSystemInfo = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/system/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('=== System Info Debug ===');
        console.log('Full response:', data);
        console.log('System field:', data.system);
        console.log('CPU field:', data.cpu);
        console.log('Memory field:', data.memory);
        console.log('Uptime:', data.system?.uptime);
        console.log('========================');
        setSystemInfo(data);
        setLoading(false);
      } else {
        console.error('Failed to fetch system info:', response.status, response.statusText);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch system info:', error);
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/system/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // 转换数据格式以匹配前端期望
        setSystemStats({
          cpu: data.cpu.usage,
          memory: data.memory.usage,
          disk: data.disk.usage
        });
      }
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
    }
  };

  const fetchServicesStatus = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/system/services-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setServicesStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch services status:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days} 天 ${hours} 小时 ${minutes} 分钟`;
    } else if (hours > 0) {
      return `${hours} 小时 ${minutes} 分钟`;
    } else {
      return `${minutes} 分钟`;
    }
  };

  const getStatColor = (value: number, threshold: number = 80) => {
    if (value >= threshold) return '#ff4d4f';
    if (value >= threshold * 0.7) return '#faad14';
    return '#52c41a';
  };

  const handleRestartServices = async (services: string) => {
    Modal.confirm({
      title: '确认重启服务',
      content: `您确定要重启 ${services === 'all' ? '所有服务' : services} 吗？服务将在重启期间暂时不可用。`,
      okText: '确认重启',
      okType: 'danger',
      cancelText: '取消',
      icon: <ExclamationCircleOutlined />,
      onOk: async () => {
        setRestarting(true);
        try {
          const API_BASE_URL = getApiBaseUrl();
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/system/restart-services`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ services }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.errors && result.errors.length > 0) {
              message.warning(`部分服务重启成功，但有 ${result.errors.length} 个错误`);
            } else {
              message.success('服务重启成功！');
            }

            // 等待5秒后刷新状态
            setTimeout(() => {
              fetchServicesStatus();
            }, 5000);
          } else {
            message.error('重启服务失败');
          }
        } catch (error) {
          message.error('重启服务失败');
        } finally {
          setRestarting(false);
        }
      },
    });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="page-title">面板首页</h1>
        <div className="current-time">
          <ClockCircleOutlined />
          {currentTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })}
        </div>
      </div>

      {/* 系统状态卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="CPU 使用率"
              value={systemStats?.cpu || 0}
              suffix="%"
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: getStatColor(systemStats?.cpu || 0) }}
            />
            {systemStats && (
              <Progress
                percent={systemStats.cpu}
                strokeColor={getStatColor(systemStats.cpu)}
                showInfo={false}
                size="small"
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="内存使用率"
              value={systemStats?.memory || 0}
              suffix="%"
              prefix={<MonitorOutlined />}
              valueStyle={{ color: getStatColor(systemStats?.memory || 0) }}
            />
            {systemStats && (
              <Progress
                percent={systemStats.memory}
                strokeColor={getStatColor(systemStats.memory)}
                showInfo={false}
                size="small"
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="磁盘使用率"
              value={systemStats?.disk || 0}
              suffix="%"
              prefix={<FolderOutlined />}
              valueStyle={{ color: getStatColor(systemStats?.disk || 0) }}
            />
            {systemStats && (
              <Progress
                percent={systemStats.disk}
                strokeColor={getStatColor(systemStats.disk)}
                showInfo={false}
                size="small"
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="系统运行时间"
              value={systemInfo && systemInfo.system ? formatUptime(systemInfo.system.uptime).split(' ')[0] : 0}
              suffix={systemInfo && systemInfo.system ? formatUptime(systemInfo.system.uptime).split(' ').slice(1).join(' ') : ''}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: '20px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 系统信息和快捷操作 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DesktopOutlined />
                <span>系统信息</span>
                <Tag color="blue" icon={<SafetyOutlined />}>实时</Tag>
              </Space>
            }
            className="info-card"
            loading={loading}
          >
            <div className="info-list">
              {systemInfo && systemInfo.system && systemInfo.cpu && systemInfo.memory ? (
                <>
                  <div className="info-item">
                    <span className="info-label">主机名:</span>
                    <span className="info-value">{systemInfo.system.hostname || 'Unknown'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">操作系统:</span>
                    <span className="info-value">{systemInfo.system.platform || 'Unknown'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">架构:</span>
                    <span className="info-value">{systemInfo.system.arch || 'Unknown'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">CPU:</span>
                    <span className="info-value">
                      {(() => {
                        const cores = systemInfo.cpu?.cores || 'N/A';
                        let cpuName = 'Unknown CPU';
                        if (systemInfo.cpu?.manufacturer) {
                          cpuName = systemInfo.cpu.manufacturer;
                        } else if (systemInfo.cpu?.brand) {
                          cpuName = systemInfo.cpu.brand;
                        } else if (systemInfo.cpu?.family) {
                          cpuName = systemInfo.cpu.family;
                        }
                        return `${cpuName} (${cores} 核心)`;
                      })()}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">总内存:</span>
                    <span className="info-value">{formatBytes(systemInfo.memory.total || 0)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">运行时间:</span>
                    <span className="info-value">{formatUptime(systemInfo.system.uptime || 0)}</span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  加载系统信息中...
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ApiOutlined />
                <span>快捷操作</span>
              </Space>
            }
            className="info-card"
          >
            <div className="quick-actions">
              <div className="quick-action-item" onClick={() => navigate('/terminal')}>
                <CodeOutlined className="quick-action-icon" />
                <span className="quick-action-label">打开终端</span>
              </div>
              <div className="quick-action-item" onClick={() => navigate('/processes')}>
                <LineChartOutlined className="quick-action-icon" />
                <span className="quick-action-label">进程管理</span>
              </div>
              <div className="quick-action-item" onClick={() => navigate('/browser')}>
                <ChromeOutlined className="quick-action-icon" />
                <span className="quick-action-label">浏览器管理</span>
              </div>
              <div className="quick-action-item" onClick={() => navigate('/database-admin')}>
                <DatabaseOutlined className="quick-action-icon" />
                <span className="quick-action-label">数据库管理</span>
              </div>
              <div className="quick-action-item" onClick={() => navigate('/files')}>
                <FolderOutlined className="quick-action-icon" />
                <span className="quick-action-label">文件管理</span>
              </div>
              <div className="quick-action-item" onClick={() => navigate('/websites')}>
                <GlobalOutlined className="quick-action-icon" />
                <span className="quick-action-label">网站管理</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 服务管理 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <PoweroffOutlined />
                <span>服务管理</span>
                <Tag color={servicesStatus?.backend.running && servicesStatus?.frontend.running ? 'success' : 'warning'}>
                  {servicesStatus?.backend.running && servicesStatus?.frontend.running ? '运行正常' : '部分服务异常'}
                </Tag>
              </Space>
            }
            extra={
              <Space>
                <Badge status={servicesStatus?.backend.running ? 'success' : 'error'} text="后端" />
                <Badge status={servicesStatus?.frontend.running ? 'success' : 'error'} text="前端" />
              </Space>
            }
            className="services-card"
          >
            <div className="services-actions">
              <div
                className="service-action-item restart-all"
                onClick={() => !restarting && handleRestartServices('all')}
                style={{ opacity: restarting ? 0.5 : 1, cursor: restarting ? 'not-allowed' : 'pointer' }}
              >
                <ReloadOutlined className="service-action-icon" spin={restarting} />
                <span className="service-action-label">
                  {restarting ? '重启中...' : '重启所有服务'}
                </span>
              </div>
              <div
                className="service-action-item restart-backend"
                onClick={() => !restarting && handleRestartServices('backend')}
                style={{ opacity: restarting ? 0.5 : 1, cursor: restarting ? 'not-allowed' : 'pointer' }}
              >
                <CloudServerOutlined className="service-action-icon" />
                <span className="service-action-label">重启后端</span>
                <Badge status={servicesStatus?.backend.running ? 'success' : 'error'} />
              </div>
              <div
                className="service-action-item restart-frontend"
                onClick={() => !restarting && handleRestartServices('frontend')}
                style={{ opacity: restarting ? 0.5 : 1, cursor: restarting ? 'not-allowed' : 'pointer' }}
              >
                <DesktopOutlined className="service-action-icon" />
                <span className="service-action-label">重启前端</span>
                <Badge status={servicesStatus?.frontend.running ? 'success' : 'error'} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
