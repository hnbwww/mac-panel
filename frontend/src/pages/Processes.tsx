import { useState, useEffect } from 'react';
import { Table, Button, Input, Card, Tag, Space, Popconfirm, message, Select, Row, Col, Statistic } from 'antd';
import { ReloadOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import './Processes.css';

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  user: string;
  status: string;
  command: string;
  ports?: number[];  // 监听的端口列表
  fullCommand?: string;  // 完整命令行
}

interface ProcessResponse {
  processes: ProcessInfo[];
  total: number;
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | undefined>();
  const [killedProcesses, setKilledProcesses] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 5000); // 每5秒刷新
    return () => clearInterval(interval);
  }, [sortBy]);

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const url = sortBy
        ? `${API_BASE_URL}/api/system/processes?limit=100&sort=${sortBy}`
        : `${API_BASE_URL}/api/system/processes?limit=100`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data: ProcessResponse = await response.json();
      setProcesses(data.processes);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch processes:', error);
      message.error('获取进程列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKillProcess = async (pid: number, name: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/system/processes/${pid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        message.success(`进程 ${name} (PID: ${pid}) 已终止`);
        setKilledProcesses(prev => new Set([...prev, pid]));
        fetchProcesses();
      } else {
        const error = await response.json();
        message.error(error.error || '终止进程失败');
      }
    } catch (error) {
      console.error('Failed to kill process:', error);
      message.error('终止进程失败');
    }
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getCpuColor = (usage: number) => {
    if (usage > 80) return '#ff4d4f';
    if (usage > 50) return '#faad14';
    return '#52c41a';
  };

  const getMemoryColor = (usage: number) => {
    if (usage > 80) return '#ff4d4f';
    if (usage > 50) return '#faad14';
    return '#1890ff';
  };

  const getStatusTag = (status: string) => {
    const colorMap: Record<string, string> = {
      'running': 'green',
      'sleeping': 'blue',
      'stopped': 'red',
      'zombie': 'orange',
      'idle': 'default'
    };
    return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
  };

  const columns: ColumnsType<ProcessInfo> = [
    {
      title: 'PID',
      dataIndex: 'pid',
      key: 'pid',
      width: 100,
      sorter: (a, b) => a.pid - b.pid
    },
    {
      title: '进程名',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value: string, record: ProcessInfo): boolean =>
        record.name.toLowerCase().includes((value as string).toLowerCase()) ||
        record.command.toLowerCase().includes((value as string).toLowerCase()) ||
        (record.fullCommand && record.fullCommand.toLowerCase().includes((value as string).toLowerCase())),
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.command}</div>
        </div>
      )
    },
    {
      title: '端口',
      dataIndex: 'ports',
      key: 'ports',
      width: 100,
      render: (ports) => {
        if (!ports || ports.length === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        return (
          <Space size={4}>
            {ports.map((port: string) => (
              <Tag key={port} color="blue">{port}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: '完整路径',
      dataIndex: 'fullCommand',
      key: 'fullCommand',
      width: 300,
      ellipsis: true,
      render: (fullCommand, record) => (
        <div style={{ fontSize: 12, fontFamily: 'monospace' }} title={fullCommand || record.command}>
          {fullCommand || record.command}
        </div>
      )
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 120
    },
    {
      title: 'CPU',
      dataIndex: 'cpu',
      key: 'cpu',
      width: 120,
      sorter: (a, b) => a.cpu - b.cpu,
      render: (cpu) => (
        <span style={{ color: getCpuColor(cpu), fontWeight: 500 }}>
          {formatPercent(cpu)}
        </span>
      )
    },
    {
      title: '内存',
      dataIndex: 'memory',
      key: 'memory',
      width: 120,
      sorter: (a, b) => a.memory - b.memory,
      render: (memory) => (
        <span style={{ color: getMemoryColor(memory), fontWeight: 500 }}>
          {formatPercent(memory)}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确定要终止此进程吗？"
          description={`进程 ${record.name} (PID: ${record.pid})`}
          onConfirm={() => handleKillProcess(record.pid, record.name)}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={killedProcesses.has(record.pid)}
          >
            终止
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <div className="processes-page">
      <h1 className="page-title">进程管理</h1>

      <Card className="process-summary">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="总进程数" value={total} />
          </Col>
          <Col span={6}>
            <Statistic
              title="显示进程"
              value={processes.length}
              suffix={`/ ${total}`}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="高 CPU 进程"
              value={processes.filter(p => p.cpu > 50).length}
              valueStyle={{ color: processes.filter(p => p.cpu > 50).length > 0 ? '#ff4d4f' : undefined }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="高内存进程"
              value={processes.filter(p => p.memory > 50).length}
              valueStyle={{ color: processes.filter(p => p.memory > 50).length > 0 ? '#faad14' : undefined }}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Space style={{ marginBottom: 16 }} size="middle">
          <Input
            placeholder="搜索进程名或命令"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="排序方式"
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 150 }}
            allowClear
          >
            <Select.Option value="cpu">按 CPU</Select.Option>
            <Select.Option value="mem">按内存</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchProcesses}
            loading={loading}
          >
            刷新
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={processes}
          rowKey="pid"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
