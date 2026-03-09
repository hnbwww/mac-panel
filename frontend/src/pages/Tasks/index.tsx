import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Tag,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
  Typography
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import './Tasks.css';

const { TextArea } = Input;
const { Text } = Typography;

interface ScheduledTask {
  id: string;
  name: string;
  type: 'shell' | 'http' | 'backup';
  cron_expression: string;
  enabled: boolean;
  command?: string;
  url?: string;
  method?: 'GET' | 'POST';
  notify_email?: string;
  webhook_url?: string;
  retry_times?: number;
  timeout?: number;
  created_at: string;
  updated_at: string;
}

interface TaskExecution {
  id: string;
  task_id: string;
  task_name: string;
  status: 'running' | 'success' | 'failed';
  start_time: string;
  end_time?: string;
  output?: string;
  error?: string;
  retry_count?: number;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [selectedTaskLogs, setSelectedTaskLogs] = useState<TaskExecution[]>([]);
  const [selectedTaskName, setSelectedTaskName] = useState('');
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTasks();
    if (activeTab === 'executions') {
      fetchExecutions();
    }
  }, [activeTab]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/tasks/executions/all?limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setExecutions(data);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
      message.error('获取执行记录失败');
    }
  };

  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (task: ScheduledTask) => {
    setEditingTask(task);
    form.setFieldsValue(task);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const url = editingTask
        ? `${API_BASE_URL}/api/tasks/${editingTask.id}`
        : `${API_BASE_URL}/api/tasks`;

      const method = editingTask ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success(editingTask ? '更新成功' : '创建成功');
        setModalOpen(false);
        form.resetFields();
        fetchTasks();
      } else {
        const error = await response.json();
        message.error(error.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        message.success('删除成功');
        fetchTasks();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      message.error('删除失败');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        message.success(enabled ? '任务已启用' : '任务已禁用');
        fetchTasks();
      } else {
        message.error('操作失败');
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
      message.error('操作失败');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        message.success('任务已开始执行');

        // 延迟1秒后刷新执行记录，以便看到新的执行记录
        setTimeout(() => {
          if (activeTab === 'executions') {
            fetchExecutions();
          }
        }, 1000);
      } else {
        message.error('执行失败');
      }
    } catch (error) {
      console.error('Failed to execute task:', error);
      message.error('执行失败');
    }
  };

  const handleViewLogs = async (taskId: string, taskName: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/executions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const logs = await response.json();
        setSelectedTaskName(taskName);
        setSelectedTaskLogs(logs);
        setLogModalOpen(true);
      } else {
        message.error('获取日志失败');
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      message.error('获取日志失败');
    }
  };

  const getTaskTypeTag = (type: string) => {
    const config = {
      shell: { color: 'blue', text: 'Shell 命令' },
      http: { color: 'green', text: 'HTTP 请求' },
      backup: { color: 'orange', text: '备份任务' }
    };
    const { color, text } = config[type as keyof typeof config] || { color: 'default', text: type };
    return <Tag color={color}>{text}</Tag>;
  };

  const getExecutionStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'running':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return null;
    }
  };

  const getExecutionStatusTag = (status: string) => {
    const config = {
      running: { color: 'processing', text: '执行中' },
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' }
    };
    const { color, text } = config[status as keyof typeof config] || { color: 'default', text: status };
    return <Tag color={color} icon={getExecutionStatusIcon(status)}>{text}</Tag>;
  };

  const taskColumns: ColumnsType<ScheduledTask> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <span>{name}</span>
          {record.enabled ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>}
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => getTaskTypeTag(type)
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cron_expression',
      key: 'cron_expression',
      width: 150,
      render: (expr) => <Text code>{expr}</Text>
    },
    {
      title: '命令/URL',
      key: 'command',
      render: (_, record) => {
        if (record.type === 'shell') {
          return <Text ellipsis={{ tooltip: record.command }}>{record.command}</Text>;
        } else if (record.type === 'http') {
          return <Text ellipsis={{ tooltip: record.url }}>{record.url}</Text>;
        } else {
          return <Text type="secondary">-</Text>;
        }
      }
    },
    {
      title: '重试次数',
      dataIndex: 'retry_times',
      key: 'retry_times',
      width: 100,
      render: (times) => times || 0
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleExecute(record.id)}
          >
            执行
          </Button>
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleViewLogs(record.id, record.name)}
          >
            日志
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Switch
            size="small"
            checked={record.enabled}
            onChange={(checked) => handleToggle(record.id, checked)}
          />
          <Popconfirm
            title="确定要删除此任务吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const executionColumns: ColumnsType<TaskExecution> = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      width: 200
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getExecutionStatusTag(status)
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 180,
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 180,
      render: (time) => time ? new Date(time).toLocaleString() : '-'
    },
    {
      title: '输出/错误',
      key: 'output',
      render: (_, record) => {
        const content = record.output || record.error;
        return content ? (
          <Text ellipsis={{ tooltip: content }} style={{ maxWidth: 300 }}>
            {content}
          </Text>
        ) : '-';
      }
    }
  ];

  const summaryCards = (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic title="总任务数" value={tasks.length} />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="启用任务"
            value={tasks.filter(t => t.enabled).length}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="执行中"
            value={executions.filter(e => e.status === 'running').length}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="失败次数"
            value={executions.filter(e => e.status === 'failed').length}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>
    </Row>
  );

  const tasksTab = (
    <>
      {summaryCards}
      <Card
        title="定时任务列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建任务
          </Button>
        }
      >
        <Table
          columns={taskColumns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </>
  );

  const executionsTab = (
    <Card
      title="执行记录"
      extra={
        <Button icon={<ReloadOutlined />} onClick={fetchExecutions}>
          刷新
        </Button>
      }
    >
      <Table
        columns={executionColumns}
        dataSource={executions}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: 16 }}>
              <p><strong>输出:</strong></p>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {record.output || '无输出'}
              </pre>
              {record.error && (
                <>
                  <p><strong>错误:</strong></p>
                  <pre style={{ background: '#fff1f0', padding: 12, borderRadius: 4, color: '#cf1322' }}>
                    {record.error}
                  </pre>
                </>
              )}
            </div>
          )
        }}
      />
    </Card>
  );

  return (
    <div className="tasks-page">
      <h1 className="page-title">任务中心</h1>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="任务列表" key="tasks">
          {tasksTab}
        </Tabs.TabPane>
        <Tabs.TabPane tab="执行记录" key="executions">
          {executionsTab}
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title={editingTask ? '编辑任务' : '创建任务'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：每日数据库备份" />
          </Form.Item>

          <Form.Item
            name="type"
            label="任务类型"
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select placeholder="选择任务类型">
              <Select.Option value="shell">Shell 命令</Select.Option>
              <Select.Option value="http">HTTP 请求</Select.Option>
              <Select.Option value="backup">备份任务</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.type !== curr.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');

              if (type === 'shell') {
                return (
                  <Form.Item
                    name="command"
                    label="Shell 命令"
                    rules={[{ required: true, message: '请输入命令' }]}
                  >
                    <TextArea
                      placeholder="例如：/path/to/backup.sh"
                      rows={4}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                );
              } else if (type === 'http') {
                return (
                  <>
                    <Form.Item
                      name="url"
                      label="请求 URL"
                      rules={[{ required: true, message: '请输入 URL' }]}
                    >
                      <Input placeholder="https://api.example.com/webhook" />
                    </Form.Item>
                    <Form.Item
                      name="method"
                      label="请求方法"
                      initialValue="GET"
                    >
                      <Select>
                        <Select.Option value="GET">GET</Select.Option>
                        <Select.Option value="POST">POST</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name="command"
                      label="请求体 (POST)"
                    >
                      <TextArea
                        placeholder='{"key": "value"}'
                        rows={3}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </Form.Item>
                  </>
                );
              } else if (type === 'backup') {
                return (
                  <Form.Item
                    name="command"
                    label="备份配置 (JSON)"
                    rules={[{ required: true, message: '请输入备份配置' }]}
                    extra='格式：[{"type": "database", "id": "db_id"}, {"type": "files", "path": "/path/to/backup"}]'
                  >
                    <TextArea
                      placeholder='[{"type": "database", "id": "db_id"}]'
                      rows={4}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            name="cron_expression"
            label="Cron 表达式"
            rules={[{ required: true, message: '请输入 Cron 表达式' }]}
            extra='格式：秒 分 时 日 月 周，例如：0 0 * * * (每天0点)'
          >
            <Input placeholder="0 0 * * *" />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用任务"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="retry_times"
            label="重试次数"
            initialValue={0}
          >
            <Input type="number" min={0} max={10} />
          </Form.Item>

          <Form.Item
            name="timeout"
            label="超时时间 (秒)"
            initialValue={300}
          >
            <Input type="number" min={10} max={3600} />
          </Form.Item>

          <Form.Item
            name="notify_email"
            label="失败通知邮箱"
          >
            <Input placeholder="admin@example.com" />
          </Form.Item>

          <Form.Item
            name="webhook_url"
            label="Webhook URL"
          >
            <Input placeholder="https://hooks.example.com/webhook" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingTask ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 日志查看Modal */}
      <Modal
        title={`任务日志: ${selectedTaskName}`}
        open={logModalOpen}
        onCancel={() => setLogModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalOpen(false)}>
            关闭
          </Button>,
          <Button key="refresh" type="primary" onClick={() => {
            const task = tasks.find(t => t.name === selectedTaskName);
            if (task) {
              handleViewLogs(task.id, task.name);
            }
          }}>
            刷新
          </Button>
        ]}
        width={800}
      >
        {selectedTaskLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无执行记录
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {selectedTaskLogs.map((log) => (
              <Card
                key={log.id}
                size="small"
                style={{ marginBottom: '12px' }}
                title={
                  <Space>
                    {getExecutionStatusTag(log.status)}
                    <Text type="secondary">
                      {new Date(log.start_time).toLocaleString('zh-CN')}
                    </Text>
                  </Space>
                }
              >
                <div style={{ marginBottom: '8px' }}>
                  <Text strong>开始时间：</Text>
                  <Text>{new Date(log.start_time).toLocaleString('zh-CN')}</Text>
                </div>
                {log.end_time && (
                  <div style={{ marginBottom: '8px' }}>
                    <Text strong>结束时间：</Text>
                    <Text>{new Date(log.end_time).toLocaleString('zh-CN')}</Text>
                  </div>
                )}
                {(log.output || log.error) && (
                  <div>
                    <Text strong>输出：</Text>
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: '300px',
                        overflowY: 'auto'
                      }}
                    >
                      {log.output || log.error}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}