import { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Space,
  Tag,
  Button,
  Input,
  Select,
  DatePicker,
  Modal,
  Typography,
  Row,
  Col,
  Statistic,
  message
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  FileTextOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../config';
import './Logs.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  resource: string;
  details: string;
  ip: string;
  status: 'success' | 'failed';
  created_at: string;
}

interface LogStatistics {
  total: number;
  success: number;
  failed: number;
  uniqueUsers: number;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<LogStatistics>({
    total: 0,
    success: 0,
    failed: 0,
    uniqueUsers: 0
  });
  const [loading, setLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // 筛选条件
  const [filters, setFilters] = useState({
    username: '',
    action: '',
    resource: '',
    status: '',
    startDate: null as dayjs.Dayjs | null,
    endDate: null as dayjs.Dayjs | null,
    search: ''
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, [pagination.current, pagination.pageSize]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString()
      });

      // 添加筛选条件
      if (filters.username) params.append('username', filters.username);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE_URL}/api/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setPagination(prev => ({
          ...prev,
          total: data.total || 0
        }));
      } else {
        message.error('获取日志失败');
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      message.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/logs/statistics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  const handleViewDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  const getStatusTag = (status: string) => {
    const config = {
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' }
    };
    const { color, icon, text } = config[status as keyof typeof config] || {
      color: 'default',
      icon: null,
      text: status
    };
    return <Tag color={color} icon={icon}>{text}</Tag>;
  };

  const getActionTag = (action: string) => {
    const colorMap: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple'
    };
    return <Tag color={colorMap[action] || 'default'}>{action}</Tag>;
  };

  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => (
        <Text type="secondary">
          {dayjs(date).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
      sorter: true
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (username) => (
        <Space>
          <UserOutlined />
          <Text strong>{username}</Text>
        </Space>
      )
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'http_action',
      width: 80,
      className: 'log-http-action-column',
      render: (action) => getActionTag(action)
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      width: 200,
      ellipsis: true,
      render: (resource) => <Text code>{resource}</Text>
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
      render: (ip) => <Text type="secondary">{ip}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'detail_action',
      width: 100,
      fixed: 'right' as const,
      className: 'log-detail-action-column',
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div className="logs-page">
      <div className="logs-header">
        <h1><FileTextOutlined /> 操作日志</h1>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总日志数"
              value={statistics.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功操作"
              value={statistics.success}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败操作"
              value={statistics.failed}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={statistics.uniqueUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选条件 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索日志"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onPressEnter={fetchLogs}
            allowClear
          />
          <Input
            placeholder="用户名"
            style={{ width: 150 }}
            value={filters.username}
            onChange={(e) => setFilters({ ...filters, username: e.target.value })}
            allowClear
          />
          <Select
            placeholder="操作类型"
            style={{ width: 120 }}
            value={filters.action || undefined}
            onChange={(value) => setFilters({ ...filters, action: value || '' })}
            allowClear
          >
            <Select.Option value="GET">GET</Select.Option>
            <Select.Option value="POST">POST</Select.Option>
            <Select.Option value="PUT">PUT</Select.Option>
            <Select.Option value="DELETE">DELETE</Select.Option>
            <Select.Option value="PATCH">PATCH</Select.Option>
          </Select>
          <Select
            placeholder="资源路径"
            style={{ width: 150 }}
            value={filters.resource || undefined}
            onChange={(value) => setFilters({ ...filters, resource: value || '' })}
            allowClear
          >
            <Select.Option value="/api/files">文件管理</Select.Option>
            <Select.Option value="/api/websites">网站管理</Select.Option>
            <Select.Option value="/api/database">数据库管理</Select.Option>
            <Select.Option value="/api/system">系统管理</Select.Option>
            <Select.Option value="/api/tasks">任务管理</Select.Option>
            <Select.Option value="/api/terminal-logs">终端日志</Select.Option>
          </Select>
          <Select
            placeholder="状态"
            style={{ width: 100 }}
            value={filters.status || undefined}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
            allowClear
          >
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <RangePicker
            value={[filters.startDate, filters.endDate]}
            onChange={(dates) => setFilters({
              ...filters,
              startDate: dates ? dates[0] : null,
              endDate: dates ? dates[1] : null
            })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchLogs}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* 日志表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize }));
            }
          }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>

      {/* 详情Modal */}
      <Modal
        title="日志详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedLog && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>基本信息</Text>
                <Card size="small" style={{ marginTop: 8 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary">用户：</Text>
                      <Text>{selectedLog.username}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">操作：</Text>
                      {getActionTag(selectedLog.action)}
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">状态：</Text>
                      {getStatusTag(selectedLog.status)}
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={12}>
                      <Text type="secondary">时间：</Text>
                      <Text>{dayjs(selectedLog.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">IP地址：</Text>
                      <Text code>{selectedLog.ip}</Text>
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <Text type="secondary">资源：</Text>
                      <Text code>{selectedLog.resource}</Text>
                    </Col>
                  </Row>
                </Card>
              </div>

              <div>
                <Text strong>详细信息</Text>
                <Card size="small" style={{ marginTop: 8 }}>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      padding: '12px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    {selectedLog.details}
                  </pre>
                </Card>
              </div>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
