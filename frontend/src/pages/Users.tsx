import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import './Users/Users.css';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  role_id: string;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // 获取API基础URL（支持开发和生产环境）
  const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    if (import.meta.env.PROD) {
      return window.location.origin;
    }
    return import.meta.env.VITE_API_URL;
  };

  const fetchUsers = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        message.error('获取用户列表失败');
      }
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users/roles/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      role_id: user.role_id,
      status: user.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        message.success('删除成功');
        fetchUsers();
      } else {
        const error = await response.json();
        message.error(error.error || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordUser(user);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');

      if (editingUser) {
        // Update user
        const response = await fetch(`${API_BASE_URL}/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (response.ok) {
          message.success('更新成功');
          setModalVisible(false);
          fetchUsers();
        } else {
          const error = await response.json();
          message.error(error.error || '更新失败');
        }
      } else {
        // Create user
        const response = await fetch(`${API_BASE_URL}/api/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (response.ok) {
          message.success('创建成功');
          setModalVisible(false);
          fetchUsers();
        } else {
          const error = await response.json();
          message.error(error.error || '创建失败');
        }
      }
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handlePasswordReset = async () => {
    try {
      const values = await passwordForm.validateFields();

      const API_BASE_URL = getApiBaseUrl();
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/users/${resetPasswordUser!.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword: values.newPassword }),
      });

      if (response.ok) {
        message.success('密码重置成功');
        setPasswordModalVisible(false);
      } else {
        const error = await response.json();
        message.error(error.error || '密码重置失败');
      }
    } catch (error) {
      console.error('Password reset failed:', error);
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleConfig: Record<string, { color: string; text: string }> = {
          admin: { color: 'red', text: '管理员' },
          user: { color: 'blue', text: '普通用户' },
          viewer: { color: 'green', text: '只读用户' },
        };
        const config = roleConfig[role] || { color: 'default', text: role };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'error'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<KeyOutlined />}
            onClick={() => handleResetPassword(record)}
          >
            重置密码
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const activeUsers = users.filter(u => u.status === 'active').length;
  const disabledUsers = users.filter(u => u.status === 'disabled').length;

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>用户管理</h1>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总用户数"
              value={users.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="启用用户"
              value={activeUsers}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="禁用用户"
              value={disabledUsers}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 用户列表 */}
      <Card
        title="用户列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加用户
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个用户`,
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* 添加/编辑用户模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              disabled={!!editingUser}
            />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder="请输入密码"
              />
            </Form.Item>
          )}

          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            label="角色"
            name="role_id"
            rules={[{ required: true, message: '请选择角色' }]}
            initialValue="role_user"
          >
            <Select placeholder="请选择角色">
              {roles.map(role => (
                <Select.Option key={role.id} value={role.id}>
                  {role.name} - {role.description}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {editingUser && (
            <Form.Item
              label="状态"
              name="status"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select placeholder="请选择状态">
                <Select.Option value="active">启用</Select.Option>
                <Select.Option value="disabled">禁用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 重置密码模态框 */}
      <Modal
        title={`重置密码 - ${resetPasswordUser?.username}`}
        open={passwordModalVisible}
        onOk={handlePasswordReset}
        onCancel={() => setPasswordModalVisible(false)}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password
              prefix={<KeyOutlined />}
              placeholder="请输入新密码"
            />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<KeyOutlined />}
              placeholder="请再次输入新密码"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
