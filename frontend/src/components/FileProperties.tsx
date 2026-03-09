import React, { useState, useEffect } from 'react';
import {
  Modal,
  Descriptions,
  Checkbox,
  Button,
  message,
  Spin,
  Tag,
  Space,
  Typography,
  Divider,
} from 'antd';
import {
  FileOutlined,
  FolderOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface FilePermissions {
  user: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  group: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  others: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
}

interface FileInfo {
  path: string;
  permissions: FilePermissions;
  owner: {
    uid: number;
    gid: number;
  };
  size: number;
  modified: string;
  created: string;
  octal: string;
  isDirectory: boolean;
  isFile: boolean;
}

interface FilePropertiesProps {
  visible: boolean;
  onClose: () => void;
  filePath: string;
  onSuccess: () => void;
}

const FileProperties: React.FC<FilePropertiesProps> = ({
  visible,
  onClose,
  filePath,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [permissions, setPermissions] = useState<FilePermissions>({
    user: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    others: { read: false, write: false, execute: false },
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  // 计算权限数值
  const calculateOctal = (): string => {
    let octal = 0;
    if (permissions.user.read) octal += 4;
    if (permissions.user.write) octal += 2;
    if (permissions.user.execute) octal += 1;

    let octalStr = octal.toString();

    octal = 0;
    if (permissions.group.read) octal += 4;
    if (permissions.group.write) octal += 2;
    if (permissions.group.execute) octal += 1;
    octalStr += octal.toString();

    octal = 0;
    if (permissions.others.read) octal += 4;
    if (permissions.others.write) octal += 2;
    if (permissions.others.execute) octal += 1;
    octalStr += octal.toString();

    return octalStr;
  };

  // 获取符号权限表示
  const getSymbolicPermissions = (): string => {
    const p = permissions;
    const user = `${p.user.read ? 'r' : '-'}${p.user.write ? 'w' : '-'}${p.user.execute ? 'x' : '-'}`;
    const group = `${p.group.read ? 'r' : '-'}${p.group.write ? 'w' : '-'}${p.group.execute ? 'x' : '-'}`;
    const others = `${p.others.read ? 'r' : '-'}${p.others.write ? 'w' : '-'}${p.others.execute ? 'x' : '-'}`;
    return `${user}${group}${others}`;
  };

  // 加载文件信息
  const loadFileInfo = async () => {
    if (!filePath) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/files/permissions?path=${encodeURIComponent(filePath)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFileInfo(data);
        setPermissions(data.permissions);
      } else {
        const error = await response.json();
        message.error('获取文件信息失败: ' + error.error);
      }
    } catch (error: any) {
      message.error('获取文件信息失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 保存权限
  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/files/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: filePath,
          permissions,
        }),
      });

      if (response.ok) {
        message.success('权限已更新');
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        message.error('更新权限失败: ' + error.error);
      }
    } catch (error: any) {
      message.error('更新权限失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (visible && filePath) {
      loadFileInfo();
    }
  }, [visible, filePath]);

  if (loading || !fileInfo) {
    return (
      <Modal
        open={visible}
        onCancel={onClose}
        title="文件属性"
        footer={[
          <Button key="cancel" onClick={onClose}>
            关闭
          </Button>,
        ]}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="加载文件信息..." />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <Space>
          {fileInfo.isDirectory ? (
            <FolderOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          ) : (
            <FileOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          )}
          <span>文件属性</span>
        </Space>
      }
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSave}
          loading={saving}
          icon={<CheckCircleOutlined />}
        >
          保存
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 基本信息 */}
        <div>
          <Divider orientation="left">基本信息</Divider>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="文件名">
              {fileInfo.path.split('/').pop()}
            </Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag icon={fileInfo.isDirectory ? <FolderOutlined /> : <FileOutlined />}>
                {fileInfo.isDirectory ? '文件夹' : '文件'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="大小">
              {fileInfo.isDirectory ? '-' : formatSize(fileInfo.size)}
            </Descriptions.Item>
            <Descriptions.Item label="权限数值">
              <Tag color="blue">{calculateOctal()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="修改时间" span={2}>
              {formatDate(fileInfo.modified)}
            </Descriptions.Item>
            <Descriptions.Item label="符号权限" span={2}>
              <Text code>{getSymbolicPermissions()}</Text>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 权限设置 */}
        <div>
          <Divider orientation="left">权限设置</Divider>

          {/* 所有者 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              所有者 (User)
            </div>
            <Space>
              <Checkbox
                checked={permissions.user.read}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    user: { ...permissions.user, read: e.target.checked },
                  })
                }
              >
                读取
              </Checkbox>
              <Checkbox
                checked={permissions.user.write}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    user: { ...permissions.user, write: e.target.checked },
                  })
                }
              >
                写入
              </Checkbox>
              <Checkbox
                checked={permissions.user.execute}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    user: { ...permissions.user, execute: e.target.checked },
                  })
                }
              >
                执行
              </Checkbox>
            </Space>
          </div>

          {/* 用户组 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              用户组 (Group)
            </div>
            <Space>
              <Checkbox
                checked={permissions.group.read}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    group: { ...permissions.group, read: e.target.checked },
                  })
                }
              >
                读取
              </Checkbox>
              <Checkbox
                checked={permissions.group.write}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    group: { ...permissions.group, write: e.target.checked },
                  })
                }
              >
                写入
              </Checkbox>
              <Checkbox
                checked={permissions.group.execute}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    group: { ...permissions.group, execute: e.target.checked },
                  })
                }
              >
                执行
              </Checkbox>
            </Space>
          </div>

          {/* 公共 */}
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              公共 (Others)
            </div>
            <Space>
              <Checkbox
                checked={permissions.others.read}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    others: { ...permissions.others, read: e.target.checked },
                  })
                }
              >
                读取
              </Checkbox>
              <Checkbox
                checked={permissions.others.write}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    others: { ...permissions.others, write: e.target.checked },
                  })
                }
              >
                写入
              </Checkbox>
              <Checkbox
                checked={permissions.others.execute}
                onChange={(e) =>
                  setPermissions({
                    ...permissions,
                    others: { ...permissions.others, execute: e.target.checked },
                  })
                }
              >
                执行
              </Checkbox>
            </Space>
          </div>
        </div>

        {/* 所有者信息 */}
        <div>
          <Divider orientation="left">所有者信息</Divider>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="用户 ID (UID)">
              {fileInfo.owner.uid}
            </Descriptions.Item>
            <Descriptions.Item label="组 ID (GID)">
              {fileInfo.owner.gid}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 8, padding: '8px', background: '#f0f0f0', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              注意：修改所有者需要管理员权限，当前仅支持修改权限设置
            </Text>
          </div>
        </div>
      </Space>
    </Modal>
  );
};

export default FileProperties;
