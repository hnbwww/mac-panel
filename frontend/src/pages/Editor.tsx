import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Modal, message, Tree, Input, Button, Space, Select, Dropdown, Tag, Spin, Empty } from 'antd';
import { useGlobalEditor } from '../context/GlobalEditorContext';
import {
  SaveOutlined,
  ReloadOutlined,
  SearchOutlined,
  LineHeightOutlined,
  BgColorsOutlined,
  SettingOutlined,
  CloseOutlined,
  FolderOutlined,
  FileOutlined,
  InfoCircleOutlined,
  SwapOutlined,
  MinusOutlined,
  FullscreenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { TreeDataNode } from 'antd';
import './Editor.css';

interface FileNode {
  key: string;
  title: string;
  path: string;
  isLeaf: boolean;
  children?: FileNode[];
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  modified: boolean;
}

interface OnlineEditorProps {
  globalMode?: boolean;
}

export default function OnlineEditor({ globalMode = false }: OnlineEditorProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const globalEditor = useGlobalEditor();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [searchValue, setSearchValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState('vs-dark');
  const [showSearch, setShowSearch] = useState(false);
  const [currentLine, setCurrentLine] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [isMinimized, setIsMinimized] = useState(globalMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const API_BASE_URL = import.meta.env.VITE_API_URL;

  // 加载文件树
  const loadFileTree = async (path: string = '/') => {
    // 防止重复加载
    if (loadingPaths.has(path)) {
      return [];
    }

    setLoadingPaths(prev => new Set([...prev, path]));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/list?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const nodes: FileNode[] = data.map((item: any) => ({
          key: item.path,
          title: item.name,
          path: item.path,
          isLeaf: item.type === 'file',
          children: item.type === 'directory' ? [] : undefined  // 空数组表示可展开
        }));
        return nodes;
      }
    } catch (error) {
      console.error('Load file tree error:', error);
    } finally {
      setLoadingPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    }
    return [];
  };

  // 初始化加载根目录
  useEffect(() => {
    loadFileTree('/').then(nodes => {
      setFileTree(nodes);
    });
  }, []);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 处理 URL 参数中的文件路径
  useEffect(() => {
    if (!globalMode) {
      const fileParam = searchParams.get('file');
      if (fileParam) {
        // 解码文件路径
        const filePath = decodeURIComponent(fileParam);
        const fileName = filePath.split('/').pop() || '';

        // 自动打开该文件
        openFile(filePath, fileName);

        // 清除 URL 参数
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('file');
        navigate(`/editor${newParams.toString() ? '?' + newParams.toString() : ''}`, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 监听全局编辑器上下文中的待打开文件
  useEffect(() => {
    if (globalMode && globalEditor.pendingFile) {
      const { path, name } = globalEditor.pendingFile;
      openFile(path, name);
      setVisible(true);
      setIsMinimized(false);
    }
  }, [globalEditor.pendingFile]);

  // 加载文件内容
  const loadFileContent = async (path: string, name: string): Promise<string> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/content?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        return data.content || '';
      }
    } catch (error) {
      message.error('读取文件失败');
    }
    return '';
  };

  // 获取文件语言
  const getFileLanguage = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
      php: 'php', html: 'html', css: 'css', json: 'json',
      md: 'markdown', sql: 'sql', sh: 'shell', yml: 'yaml', yaml: 'yaml',
      txt: 'plaintext', xml: 'xml', svg: 'xml', rs: 'rust', go: 'go',
      rb: 'ruby', kt: 'kotlin', swift: 'swift', vue: 'javascript', scss: 'css', less: 'css'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  // 打开文件
  const openFile = async (path: string, name: string) => {
    // 检查文件是否已经打开
    const existingFile = openFiles.find(f => f.path === path);
    if (existingFile) {
      setActiveFile(path);
      return;
    }

    const content = await loadFileContent(path, name);
    const language = getFileLanguage(name);
    const newFile: OpenFile = {
      path,
      name,
      content,
      language,
      modified: false
    };
    setOpenFiles([...openFiles, newFile]);
    setActiveFile(path);
  };

  // 关闭文件
  const closeFile = (path: string) => {
    const file = openFiles.find(f => f.path === path);
    if (file?.modified) {
      Modal.confirm({
        title: '文件已修改',
        content: '是否保存修改？',
        okText: '保存',
        cancelText: '不保存',
        onOk: async () => {
          await saveFile(path);
          setOpenFiles(openFiles.filter(f => f.path !== path));
          if (activeFile === path) {
            setActiveFile(openFiles.find(f => f.path !== path)?.path || null);
          }
        },
        onCancel: () => {
          setOpenFiles(openFiles.filter(f => f.path !== path));
          if (activeFile === path) {
            setActiveFile(openFiles.find(f => f.path !== path)?.path || null);
          }
        }
      });
    } else {
      setOpenFiles(openFiles.filter(f => f.path !== path));
      if (activeFile === path) {
        setActiveFile(openFiles.find(f => f.path !== path)?.path || null);
      }
    }
  };

  // 保存文件
  const saveFile = async (path?: string) => {
    const targetPath = path || activeFile;
    if (!targetPath) return;

    const file = openFiles.find(f => f.path === targetPath);
    if (!file) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, content: file.content })
      });
      if (response.ok) {
        const updatedFiles = openFiles.map(f =>
          f.path === targetPath ? { ...f, modified: false } : f
        );
        setOpenFiles(updatedFiles);
        message.success('保存成功');
      } else {
        message.error('保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 全部保存
  const saveAllFiles = async () => {
    for (const file of openFiles) {
      if (file.modified) {
        await saveFile(file.path);
      }
    }
  };

  // 刷新当前文件
  const refreshFile = async () => {
    if (!activeFile) return;
    const file = openFiles.find(f => f.path === activeFile);
    if (!file) return;

    if (file.modified) {
      Modal.confirm({
        title: '文件已修改',
        content: '刷新将丢失未保存的修改，是否继续？',
        okText: '确定',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          const content = await loadFileContent(file.path, file.name);
          const updatedFiles = openFiles.map(f =>
            f.path === activeFile ? { ...f, content, modified: false } : f
          );
          setOpenFiles(updatedFiles);
        }
      });
    } else {
      const content = await loadFileContent(file.path, file.name);
      const updatedFiles = openFiles.map(f =>
        f.path === activeFile ? { ...f, content, modified: false } : f
      );
      setOpenFiles(updatedFiles);
    }
  };

  // 查找下一个
  const findNext = () => {
    if (editorInstance && searchValue) {
      editorInstance.getAction('actions.find').run();
    }
  };

  // 查找上一个
  const findPrevious = () => {
    if (editorInstance && searchValue) {
      const findController = editorInstance.getContribution('editor.contrib.findController');
      findController.findPrevious();
    }
  };

  // 替换
  const replace = () => {
    if (editorInstance && searchValue) {
      const findController = editorInstance.getContribution('editor.contrib.findController');
      findController.replace();
    }
  };

  // 替换全部
  const replaceAll = () => {
    if (editorInstance && searchValue) {
      const findController = editorInstance.getContribution('editor.contrib.findController');
      findController.replaceAll();
    }
  };

  // 全盘搜索文件
  const searchFiles = async (pattern: string, path: string = '/'): Promise<any[]> => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/list?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const results: any[] = [];

        // 转换通配符为正则表达式
        const regexPattern = pattern
          .replace(/\./g, '\\.')  // 转义点号
          .replace(/\*/g, '.*')   // * → .*
          .replace(/\?/g, '.');   // ? → .

        const regex = new RegExp(regexPattern, 'i');

        for (const item of data) {
          // 检查当前文件/文件夹是否匹配
          if (regex.test(item.name)) {
            results.push(item);
          }

          // 如果是目录，递归搜索
          if (item.type === 'directory') {
            const subResults = await searchFiles(pattern, item.path);
            results.push(...subResults);
          }
        }

        return results;
      }
    } catch (error) {
      console.error('Search files error:', error);
    }
    return [];
  };

  // 执行搜索
  const handleSearch = async () => {
    if (!searchValue.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    setSearching(true);
    setSearchResults([]);

    try {
      const results = await searchFiles(searchValue);
      setSearchResults(results);
      message.success(`找到 ${results.length} 个匹配项`);
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchValue('');
    setSearchResults([]);
  };

  // 跳转到指定行
  const jumpToLine = () => {
    if (editorInstance && currentLine) {
      const line = parseInt(currentLine);
      if (!isNaN(line)) {
        editorInstance.revealLineInCenter(line);
        editorInstance.setPosition({ lineNumber: line, column: 1 });
        editorInstance.focus();
      }
    }
  };

  // 树形数据转换
  const convertToTreeData = (nodes: FileNode[]): TreeDataNode[] => {
    return nodes.map(node => ({
      key: node.key,
      title: node.title,
      path: node.path,
      isLeaf: node.isLeaf,
      icon: node.isLeaf ? <FileOutlined /> : <FolderOutlined />,
      children: node.children ? convertToTreeData(node.children) : undefined
    }));
  };

  // 递归更新树节点
  const updateTreeNode = (nodes: FileNode[], key: string, children: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeNode(node.children, key, children) };
      }
      return node;
    });
  };

  // 树节点加载
  const loadTreeNode = async (node: TreeDataNode) => {
    const path = node.key as string;

    console.log('[Editor] Loading tree node:', path, 'isLeaf:', node.isLeaf);

    // 如果是文件，没有子节点
    if (node.isLeaf) {
      return [];
    }

    // 防止重复加载
    if (loadingPaths.has(path)) {
      console.log('[Editor] Already loading, skipping');
      return [];
    }

    setLoadingPaths(prev => new Set([...prev, path]));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/list?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();

        // 创建子节点数组
        const childNodes: FileNode[] = data.map((item: any) => ({
          key: item.path,
          title: item.name,
          path: item.path,
          isLeaf: item.type === 'file',
          children: item.type === 'directory' ? [] : undefined
        }));

        // 更新 fileTree 状态
        setFileTree(prevTree => updateTreeNode(prevTree, path, childNodes));

        console.log('[Editor] Loaded children for', path, ':', childNodes);

        // 返回 TreeDataNode 格式
        return childNodes.map(node => ({
          key: node.key,
          title: node.title,
          path: node.path,
          isLeaf: node.isLeaf,
          icon: node.isLeaf ? <FileOutlined /> : <FolderOutlined />,
          children: node.children
        }));
      }
    } catch (error) {
      console.error('[Editor] Load tree node error:', error);
    } finally {
      setLoadingPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    }

    return [];
  };

  // 当前文件内容
  const currentFile = openFiles.find(f => f.path === activeFile);

  // 全局模式下，没有打开文件时只显示最小化按钮
  if (globalMode && openFiles.length === 0) {
    return null;
  }

  return (
    <>
      {/* 最小化时的浮动按钮 */}
      {isMinimized && globalMode && (
        <div
          className="global-editor-minimized"
          onClick={() => {
            globalEditor.restore();
            setIsMinimized(false);
          }}
        >
          <span>{currentFile?.name || '编辑器'}</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {openFiles.length} 个文件
          </span>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setOpenFiles([]);
              setActiveFile(null);
            }}
            style={{ color: '#fff' }}
          />
        </div>
      )}

      <div className={`online-editor ${isMinimized ? 'minimized' : ''} ${globalMode ? 'global-mode' : ''}`}>
      {/* 左侧文件树 */}
      <div className={`editor-sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <Space size="small">
            {sidebarVisible && <span className="sidebar-title">文件资源管理器</span>}
            <Button
              type="text"
              size="small"
              icon={sidebarVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={() => setSidebarVisible(!sidebarVisible)}
            />
          </Space>
          {sidebarVisible && (
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => loadFileTree('/').then(nodes => setFileTree(nodes))}
            />
          )}
        </div>
        {/* 搜索框 */}
        {sidebarVisible && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #3c3c3c' }}>
          <Input
            placeholder="搜索文件 (* ? 通配符)"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onPressEnter={handleSearch}
            size="small"
            addonAfter={
              <Space size="small">
                {searchValue && (
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={clearSearch}
                  />
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  loading={searching}
                />
              </Space>
            }
          />
        </div>
        )}
        {sidebarVisible && (
        <div className="sidebar-content">
          {searching ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Spin tip="搜索中..." />
            </div>
          ) : searchResults.length > 0 ? (
            <div style={{ padding: '8px 0' }}>
              <div style={{ padding: '0 12px 8px', fontSize: '12px', color: '#999' }}>
                找到 {searchResults.length} 个结果
              </div>
              {searchResults.map((item) => (
                <div
                  key={item.path}
                  className="search-result-item"
                  onClick={() => {
                    if (item.type === 'file') {
                      openFile(item.path, item.name);
                    } else {
                      // 对于目录，展开并导航
                      const pathParts = item.path.split('/').filter(Boolean);
                      let currentPath = '';
                      const newExpandedKeys: string[] = [];
                      for (let i = 0; i < pathParts.length; i++) {
                        currentPath += '/' + pathParts[i];
                        if (i < pathParts.length - 1) {
                          newExpandedKeys.push(currentPath);
                        }
                      }
                      setExpandedKeys([...expandedKeys, ...newExpandedKeys]);
                    }
                    setSearchResults([]);
                    setSearchValue('');
                  }}
                >
                  {item.type === 'directory' ? <FolderOutlined /> : <FileOutlined />}
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    {item.path}
                  </span>
                </div>
              ))}
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Spin />
            </div>
          ) : fileTree.length === 0 ? (
            <Empty description="暂无文件" />
          ) : (
            <Tree
              showIcon
              showLine={{ showLeafIcon: false }}
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              treeData={fileTree}
              fieldNames={{ title: 'title', key: 'key', children: 'children' }}
              loadData={loadTreeNode}
              onSelect={(keys, info: any) => {
                console.log('[Editor] Tree onSelect:', keys, info.node);
                // 只处理文件，忽略文件夹
                if (info.node.isLeaf && keys.length > 0) {
                  const path = keys[0] as string;
                  openFile(path, info.node.title);
                }
              }}
              onRightClick={({ event, node }) => {
                console.log('[Editor] Tree onRightClick:', node);
                event.preventDefault();
              }}
              titleRender={(node: any) => (
                <span className="tree-node-title">{node.title}</span>
              )}
            />
          )}
        </div>
        )}
      </div>

      {/* 主编辑区域 */}
      <div className={`editor-main ${isMinimized ? 'minimized' : ''}`}>
        {/* 顶部工具栏 */}
        <div className="editor-toolbar">
          <Space size="small">
            <Button
              size="small"
              icon={<SaveOutlined />}
              onClick={() => saveFile()}
              disabled={!activeFile || !currentFile?.modified}
            >
              {isMobile ? '' : '保存'}
            </Button>
            {!isMobile && (
              <Button
                size="small"
                icon={<SaveOutlined />}
                onClick={saveAllFiles}
                disabled={!openFiles.some(f => f.modified)}
              >
                全部保存
              </Button>
            )}
            {!isMobile && (
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={refreshFile}
                disabled={!activeFile}
              >
                刷新
              </Button>
            )}
            <Button
              size="small"
              icon={<SearchOutlined />}
              onClick={() => setShowSearch(!showSearch)}
            >
              {isMobile ? '' : '搜索'}
            </Button>
            <Button
              size="small"
              icon={<SwapOutlined />}
              onClick={() => setShowSearch(!showSearch)}
            >
              {isMobile ? '' : '替换'}
            </Button>
            <Input
              size="small"
              placeholder="跳转到行"
              value={currentLine}
              onChange={(e) => setCurrentLine(e.target.value)}
              onPressEnter={jumpToLine}
              style={{ width: isMobile ? 60 : 100 }}
              prefix={<LineHeightOutlined />}
            />
          </Space>

          <Space size="small">
            {!isMobile && (
              <Select
                size="small"
                value={fontSize}
                onChange={setFontSize}
                style={{ width: 100 }}
              >
                <Select.Option value={12}>12px</Select.Option>
                <Select.Option value={14}>14px</Select.Option>
                <Select.Option value={16}>16px</Select.Option>
                <Select.Option value={18}>18px</Select.Option>
                <Select.Option value={20}>20px</Select.Option>
              </Select>
            )}
            {!isMobile && (
              <Select
                size="small"
                value={theme}
                onChange={setTheme}
                style={{ width: 120 }}
              >
                <Select.Option value="vs-dark">深色</Select.Option>
                <Select.Option value="vs-light">浅色</Select.Option>
                <Select.Option value="hc-black">高对比度</Select.Option>
              </Select>
            )}
            {!isMobile && (
              <Button
                size="small"
                icon={<InfoCircleOutlined />}
                title="快捷键"
              />
            )}
            {!isMobile && (
              <Button
                size="small"
                icon={<SettingOutlined />}
                title="设置"
              />
            )}
            <Button
              size="small"
              icon={<MinusOutlined />}
              title={isMinimized ? "还原" : "最小化"}
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMobile ? '' : (isMinimized ? '还原' : '最小化')}
            </Button>
            {!isMobile && (
              <Button
                size="small"
                icon={<FullscreenOutlined />}
                title={isFullscreen ? "退出全屏" : "全屏"}
                onClick={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                    setIsFullscreen(true);
                  } else {
                    document.exitFullscreen();
                    setIsFullscreen(false);
                  }
                }}
              />
            )}
          </Space>
        </div>

        {/* 搜索栏 */}
        {showSearch && (
          <div className="editor-search-bar">
            <Space size="small">
              <Input
                placeholder="查找"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onPressEnter={findNext}
                style={{ width: 200 }}
                addonAfter={
                  <Space size="small">
                    <Button
                      type="text"
                      size="small"
                      onClick={findPrevious}
                      icon={<SearchOutlined />}
                    />
                    <Button
                      type="text"
                      size="small"
                      onClick={findNext}
                      icon={<SearchOutlined />}
                    />
                  </Space>
                }
              />
              <Input
                placeholder="替换"
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
                style={{ width: 200 }}
              />
              <Button
                size="small"
                onClick={replace}
                disabled={!searchValue}
              >
                替换
              </Button>
              <Button
                size="small"
                onClick={replaceAll}
                disabled={!searchValue}
              >
                全部替换
              </Button>
            </Space>
          </div>
        )}

        {/* 标签栏 */}
        <div className="editor-tabs">
          {openFiles.map(file => (
            <div
              key={file.path}
              className={`editor-tab ${file.path === activeFile ? 'active' : ''}`}
              onClick={() => setActiveFile(file.path)}
            >
              <FileOutlined style={{ marginRight: 4 }} />
              <span className="tab-title">{file.name}</span>
              {file.modified && <span className="tab-modified">●</span>}
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.path);
                }}
                style={{ marginLeft: 4 }}
              />
            </div>
          ))}
        </div>

        {/* 编辑器区域 */}
        <div className="editor-content">
          {currentFile ? (
            <Editor
              height="100%"
              language={currentFile.language}
              theme={theme}
              value={currentFile.content}
              onChange={(value) => {
                const updatedFiles = openFiles.map(f =>
                  f.path === activeFile ? { ...f, content: value || '', modified: true } : f
                );
                setOpenFiles(updatedFiles);
              }}
              onMount={(editor) => {
                setEditorInstance(editor);
                // 添加快捷键
                editor.addCommand(
                  window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS,
                  () => {
                    saveFile();
                  }
                );
              }}
              options={{
                minimap: { enabled: true },
                fontSize,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'off',
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          ) : (
            <Empty
              description="请选择文件或双击文件打开"
              style={{ marginTop: 100 }}
            />
          )}
        </div>

        {/* 状态栏 */}
        <div className="editor-statusbar">
          <Space size="small">
            {currentFile && (
              <>
                <span>{currentFile.name}</span>
                <span>{currentFile.language}</span>
                {editorInstance && (
                  <>
                    <span>行 {editorInstance.getPosition()?.lineNumber}</span>
                    <span>列 {editorInstance.getPosition()?.column}</span>
                  </>
                )}
              </>
            )}
          </Space>
          <Space size="small">
            <span>UTF-8</span>
            <span>LF</span>
          </Space>
        </div>
      </div>
    </div>
    </>
  );
}
