import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Switch,
  Button,
  Input,
  message,
  Typography,
  Divider,
  Space,
  Alert,
  Breadcrumb,
  Tag,
  Descriptions,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  FileTextOutlined,
  SettingOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [yoloEnabled, setYoloEnabled] = useState(false);
  const [yoloChecking, setYoloChecking] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [creatingClaudeMd, setCreatingClaudeMd] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');

  // 检查 Yolo 状态
  const checkYoloStatus = async () => {
    try {
      setYoloChecking(true);
      const response = await axios.get(`${API_BASE_URL}/api/settings/yolo/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setYoloEnabled(response.data.enabled);
    } catch (error) {
      console.error('检查 Yolo 状态失败:', error);
    } finally {
      setYoloChecking(false);
    }
  };

  useEffect(() => {
    checkYoloStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 配置 Yolo 快捷启动
  const handleYoloToggle = async (enabled: boolean) => {
    try {
      setLoading(true);
      await axios.post(
        `${API_BASE_URL}/api/settings/yolo`,
        { enabled },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setYoloEnabled(enabled);
      message.success(enabled ? 'Yolo 快捷启动已启用' : 'Yolo 快捷启动已禁用');

      // 重新检查状态
      setTimeout(checkYoloStatus, 1000);
    } catch (error: unknown) {
      console.error('配置 Yolo 失败:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      message.error('操作失败: ' + (err.response?.data?.error || err.message || '未知错误'));
    } finally {
      setLoading(false);
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
      const response = await axios.post(
        `${API_BASE_URL}/api/settings/claude-md`,
        { projectPath: projectPath.trim() },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      message.success('CLAUDE.md 和 AI_MEMORY 结构创建成功！');
      message.info(response.data.message);

      // 显示创建的文件列表
      if (response.data.files) {
        message.info(`已创建文件:\n${response.data.files.join('\n')}`, 5);
      }

      setProjectPath('');
    } catch (error: unknown) {
      console.error('创建 CLAUDE.md 失败:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      message.error('创建失败: ' + (err.response?.data?.error || err.message || '未知错误'));
    } finally {
      setCreatingClaudeMd(false);
    }
  };

  // 测试 Yolo 命令
  const testYoloCommand = () => {
    message.info('请在终端中执行: yolo 命令测试');
  };

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>操作管理</Breadcrumb.Item>
      </Breadcrumb>

      <Title level={2}>
        <SettingOutlined /> 操作管理
      </Title>

      <Row gutter={[24, 24]}>
        {/* Yolo 快捷启动 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <RocketOutlined />
                <span>Yolo 快捷启动</span>
              </Space>
            }
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
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Paragraph>
                  <Text strong>功能说明：</Text>
                </Paragraph>
                <Paragraph>
                  为 Claude Code CLI 添加 <Text code>yolo</Text> 快捷命令，等同于{' '}
                  <Text code>claude --dangerously-skip-permissions</Text>
                </Paragraph>
              </div>

              <Alert
                message="便捷体验"
                description="启用后可在终端直接使用 'yolo' 命令，跳过权限检查，提升开发效率"
                type="info"
                showIcon
              />

              <div>
                <Text strong>配置状态：</Text>
                <div style={{ marginTop: 8 }}>
                  {yoloChecking ? (
                    <Text type="secondary">检查中...</Text>
                  ) : (
                    <Space>
                      <Text>
                        {yoloEnabled ? '已添加到 ~/.zshrc' : '未配置'}
                      </Text>
                      {yoloEnabled && (
                        <Button size="small" onClick={testYoloCommand}>
                          测试命令
                        </Button>
                      )}
                    </Space>
                  )}
                </div>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <div>
                <Text strong>快捷启动：</Text>
                <div style={{ marginTop: 8 }}>
                  <Switch
                    checked={yoloEnabled}
                    onChange={handleYoloToggle}
                    loading={loading}
                    checkedChildren="开启"
                    unCheckedChildren="关闭"
                  />
                </div>
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
        </Col>

        {/* Claude Code 配置 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>Claude Code 配置</span>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
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
                icon={<FileTextOutlined />}
                onClick={handleCreateClaudeMd}
                loading={creatingClaudeMd}
                block
              >
                创建 CLAUDE.md
              </Button>

              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="创建文件">
                  <div style={{ fontSize: 12 }}>
                    <div>• CLAUDE.md (主配置)</div>
                    <div>• AI_MEMORY/brain/project_understanding.md</div>
                    <div>• AI_MEMORY/progress/current_status.md</div>
                    <div>• AI_MEMORY/logs/work_log.md</div>
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="记忆规则">
                  <div style={{ fontSize: 12 }}>
                    <div>• 自动理解项目结构</div>
                    <div>• 强制备份机制</div>
                    <div>• 完整操作日志</div>
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>
        </Col>

        {/* 安全提示 */}
        <Col span={24}>
          <Card>
            <Space>
              <SafetyOutlined style={{ fontSize: 20, color: '#faad14' }} />
              <div>
                <Text strong>安全提示</Text>
                <Paragraph style={{ margin: '8px 0 0 0', fontSize: 12 }} type="secondary">
                  Yolo 命令会跳过权限检查，仅在开发环境使用。生产环境请使用完整的 claude 命令以确保安全性。
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsPage;
