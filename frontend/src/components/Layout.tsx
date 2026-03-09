import { Layout, Menu, Button, Dropdown, Avatar, Badge, Modal, Form, Input, message, Drawer } from 'antd';
import {
  FolderOutlined,
  CodeOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  UserOutlined,
  DashboardOutlined,
  MonitorOutlined,
  AppstoreOutlined,
  BellOutlined,
  ScheduleOutlined,
  DownloadOutlined,
  ChromeOutlined,
  FileTextOutlined,
  KeyOutlined,
  TeamOutlined,
  EditOutlined,
  MenuOutlined,
  ApiOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';
import { API_BASE_URL } from '../config';
import './Layout.css';

const { Header, Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);

  // 检测是否为移动端
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileMenuVisible(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '面板首页' },
    { key: '/files', icon: <FolderOutlined />, label: '文件管理' },
    { key: '/editor', icon: <EditOutlined />, label: '在线编辑器' },
    { key: '/terminal', icon: <CodeOutlined />, label: '终端命令' },
    { key: '/websites', icon: <GlobalOutlined />, label: '网站管理' },
    { key: '/nginx', icon: <ApiOutlined />, label: 'Nginx管理' },
    { key: '/browser', icon: <ChromeOutlined />, label: '浏览器' },
    { key: '/database-admin', icon: <DatabaseOutlined />, label: '数据库管理' },
    { key: '/software', icon: <DownloadOutlined />, label: '软件管理' },
    { key: '/software-admin', icon: <SettingOutlined />, label: '软件配置' },
    { key: '/settings', icon: <SettingOutlined />, label: '操作管理' },
    { key: '/monitor', icon: <MonitorOutlined />, label: '系统监控' },
    { key: '/processes', icon: <AppstoreOutlined />, label: '进程管理' },
    { key: '/tasks', icon: <ScheduleOutlined />, label: '任务中心' },
    { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
    { key: '/logs', icon: <FileTextOutlined />, label: '操作日志' },
  ];

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();

      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        }),
      });

      if (response.ok) {
        message.success('密码修改成功，请重新登录');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
        // 登出用户，强制重新登录
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 1500);
      } else {
        const error = await response.json();
        message.error(error.error || '密码修改失败');
      }
    } catch (error) {
      console.error('Change password failed:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'changePassword',
      icon: <KeyOutlined />,
      label: '修改密码',
      onClick: () => setPasswordModalVisible(true),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="app-layout" style={{ overflow: 'hidden' }}>
      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <Sider
          theme="light"
          width={220}
          className="app-sider"
          style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0 }}
        >
          <div className="app-logo">
            <span className="apple-logo">🍎</span>
            <h2>Mac Panel</h2>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
      )}

      {/* 移动端抽屉菜单 */}
      <Drawer
        title={
          <div className="mobile-drawer-title">
            <span className="apple-logo">🍎</span>
            <span>Mac Panel</span>
          </div>
        }
        placement="left"
        width={280}
        open={mobileMenuVisible}
        onClose={() => setMobileMenuVisible(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            setMobileMenuVisible(false);
          }}
          style={{ borderRight: 0 }}
        />
      </Drawer>

      <Layout style={{ marginLeft: isMobile ? 0 : 220, overflow: 'hidden' }}>
        <Header
          className="app-header"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            left: isMobile ? 0 : 220,
            zIndex: 5,
            paddingLeft: isMobile ? 16 : 24,
            paddingRight: isMobile ? 16 : 24,
          }}
        >
          <div className="header-left">
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuVisible(true)}
                className="mobile-menu-button"
              />
            )}
            {!isMobile && (
              <>
                <span className="apple-logo" style={{ fontSize: 20, marginRight: 8 }}>🍎</span>
                <span className="header-title">服务器管理系统</span>
              </>
            )}
            {isMobile && (
              <span className="header-title" style={{ fontSize: 16 }}>Mac Panel</span>
            )}
          </div>
          <div className="header-right">
            <Badge count={0} dot>
              <Button type="text" icon={<BellOutlined />} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" className="user-button">
                <Avatar size="small" icon={<UserOutlined />} />
                {!isMobile && <span className="username">{user?.username}</span>}
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content
          className="app-content"
          style={{
            marginTop: 64,
            height: 'calc(100vh - 64px)',
            overflow: 'auto'
          }}
        >
          <div style={{ maxWidth: '100%', padding: '24px' }}>
            {children}
          </div>
        </Content>
      </Layout>

      {/* 修改密码模态框 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onOk={handleChangePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        okText="确认修改"
        cancelText="取消"
      >
        <Form
          form={passwordForm}
          layout="vertical"
          autoComplete="off"
        >
          <Form.Item
            label="旧密码"
            name="oldPassword"
            rules={[{ required: true, message: '请输入旧密码' }]}
          >
            <Input.Password
              prefix={<KeyOutlined />}
              placeholder="请输入旧密码"
            />
          </Form.Item>

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
              { required: true, message: '请确认新密码' },
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
    </Layout>
  );
}
