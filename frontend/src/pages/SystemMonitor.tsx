import { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Radio, Space } from 'antd';
import {
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import './SystemMonitor.css';

interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
    partitions: Array<{
      mount: string;
      size: number;
      used: number;
      free: number;
      usage: number;
    }>;
  };
  network: {
    rx: number;
    tx: number;
    interfaces: Array<{
      name: string;
      rx: number;
      tx: number;
    }>;
  };
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    release: string;
  };
}

export default function SystemMonitor() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [networkRxHistory, setNetworkRxHistory] = useState<number[]>([]);
  const [networkTxHistory, setNetworkTxHistory] = useState<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [timeRange, setTimeRange] = useState<'60s' | '1h' | '8h' | '24h' | '1w'>('60s');
  const sampleCounterRef = useRef(0);

  // 时间范围配置（数据点数量和采样间隔）
  const timeRangeConfig = {
    '60s': { points: 60, interval: 1, label: '最近 60 秒' },     // 每1秒采样
    '1h': { points: 60, interval: 60, label: '最近 1 小时' },    // 每60秒（1分钟）采样
    '8h': { points: 96, interval: 300, label: '最近 8 小时' },   // 每300秒（5分钟）采样
    '24h': { points: 144, interval: 600, label: '最近 24 小时' }, // 每600秒（10分钟）采样
    '1w': { points: 168, interval: 3600, label: '最近 1 周' }    // 每3600秒（1小时）采样
  };

  useEffect(() => {
    // 获取初始数据
    fetchStats();

    // 建立 WebSocket 连接
    const token = localStorage.getItem('token');
    const WS_BASE_URL = import.meta.env.VITE_WS_URL;
    const ws = new WebSocket(`${WS_BASE_URL}/ws/system-stats?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'system-stats') {
        updateStats(message.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchStats = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/system/summary`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const updateStats = (newStats: SystemStats) => {
    setStats(newStats);

    // 增加采样计数器
    sampleCounterRef.current += 1;

    const config = timeRangeConfig[timeRange];

    // 根据采样间隔决定是否保存数据
    // WebSocket每秒推送一次数据，interval=1表示每次都保存，interval=60表示每60次保存一次
    if (sampleCounterRef.current % config.interval === 0) {
      const points = config.points;
      setCpuHistory(prev => [...prev.slice(-(points - 1)), newStats.cpu.usage]);
      setMemoryHistory(prev => [...prev.slice(-(points - 1)), newStats.memory.usage]);
      setNetworkRxHistory(prev => [...prev.slice(-(points - 1)), newStats.network.rx]);
      setNetworkTxHistory(prev => [...prev.slice(-(points - 1)), newStats.network.tx]);
    }
  };

  // 当时间范围改变时，清空历史数据并重置计数器
  const handleTimeRangeChange = (newTimeRange: '60s' | '1h' | '8h' | '24h' | '1w') => {
    setTimeRange(newTimeRange);
    setCpuHistory([]);
    setMemoryHistory([]);
    setNetworkRxHistory([]);
    setNetworkTxHistory([]);
    sampleCounterRef.current = 0;
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
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };

  // CPU 图表数据
  const cpuData = cpuHistory.map((value, index) => ({
    time: index,
    value: value.toFixed(2)
  }));

  // 内存图表数据
  const memoryData = memoryHistory.map((value, index) => ({
    time: index,
    value: value.toFixed(2)
  }));

  // 网络图表数据
  const networkData = networkRxHistory.map((rx, index) => ({
    time: index,
    上传: networkTxHistory[index] || 0,
    下载: rx
  }));

  // 磁盘分区数据
  const diskData = stats?.disk.partitions.map(partition => ({
    type: partition.mount,
    value: partition.usage,
  })) || [];

  if (!stats) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="system-monitor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>系统监控</h1>
        <Space>
          <span>时间范围：</span>
          <Radio.Group value={timeRange} onChange={(e) => handleTimeRangeChange(e.target.value)} buttonStyle="solid">
            <Radio.Button value="60s">60秒</Radio.Button>
            <Radio.Button value="1h">1小时</Radio.Button>
            <Radio.Button value="8h">8小时</Radio.Button>
            <Radio.Button value="24h">24小时</Radio.Button>
            <Radio.Button value="1w">1周</Radio.Button>
          </Radio.Group>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* CPU 卡片 */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="CPU 使用率"
              value={stats.cpu.usage.toFixed(1)}
              suffix="%"
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: stats.cpu.usage > 80 ? '#ff4d4f' : '#1890ff' }}
            />
            <div className="stat-details">
              <p>核心数: {stats.cpu.cores}</p>
              <p>负载: {stats.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}</p>
            </div>
          </Card>
        </Col>

        {/* 内存卡片 */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="内存使用率"
              value={stats.memory.usage.toFixed(1)}
              suffix="%"
              prefix={<DashboardOutlined />}
              valueStyle={{ color: stats.memory.usage > 80 ? '#ff4d4f' : '#52c41a' }}
            />
            <div className="stat-details">
              <p>已用: {formatBytes(stats.memory.used)}</p>
              <p>总计: {formatBytes(stats.memory.total)}</p>
            </div>
          </Card>
        </Col>

        {/* 磁盘卡片 */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="磁盘使用率"
              value={stats.disk.usage.toFixed(1)}
              suffix="%"
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: stats.disk.usage > 90 ? '#ff4d4f' : '#faad14' }}
            />
            <div className="stat-details">
              <p>已用: {formatBytes(stats.disk.used)}</p>
              <p>总计: {formatBytes(stats.disk.total)}</p>
            </div>
          </Card>
        </Col>

        {/* 系统信息卡片 */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="运行时间"
              value={formatUptime(stats.system.uptime)}
              prefix={<ClockCircleOutlined />}
            />
            <div className="stat-details">
              <p>主机名: {stats.system.hostname}</p>
              <p>系统: {stats.system.platform}</p>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* CPU 历史图表 */}
        <Col xs={24} lg={12}>
          <Card title={`CPU 使用率趋势（${timeRangeConfig[timeRange].label}）`}>
            <Line
              data={cpuData}
              xField="time"
              yField="value"
              height={200}
              smooth
              animation={false}
              xAxis={false}
              yAxis={{ max: 100 }}
              seriesField={{ legend: false }}
            />
          </Card>
        </Col>

        {/* 内存历史图表 */}
        <Col xs={24} lg={12}>
          <Card title={`内存使用率趋势（${timeRangeConfig[timeRange].label}）`}>
            <Line
              data={memoryData}
              xField="time"
              yField="value"
              height={200}
              smooth
              animation={false}
              xAxis={false}
              yAxis={{ max: 100 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* 网络流量图表 */}
        <Col xs={24} lg={16}>
          <Card title={`网络流量（${timeRangeConfig[timeRange].label}）`}>
            <Line
              data={networkData}
              xField="time"
              yField="上传"
              height={200}
              smooth
              animation={false}
              xAxis={false}
              seriesField={{ legend: true }}
            />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <span style={{ marginRight: 24 }}>
                上传: {formatBytes(stats.network.tx)}/s
              </span>
              <span>
                下载: {formatBytes(stats.network.rx)}/s
              </span>
            </div>
          </Card>
        </Col>

        {/* 磁盘分布 */}
        <Col xs={24} lg={8}>
          <Card title="磁盘分区">
            <Pie
              data={diskData}
              angleField="value"
              colorField="type"
              radius={0.8}
              innerRadius={0.6}
              label={{
                type: 'inner',
                offset: '-50%',
                content: '{value}%',
                style: { fontSize: 14, textAlign: 'center' },
              }}
              height={250}
              legend={{ position: 'bottom' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 磁盘分区详情 */}
        <Col xs={24}>
          <Card title="磁盘分区详情">
            <Table
              dataSource={stats.disk.partitions}
              rowKey="mount"
              pagination={false}
              size="small"
              columns={[
                {
                  title: '挂载点',
                  dataIndex: 'mount',
                  key: 'mount'
                },
                {
                  title: '总容量',
                  dataIndex: 'size',
                  key: 'size',
                  render: (size) => formatBytes(size)
                },
                {
                  title: '已用',
                  dataIndex: 'used',
                  key: 'used',
                  render: (used) => formatBytes(used)
                },
                {
                  title: '使用率',
                  dataIndex: 'usage',
                  key: 'usage',
                  render: (usage) => (
                    <Progress
                      percent={parseFloat(usage.toFixed(1))}
                      size="small"
                      status={usage > 90 ? 'exception' : usage > 70 ? 'active' : 'success'}
                    />
                  )
                }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
