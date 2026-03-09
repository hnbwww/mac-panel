import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGlobalEditor } from '../context/GlobalEditorContext';
import { Table, Button, Input, Modal, Form, message, Popconfirm, Space, Tag, Dropdown, Breadcrumb, Alert, Progress, Upload, Radio, Drawer, List, Empty, Spin, Typography } from 'antd';
import { useFileStore } from '../store';
import Editor from '@monaco-editor/react';
import FileProperties from '../components/FileProperties';
import './Files.css';

const { Text } = Typography;

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
}

interface ClipboardItem {
  path: string;
  name: string;
  type: 'copy' | 'cut';
}

export default function Files() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openFile: openFileInEditor } = useGlobalEditor();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);  // 添加刷新key
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [sortField, setSortField] = useState<keyof FileItem | ''>('');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | null>(null);
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [compressModalOpen, setCompressModalOpen] = useState(false);
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [currentEditPath, setCurrentEditPath] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('javascript');
  const [extractFile, setExtractFile] = useState<FileItem | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardItem[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [urlDownloadModalOpen, setUrlDownloadModalOpen] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [urlDownloading, setUrlDownloading] = useState(false);
  const [urlDownloadProgress, setUrlDownloadProgress] = useState(0);
  const [createForm] = Form.useForm();
  const [compressForm] = Form.useForm();
  const [extractForm] = Form.useForm();
  const [urlDownloadForm] = Form.useForm();

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  // Image preview state
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentFolderImages, setCurrentFolderImages] = useState<FileItem[]>([]);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');

  // Recycle bin state
  const [recycleBinVisible, setRecycleBinVisible] = useState(false);
  const [recycleBinItems, setRecycleBinItems] = useState<any[]>([]);
  const [recycleBinLoading, setRecycleBinLoading] = useState(false);

  // Favorites state
  const [favoritesVisible, setFavoritesVisible] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritedPaths, setFavoritedPaths] = useState<Set<string>>(new Set());

  // File properties state
  const [propertiesVisible, setPropertiesVisible] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');

  // User home directory
  const [userHomeDir, setUserHomeDir] = useState<string>('/Users/www1');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchMode, setGlobalSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedPaths, setSearchedPaths] = useState<Set<string>>(new Set());

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; record: FileItem | null }>({
    visible: false,
    x: 0,
    y: 0,
    record: null,
  });

  const { currentPath, setCurrentPath } = useFileStore();
  const API_BASE_URL = import.meta.env.VITE_API_URL;

  const loadFiles = async (path?: string) => {
    const targetPath = path || currentPath;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/list?path=${encodeURIComponent(targetPath)}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setFiles(data || []);
        setRefreshKey(prev => prev + 1);  // 强制刷新
      } else {
        message.error('加载文件列表失败');
      }
    } catch (error) {
      console.error('Load files error:', error);
      message.error('加载失败');
    }
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    loadFavorites();
    loadUserHomeDir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // 处理 URL 参数中的 path（用于从其他页面跳转到指定目录）
  useEffect(() => {
    const pathParam = searchParams.get('path');
    if (pathParam) {
      setCurrentPath(pathParam);
      loadFiles(pathParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, visible: false, record: null });
    if (contextMenu.visible) { document.addEventListener('click', handleClick); return () => document.removeEventListener('click', handleClick); }
  }, [contextMenu.visible]);

  // Global drag and drop handlers
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(prev => prev + 1);
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(prev => prev - 1);
      if (dragCounter - 1 === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragCounter(0);
      setIsDragging(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        // 自动开始上传，不打开对话框
        handleAutoUpload(files);
      }
    };

    // Add event listeners to document
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [dragCounter]);

  const getFileLanguage = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
      php: 'php', html: 'html', css: 'css', json: 'json',
      md: 'markdown', sql: 'sql', sh: 'shell', yml: 'yaml', yaml: 'yaml',
      txt: 'plaintext', xml: 'xml', svg: 'xml', rs: 'rust', go: 'go',
      rb: 'ruby', kt: 'kotlin', swift: 'swift'
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const handleCreate = async (values: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/create`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentPath, type: values.type, name: values.name }) });
      if (response.ok) { message.success('创建成功'); setCreateModalOpen(false); createForm.resetFields(); loadFiles(); }
    } catch (error) { message.error('创建失败'); }
  };

  const handleQuickCreateFile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, type: 'file' })
      });
      if (response.ok) {
        const result = await response.json();
        message.success(`已创建: ${result.name}`);
        loadFiles();
      } else {
        const error = await response.json();
        message.error(error.error || '文件创建失败');
      }
    } catch (error) {
      message.error('文件创建失败');
    }
  };

  const handleQuickCreateFolder = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, type: 'directory' })
      });
      if (response.ok) {
        const result = await response.json();
        message.success(`已创建: ${result.name}`);
        loadFiles();
      } else {
        const error = await response.json();
        message.error(error.error || '文件夹创建失败');
      }
    } catch (error) {
      message.error('文件夹创建失败');
    }
  };

  // Load favorites
  const loadFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/favorites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
        // Update favorited paths set
        const paths = new Set(data.map((fav: any) => fav.path));
        setFavoritedPaths(paths);
      }
    } catch (error) {
      message.error('加载收藏失败');
    } finally {
      setFavoritesLoading(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (file: FileItem) => {
    try {
      const token = localStorage.getItem('token');
      const isFav = favoritedPaths.has(file.path);

      if (isFav) {
        // Remove from favorites
        const response = await fetch(`${API_BASE_URL}/api/files/favorites/remove`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path })
        });
        if (response.ok) {
          message.success('已取消收藏');
          setFavoritedPaths(prev => {
            const newSet = new Set(prev);
            newSet.delete(file.path);
            return newSet;
          });
          loadFavorites();
        }
      } else {
        // Add to favorites
        const response = await fetch(`${API_BASE_URL}/api/files/favorites/add`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path, name: file.name, type: file.type })
        });
        if (response.ok) {
          message.success('收藏成功');
          setFavoritedPaths(prev => new Set([...prev, file.path]));
          loadFavorites();
        }
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // Navigate to favorite
  const handleNavigateToFavorite = (fav: any) => {
    const dirPath = fav.path.substring(0, fav.path.lastIndexOf('/'));
    setCurrentPath(dirPath || '/');
    setFavoritesVisible(false);
    loadFiles();
  };

  const handleOpenTerminal = () => {
    // Navigate to terminal page with current path as working directory
    navigate(`/terminal?workdir=${encodeURIComponent(currentPath)}`);
  };

  // Load user home directory
  const loadUserHomeDir = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/home-dir`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserHomeDir(data.homeDir);
      }
    } catch (error) {
      console.error('Failed to load user home directory:', error);
    }
  };

  const handleGoToUserHome = () => {
    // Navigate to user home directory
    setCurrentPath(userHomeDir);
    loadFiles(userHomeDir);
  };

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/delete`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: selectedRowKeys }) });
      if (response.ok) { message.success('删除成功'); setSelectedRowKeys([]); loadFiles(); }
    } catch (error) { message.error('删除失败'); }
  };

  const handleEdit = async (path: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/content?path=${encodeURIComponent(path)}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setEditorContent(data.content || ''); setCurrentEditPath(path); setCurrentLanguage(getFileLanguage(path)); setEditModalOpen(true); }
    } catch (error) { message.error('读取失败'); }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/save`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentEditPath, content: editorContent }) });
      if (response.ok) {
        message.success('保存成功');
        setEditModalOpen(false);
        loadFiles();
      } else {
        const error = await response.json();
        message.error(`保存失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存文件错误:', error);
      message.error('保存失败');
    }
  };

  const handleCopy = () => {
    if (selectedItems.length === 0) return message.warning('请先选择文件');
    setClipboard(selectedItems.map((item) => ({ path: item.path, name: item.name, type: 'copy' as const })));
    message.success(`已复制 ${selectedItems.length} 个文件`);
  };

  const handleCut = () => {
    if (selectedItems.length === 0) return message.warning('请先选择文件');
    setClipboard(selectedItems.map((item) => ({ path: item.path, name: item.name, type: 'cut' as const })));
    message.success(`已剪切 ${selectedItems.length} 个文件`);
  };

  const handlePaste = async () => {
    if (clipboard.length === 0) return message.warning('剪贴板为空');
    try {
      const token = localStorage.getItem('token');
      for (const item of clipboard) {
        const endpoint = item.type === 'cut' ? '/api/files/move' : '/api/files/copy';
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourcePath: item.path, targetPath: `${currentPath}/${item.name}` }) });
        if (!response.ok) {
          const error = await response.json();
          message.error(`${item.name} ${item.type === 'cut' ? '移动' : '复制'}失败: ${error.error || '未知错误'}`);
          return;
        }
      }
      message.success(`成功${clipboard[0].type === 'cut' ? '移动' : '复制'} ${clipboard.length} 个文件`);
      setClipboard([]);
      loadFiles();
    } catch (error: any) { message.error(`操作失败: ${error.message || '未知错误'}`); }
  };

  const handleCompress = async (values: any) => {
    if (selectedRowKeys.length === 0) return message.warning('请先选择要压缩的文件');
    try {
      const token = localStorage.getItem('token');
      const { name, format } = values;
      const archiveName = name.endsWith(format) ? name : `${name}.${format}`;
      const response = await fetch(`${API_BASE_URL}/api/files/compress`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paths: selectedRowKeys, targetPath: `${currentPath}/${archiveName}`, format }) });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          message.success(`压缩成功，文件大小: ${formatSize(result.size || 0)}`);
          setCompressModalOpen(false);
          compressForm.resetFields();
          loadFiles();
        } else {
          message.error(`压缩失败: ${result.error || '未知错误'}`);
        }
      } else {
        const error = await response.json();
        message.error(`压缩失败: ${error.error || '未知错误'}`);
      }
    } catch (error: any) { message.error(`压缩失败: ${error.message || '未知错误'}`); }
  };

  const handleExtract = async () => {
    if (!extractFile) return;
    try {
      const token = localStorage.getItem('token');
      const values = await extractForm.validateFields();
      const destPath = values.destinationPath || currentPath;
      const response = await fetch(`${API_BASE_URL}/api/files/extract`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: extractFile.path, targetPath: destPath })  // 修复：改为 targetPath
      });
      if (response.ok) {
        message.success('解压成功');
        setExtractModalOpen(false);
        extractForm.resetFields();
        loadFiles();  // 刷新文件列表
      } else {
        const error = await response.json();
        message.error(`解压失败: ${error.error || '未知错误'}`);
      }
    } catch (error: any) {
      message.error(`解压失败: ${error.message || '未知错误'}`);
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (file.type === 'directory') return message.warning('不能下载文件夹');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/download?path=${encodeURIComponent(file.path)}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('下载成功');
      }
    } catch (error) { message.error('下载失败'); }
  };

  const handleRename = async (path: string, oldName: string) => {
    let newName = '';
    Modal.confirm({
      title: '重命名',
      content: <Input id="rename-input" defaultValue={oldName} onChange={(e) => newName = e.target.value} onPressEnter={() => { if (newName && newName !== oldName) performRename(path, newName); }} />,
      onOk: () => { if (newName && newName !== oldName) performRename(path, newName); }
    });
  };

  const performRename = async (path: string, newName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/rename`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ path, newName }) });
      if (response.ok) { message.success('重命名成功'); loadFiles(); }
    } catch (error) { message.error('重命名失败'); }
  };

  const handleUrlDownload = async () => {
    try {
      const values = await urlDownloadForm.validateFields();
      const { url, filename } = values;

      setUrlDownloading(true);
      setUrlDownloadProgress(0);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/download-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          path: currentPath,
          filename: filename || undefined,
        }),
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        if (!reader) {
          const result = await response.json();
          if (result.success) {
            message.success(`下载成功: ${result.filename || '文件'}`);
            setUrlDownloadModalOpen(false);
            urlDownloadForm.resetFields();
            loadFiles();
          } else {
            message.error(`下载失败: ${result.error || '未知错误'}`);
          }
          setUrlDownloading(false);
          return;
        }

        const contentLength = response.headers.get('Content-Length');
        let receivedLength = 0;
        const chunks: BlobPart[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          if (contentLength) {
            const percent = Math.round((receivedLength / parseInt(contentLength)) * 100);
            setUrlDownloadProgress(percent);
          }
        }

        const blob = new Blob(chunks, { type: 'application/octet-stream' });
        message.success(`下载成功，文件大小: ${formatSize(blob.size)}`);
        setUrlDownloadModalOpen(false);
        urlDownloadForm.resetFields();
        loadFiles();
      } else {
        const error = await response.json();
        message.error(`下载失败: ${error.error || '未知错误'}`);
      }
    } catch (error: any) {
      message.error(`下载失败: ${error.message || '未知错误'}`);
    } finally {
      setUrlDownloading(false);
      setUrlDownloadProgress(0);
    }
  };

  // Recycle bin functions
  const loadRecycleBinItems = async () => {
    setRecycleBinLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/recycle-bin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRecycleBinItems(data || []);
      } else {
        message.error('加载回收站失败');
      }
    } catch (error) {
      console.error('Load recycle bin error:', error);
      message.error('加载回收站失败');
    } finally {
      setRecycleBinLoading(false);
    }
  };

  const restoreFromRecycleBin = async (recycleName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recycleName })
      });
      if (response.ok) {
        message.success('恢复成功');
        loadRecycleBinItems();
        loadFiles(); // Refresh current file list
      } else {
        const error = await response.json();
        message.error(`恢复失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      message.error('恢复失败');
    }
  };

  const permanentDelete = async (recycleName: string) => {
    Modal.confirm({
      title: '确认永久删除',
      content: '确定要永久删除此文件吗？此操作不可撤销！',
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/files/permanent-delete`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recycleName })
          });
          if (response.ok) {
            message.success('已永久删除');
            loadRecycleBinItems();
          } else {
            const error = await response.json();
            message.error(`删除失败: ${error.error || '未知错误'}`);
          }
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const emptyRecycleBin = async () => {
    Modal.confirm({
      title: '确认清空回收站',
      content: '确定要清空回收站吗？此操作将永久删除所有文件，不可撤销！',
      okText: '确定清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/files/empty-recycle-bin`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            message.success('回收站已清空');
            loadRecycleBinItems();
          } else {
            message.error('清空失败');
          }
        } catch (error) {
          message.error('清空失败');
        }
      }
    });
  };

  // Load recycle bin items when drawer opens
  useEffect(() => {
    if (recycleBinVisible) {
      loadRecycleBinItems();
    }
  }, [recycleBinVisible]);

  const handleUpload = async (options: any) => {
    const { file, onProgress, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('files', file);  // 修复：改为 'files' 以匹配后端
    formData.append('path', currentPath);  // 添加 path 到 body
    setUploading(true);
    setUploadProgress(0);
    try {
      const token = localStorage.getItem('token');
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
          onProgress({ percent }, file);
        }
      };
      xhr.onload = () => {
        setUploading(false);
        if (xhr.status === 200) {
          message.success(`${file.name} 上传成功`);
          onSuccess(xhr.response, file);
          // 单文件上传完成，从列表中移除
          setUploadFileList(prev => prev.filter(f => f.uid !== file.uid));
          // 如果所有文件都上传完成，刷新列表并关闭模态框
          if (uploadFileList.length === 1) {
            loadFiles();  // 刷新文件列表
            setUploadModalOpen(false);  // 关闭模态框
          }
        } else {
          message.error(`${file.name} 上传失败`);
          onError(new Error('Upload failed'), file);
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        message.error(`${file.name} 上传失败`);
        onError(new Error('Upload failed'), file);
      };
      xhr.open('POST', `${API_BASE_URL}/api/files/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    } catch (error) {
      setUploading(false);
      message.error('上传失败');
      onError(error, file);
    }
  };

  // Handle multiple files upload
  const handleMultipleFilesUpload = async () => {
    if (droppedFiles.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    droppedFiles.forEach(file => {
      formData.append('files', file);
    });
    formData.append('path', currentPath);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        message.success(`成功上传 ${result.count || droppedFiles.length} 个文件`);
        setUploadFileList([]);
        setDroppedFiles([]);
        await loadFiles();
        setUploadModalOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        message.error(`上传失败: ${errorData.error || 'Unknown error'}`);
        console.error('Upload failed:', errorData);
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  // Auto upload files (for drag and drop)
  const handleAutoUpload = async (files: File[]) => {
    setUploading(true);

    console.log('开始自动上传:', {
      fileCount: files.length,
      fileNames: files.map(f => f.name),
      currentPath,
      totalSize: files.reduce((sum, f) => sum + f.size, 0)
    });

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('path', currentPath);

      const token = localStorage.getItem('token');
      console.log('发送上传请求到:', `${API_BASE_URL}/api/files/upload`);

      // 增加超时时间到 10 分钟
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('上传响应状态:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('上传成功:', result);
        message.success(`成功上传 ${result.count || files.length} 个文件`);
        await loadFiles();
        console.log('文件列表已刷新');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('上传失败:', errorData);
        message.error(`上传失败: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('上传异常:', error);

      if (error.name === 'AbortError') {
        message.error('上传超时：文件太大或网络太慢，请尝试更小的文件');
      } else if (error.message?.includes('Connection reset') || error.message?.includes('ERR_CONNECTION_RESET')) {
        message.error('连接被重置：文件太大超过服务器限制（最大5GB）');
      } else {
        message.error(`上传失败: ${error.message || '未知错误'}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter && sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order);
    }
  };

  // 全盘搜索文件和文件夹
  const searchFilesGlobally = async (pattern: string, searchPath: string = '/'): Promise<FileItem[]> => {
    // 防止循环搜索
    if (searchedPaths.has(searchPath)) {
      return [];
    }

    setSearchedPaths(prev => new Set([...prev, searchPath]));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/list?path=${encodeURIComponent(searchPath)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const results: FileItem[] = [];

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
            const subResults = await searchFilesGlobally(pattern, item.path);
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

  // 执行全盘搜索
  const handleGlobalSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    setSearching(true);
    setGlobalSearchMode(true);
    setSearchResults([]);
    setSearchedPaths(new Set());

    try {
      const results = await searchFilesGlobally(searchQuery);
      setSearchResults(results);
      message.success(`找到 ${results.length} 个匹配项`);
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setSearching(false);
      setSearchedPaths(new Set());
    }
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchQuery('');
    setGlobalSearchMode(false);
    setSearchResults([]);
    setSearchedPaths(new Set());
  };

  // 跳转到搜索结果的路径
  const navigateToPath = (path: string) => {
    const isDirectory = searchResults.find(f => f.path === path)?.type === 'directory';

    if (isDirectory) {
      // 如果是目录，直接进入
      setCurrentPath(path);
    } else {
      // 如果是文件，进入其父目录
      const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
      setCurrentPath(parentPath);
    }

    // 退出搜索模式
    setGlobalSearchMode(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  const getSortedFiles = () => {
    let result = [...files];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(file =>
        file.name.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortField && sortOrder) {
      result.sort((a, b) => {
        if (sortField === 'modified') {
          const dateA = new Date(a.modified).getTime();
          const dateB = new Date(b.modified).getTime();
          return sortOrder === 'ascend' ? dateA - dateB : dateB - dateA;
        }
        if (sortField === 'size') {
          return sortOrder === 'ascend' ? a.size - b.size : b.size - a.size;
        }
        if (sortField === 'name') {
          return sortOrder === 'ascend'
            ? a.name.localeCompare(b.name, 'zh-CN')
            : b.name.localeCompare(a.name, 'zh-CN');
        }
        return 0;
      });
    }

    return result;
  };

  const handleFileClick = (record: FileItem) => {
    if (record.type === 'directory') {
      setCurrentPath(record.path);
    } else {
      // 检查是否为图片文件
      if (isImage(record.name)) {
        // 打开图片预览
        openImagePreview(record);
      } else if (isEditable(record.name)) {
        // 检查是否为可编辑的文本/代码文件
        // 使用悬浮编辑器打开文件
        openFileInEditor(record.path, record.name);
      } else if (isArchive(record.name)) {
        // 压缩文件：弹出解压对话框
        setExtractFile(record);
        extractForm.setFieldsValue({ destinationPath: currentPath });
        setExtractModalOpen(true);
      } else {
        // 其他文件：下载
        handleDownload(record);
      }
    }
  };

  // 双击行打开文件
  const handleRowDoubleClick = (record: FileItem) => {
    handleFileClick(record);
  };

  const isArchive = (name: string) => ['zip', 'tar', 'gz', 'rar', '7z'].includes(name.split('.').pop()?.toLowerCase() || '');
  const isEditable = (name: string) => ['txt', 'js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'md', 'py', 'sh', 'yml', 'yaml', 'xml', 'php', 'sql', 'java', 'cpp', 'go', 'rs', 'vue', 'scss', 'less', 'sass', 'htaccess', 'conf', 'ini', 'env', 'gitignore'].includes(name.split('.').pop()?.toLowerCase() || '');
  const isImage = (name: string) => ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'psd', 'ai', 'raw', 'heic', 'heif'].includes(name.split('.').pop()?.toLowerCase() || '');

  // 获取当前文件夹的所有图片
  const loadCurrentFolderImages = () => {
    const images = files.filter(file => file.type === 'file' && isImage(file.name));
    setCurrentFolderImages(images);
    return images;
  };

  // 加载图片 URL
  const loadImageUrl = async (imagePath: string) => {
    try {
      // 释放之前的 URL
      if (currentImageUrl) {
        URL.revokeObjectURL(currentImageUrl);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/files/download?path=${encodeURIComponent(imagePath)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setCurrentImageUrl(url);
        return url;
      }
    } catch (error) {
      console.error('Failed to load image:', error);
    }
    return '';
  };

  // 打开图片预览
  const openImagePreview = async (imageFile: FileItem) => {
    const images = loadCurrentFolderImages();
    const index = images.findIndex(img => img.path === imageFile.path);
    setCurrentImageIndex(index >= 0 ? index : 0);
    setImagePreviewVisible(true);
    await loadImageUrl(imageFile.path);
  };

  // 切换到下一张图片
  const showNextImage = async () => {
    if (currentFolderImages.length === 0) return;
    const nextIndex = (currentImageIndex + 1) % currentFolderImages.length;
    setCurrentImageIndex(nextIndex);
    await loadImageUrl(currentFolderImages[nextIndex].path);
  };

  // 切换到上一张图片
  const showPrevImage = async () => {
    if (currentFolderImages.length === 0) return;
    const prevIndex = (currentImageIndex - 1 + currentFolderImages.length) % currentFolderImages.length;
    setCurrentImageIndex(prevIndex);
    await loadImageUrl(currentFolderImages[prevIndex].path);
  };

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imagePreviewVisible) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          showPrevImage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          showNextImage();
          break;
        case 'Escape':
          e.preventDefault();
          setImagePreviewVisible(false);
          break;
      }
    };

    if (imagePreviewVisible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [imagePreviewVisible, currentImageIndex, currentFolderImages]);

  // 编辑器快捷键处理 (Ctrl+S 或 Cmd+S 保存)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // 只在编辑器打开时处理
      if (!editModalOpen) return;

      // Ctrl+S (Windows/Linux) 或 Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();

        // 直接执行保存逻辑，避免闭包问题
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/files/save`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              path: currentEditPath,
              content: editorContent
            })
          });

          if (response.ok) {
            message.success('保存成功');
            setEditModalOpen(false);
            loadFiles();
          } else {
            const error = await response.json();
            message.error(`保存失败: ${error.error || '未知错误'}`);
          }
        } catch (error) {
          console.error('保存文件错误:', error);
          message.error('保存失败');
        }
      }

      // Esc 关闭编辑器
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setEditModalOpen(false);
      }
    };

    if (editModalOpen) {
      // 使用捕获阶段，确保优先处理
      window.addEventListener('keydown', handleKeyDown, true);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [editModalOpen, currentEditPath, editorContent]); // 包含所有使用的状态

  const getFileIcon = (name: string, type: string) => {
    if (type === 'directory') {
      return <FolderOutlined style={{ color: '#1890ff', fontSize: 18 }} />;
    }

    const ext = name.split('.').pop()?.toLowerCase() || '';

    // 图片文件
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'ico', 'webp', 'tiff', 'psd', 'ai'].includes(ext)) {
      return <PictureOutlined style={{ color: '#9254de', fontSize: 18 }} />;
    }

    // 视频文件
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp'].includes(ext)) {
      return <VideoCameraOutlined style={{ color: '#f5222d', fontSize: 18 }} />;
    }

    // 音频文件
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'].includes(ext)) {
      return <AudioOutlined style={{ color: '#fa8c16', fontSize: 18 }} />;
    }

    // PDF 文件
    if (ext === 'pdf') {
      return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
    }

    // Office 文件
    if (['doc', 'docx'].includes(ext)) {
      return <FileWordOutlined style={{ color: '#1890ff', fontSize: 18 }} />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileExcelOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return <FilePptOutlined style={{ color: '#fa8c16', fontSize: 18 }} />;
    }

    // Markdown 文件
    if (ext === 'md') {
      return <FileMarkdownOutlined style={{ color: '#722ed1', fontSize: 18 }} />;
    }

    // 代码文件
    if (['js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'less', 'json', 'xml', 'py', 'java', 'cpp', 'go', 'rs', 'php', 'rb', 'kt', 'swift', 'dart', 'sql', 'sh', 'yml', 'yaml'].includes(ext)) {
      return <CodeOutlined style={{ color: '#13c2c2', fontSize: 18 }} />;
    }

    // 压缩文件
    if (isArchive(name)) {
      return <FileZipOutlined style={{ color: '#faad14', fontSize: 18 }} />;
    }

    // 数据库文件
    if (['db', 'sqlite', 'mdb', 'sql', 'mysql', 'pgsql'].includes(ext)) {
      return <DatabaseOutlined style={{ color: '#2f54eb', fontSize: 18 }} />;
    }

    // API/配置文件
    if (['api', 'swagger', 'openapi', 'conf', 'config', 'ini', 'env', 'htaccess', 'nginx', 'apache'].includes(ext)) {
      return <ApiOutlined style={{ color: '#eb2f96', fontSize: 18 }} />;
    }

    // 可执行文件
    if (['exe', 'msi', 'app', 'dmg', 'deb', 'rpm', 'sh', 'bat', 'cmd'].includes(ext)) {
      return <SettingOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
    }

    // 文本文件
    if (isEditable(name)) {
      return <FileTextOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    }

    // 默认文件图标
    return <FileOutlined style={{ fontSize: 18 }} />;
  };

  const getContextMenuItems = (record: FileItem) => {
    const closeMenu = () => setContextMenu({ ...contextMenu, visible: false, record: null });
    const items: any[] = [{ key: 'open', label: record.type === 'directory' ? '打开文件夹' : '打开文件', icon: <FolderOutlined />, onClick: () => { closeMenu(); handleFileClick(record); } }];
    if (record.type === 'file') { items.push({ key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => { closeMenu(); openFileInEditor(record.path, record.name); } }, { key: 'download', label: '下载', icon: <DownloadOutlined />, onClick: () => { closeMenu(); handleDownload(record); } }); }
    items.push({ key: 'rename', label: '重命名', icon: <EditOutlined />, onClick: () => { closeMenu(); handleRename(record.path, record.name); } }, { key: 'copy', label: '复制', icon: <CopyOutlined />, onClick: () => { closeMenu(); setSelectedItems([record]); setSelectedRowKeys([record.path]); handleCopy(); } }, { key: 'cut', label: '剪切', icon: <ScissorOutlined />, onClick: () => { closeMenu(); setSelectedItems([record]); setSelectedRowKeys([record.path]); handleCut(); } });
    if (isArchive(record.name)) { items.push({ key: 'extract', label: '解压', icon: <FolderOpenOutlined />, onClick: () => { closeMenu(); setExtractFile(record); extractForm.setFieldsValue({ destinationPath: currentPath }); setExtractModalOpen(true); } }); }
    items.push({ type: 'divider' }, { key: 'properties', label: '属性', icon: <InfoCircleOutlined />, onClick: () => { closeMenu(); setSelectedFilePath(record.path); setPropertiesVisible(true); } }, { key: 'delete', label: '删除', danger: true, icon: <DeleteOutlined />, onClick: () => { closeMenu(); setSelectedItems([record]); setSelectedRowKeys([record.path]); Modal.confirm({ title: '确认删除', content: `确定要删除 ${record.name} 吗？`, onOk: handleDelete }); } });
    return items;
  };

  // 面包屑导航项生成
  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path);
    loadFiles(path);  // 立即加载新路径的文件
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', sorter: true, sortOrder: sortField === 'name' ? sortOrder : null, render: (name: string, record: FileItem) => (<Space>{getFileIcon(name, record.type)}<span className="file-name" onClick={() => handleFileClick(record)} style={{ cursor: 'pointer' }}>{name}</span></Space>) },
    { title: '大小', dataIndex: 'size', key: 'size', sorter: true, sortOrder: sortField === 'size' ? sortOrder : null, render: (size: number, record: FileItem) => (record.type === 'directory' ? '-' : formatSize(size)) },
    { title: '权限', dataIndex: 'permissions', key: 'permissions', render: (permissions: string) => <Tag color="blue">{permissions}</Tag> },
    { title: '修改时间', dataIndex: 'modified', key: 'modified', sorter: true, sortOrder: sortField === 'modified' ? sortOrder : null, render: (date: string) => new Date(date).toLocaleString('zh-CN') },
    { title: '操作', key: 'action', render: (_: any, record: FileItem) => (<Space size="small">{record.type === 'file' && isEditable(record.name) && <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openFileInEditor(record.path, record.name)} title="编辑" />}<Button type="text" size="small" icon={favoritedPaths.has(record.path) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} onClick={() => handleToggleFavorite(record)} title={favoritedPaths.has(record.path) ? '取消收藏' : '收藏'} /><Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)} title="下载" /><Dropdown menu={{ items: getContextMenuItems(record) }} trigger={['click']}><Button type="text" size="small">•••</Button></Dropdown></Space>) },
  ];

  return (
    <div
      className="files-page"
      onDragEnter={(e) => {
        e.preventDefault();
        setDragCounter(prev => prev + 1);
        setIsDragging(true);
      }}
    >
      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(24, 144, 255, 0.1)',
            border: '3px dashed #1890ff',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '40px 60px',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
              textAlign: 'center'
            }}
          >
            <UploadOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '16px' }} />
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
              释放文件即可上传
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              支持多个文件同时上传
            </div>
          </div>
        </div>
      )}

      <div className="files-header">
        <div className="files-nav">
          <div className="files-nav-left">
            {/* 面包屑导航 - 使用 Breadcrumb.Item 方式 */}
            <Breadcrumb style={{ marginRight: 16 }}>
              <Breadcrumb.Item>
                <span onClick={() => handleBreadcrumbClick('/')} style={{ cursor: 'pointer', color: '#1890ff' }}>
                  <HomeOutlined />
                </span>
              </Breadcrumb.Item>
              {currentPath.split('/').filter(Boolean).map((part, index, parts) => {
                const path = '/' + parts.slice(0, index + 1).join('/');
                return (
                  <Breadcrumb.Item key={path}>
                    <span onClick={() => handleBreadcrumbClick(path)} style={{ cursor: 'pointer', color: '#1890ff' }}>
                      {part}
                    </span>
                  </Breadcrumb.Item>
                );
              })}
            </Breadcrumb>

            <Space.Compact style={{ width: 250, marginRight: 16 }}>
              <Input
                placeholder="搜索文件..."
                prefix={<SearchOutlined />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPressEnter={handleGlobalSearch}
                allowClear
                onClear={clearSearch}
                size="small"
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleGlobalSearch}
                loading={searching}
                title="全盘搜索 (支持 * ? 通配符)"
              >
                搜索
              </Button>
            </Space.Compact>
            <Button icon={<HomeOutlined />} onClick={handleGoToUserHome} title="跳转到用户主目录">用户目录</Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadFiles()}>刷新</Button>
          </div>
          <div className="files-nav-right">
            <Button icon={<DeleteOutlined />} onClick={() => setRecycleBinVisible(true)}>
              回收站 {recycleBinItems.length > 0 && <span style={{ marginLeft: 4, background: '#ff4d4f', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 12 }}>{recycleBinItems.length}</span>}
            </Button>
          </div>
        </div>
        <Space className="files-actions" wrap>
          <Button icon={<StarFilled />} onClick={() => { setFavoritesVisible(true); loadFavorites(); }}>
            收藏 {favorites.length > 0 && <span style={{ marginLeft: 4, background: '#faad14', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 12 }}>{favorites.length}</span>}
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>上传</Button>
          <Button icon={<DownloadOutlined />} onClick={() => setUrlDownloadModalOpen(true)}>URL下载</Button>
          {clipboard.length > 0 && <Button type="primary" icon={<SnippetsOutlined />} onClick={handlePaste}>粘贴 ({clipboard.length})</Button>}
          <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={selectedItems.length === 0}>复制</Button>
          <Button icon={<ScissorOutlined />} onClick={handleCut} disabled={selectedItems.length === 0}>剪切</Button>
          <Button icon={<FileZipOutlined />} onClick={() => setCompressModalOpen(true)} disabled={selectedItems.length === 0}>压缩</Button>
          <Popconfirm title="确定要删除选中的文件吗？" onConfirm={handleDelete} okText="确定" cancelText="取消"><Button danger icon={<DeleteOutlined />} disabled={selectedItems.length === 0}>删除</Button></Popconfirm>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'file',
                  icon: <FileAddOutlined />,
                  label: '新建文件',
                  onClick: () => handleQuickCreateFile()
                },
                {
                  key: 'folder',
                  icon: <FolderAddOutlined />,
                  label: '新建文件夹',
                  onClick: () => handleQuickCreateFolder()
                },
                {
                  type: 'divider'
                },
                {
                  key: 'advanced',
                  label: '自定义新建',
                  onClick: () => setCreateModalOpen(true)
                }
              ]
            }}
            trigger={['click']}
          >
          </Dropdown>
          <Button icon={<CodeOutlined />} onClick={handleOpenTerminal} title="在当前目录打开终端">终端</Button>
        </Space>
      </div>
      {clipboard.length > 0 && <Alert message={`剪贴板: ${clipboard.length} 个文件`} description={clipboard.map(c => c.name).join(', ')} type="info" closable onClose={() => setClipboard([])} style={{ marginBottom: 16 }} />}
      <Table
        key={refreshKey}
        columns={columns}
        dataSource={getSortedFiles()}
        rowKey="path"
        loading={loading}
        pagination={false}
        onChange={handleTableChange}
        scroll={{ x: 'max-content' }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => {
            setSelectedRowKeys(keys);
            setSelectedItems(files.filter(f => keys.includes(f.path)));
          }
        }}
        onRow={(record) => ({
          onContextMenu: (e) => {
            e.preventDefault();
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, record });
          },
          onDoubleClick: () => {
            handleRowDoubleClick(record);
          }
        })}
      />

      {/* 全盘搜索结果 */}
      {globalSearchMode && (
        <div style={{ marginTop: 16 }}>
          <Alert
            message={
              <Space>
                <span>搜索结果: 找到 {searchResults.length} 个匹配 "{searchQuery}"</span>
                <Button type="link" size="small" onClick={clearSearch}>清除搜索</Button>
              </Space>
            }
            type="info"
            closable
            onClose={clearSearch}
            style={{ marginBottom: 12 }}
          />
          {searching ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="正在搜索..." />
            </div>
          ) : searchResults.length === 0 ? (
            <Empty description="未找到匹配的文件或文件夹" />
          ) : (
            <Table
              columns={[
                {
                  title: '名称',
                  dataIndex: 'name',
                  key: 'name',
                  render: (name: string, record: FileItem) => (
                    <Space>
                      {getFileIcon(name, record.type)}
                      <span
                        className="file-name"
                        onClick={() => navigateToPath(record.path)}
                        style={{ cursor: 'pointer', color: '#1890ff' }}
                      >
                        {name}
                      </span>
                    </Space>
                  )
                },
                {
                  title: '路径',
                  dataIndex: 'path',
                  key: 'path',
                  render: (path: string) => (
                    <Tag color="blue" style={{ fontSize: '12px', maxWidth: 400 }}>
                      {path}
                    </Tag>
                  )
                },
                { title: '大小', dataIndex: 'size', key: 'size', render: (size: number, record: FileItem) => (record.type === 'directory' ? '-' : formatSize(size)) },
                { title: '修改时间', dataIndex: 'modified', key: 'modified', render: (date: string) => new Date(date).toLocaleString('zh-CN') }
              ]}
              dataSource={searchResults}
              rowKey="path"
              pagination={{ pageSize: 20 }}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          )}
        </div>
      )}

      {contextMenu.visible && contextMenu.record && (<div className="context-menu" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '4px 0', minWidth: '180px', border: '1px solid #e8e8e8' }} onClick={(e) => e.stopPropagation()}>{getContextMenuItems(contextMenu.record).map((item: any) => item.type === 'divider' ? (<div key={item.key} style={{ borderBottom: '1px solid #e8e8e8', margin: '4px 0' }} />) : (<div key={item.key} onClick={item.onClick} style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: item.danger ? '#ff4d4f' : 'inherit' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>{item.icon}<span>{item.label}</span></div>))}</div>)}

      <Modal title="新建" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} footer={null}>
        <Form form={createForm} onFinish={handleCreate} layout="vertical">
          <Form.Item name="type" label="类型" rules={[{ required: true }]} initialValue="file"><Space><Button onClick={() => createForm.setFieldsValue({ type: 'file' })}>文件</Button><Button onClick={() => createForm.setFieldsValue({ type: 'directory' })}>文件夹</Button></Space></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="请输入名称" /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" block>创建</Button></Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`上传文件${droppedFiles.length > 0 ? ` (${droppedFiles.length} 个文件)` : ''}`}
        open={uploadModalOpen}
        onCancel={() => { if (!uploading) { setUploadModalOpen(false); setUploadFileList([]); setDroppedFiles([]); } }}
        footer={
          <Space>
            <Button onClick={() => { if (!uploading) { setUploadModalOpen(false); setUploadFileList([]); setDroppedFiles([]); } }} disabled={uploading}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleMultipleFilesUpload}
              disabled={droppedFiles.length === 0 || uploading}
              loading={uploading}
            >
              {uploading ? '上传中...' : '开始上传'}
            </Button>
          </Space>
        }
        width={600}
      >
        {droppedFiles.length > 0 && (
          <Alert
            message={`已选择 ${droppedFiles.length} 个文件，总大小: ${formatSize(droppedFiles.reduce((sum, f) => sum + f.size, 0))}`}
            description={droppedFiles.map(f => f.name).join(', ')}
            type="info"
            style={{ marginBottom: 16 }}
          />
        )}
        <Upload.Dragger
          name="files"
          multiple
          fileList={uploadFileList}
          customRequest={handleUpload}
          showUploadList={true}
          disabled={uploading}
          onChange={({ fileList }) => {
            setUploadFileList(fileList);
            const files = fileList.filter(f => f.originFileObj).map(f => f.originFileObj);
            setDroppedFiles(files);
          }}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持多文件同时上传 • 选择文件后点击"开始上传"按钮
            <br />
            <span style={{ color: '#1890ff', fontWeight: 'bold' }}>💡 提示：直接拖拽文件到页面任意位置可自动上传</span>
          </p>
        </Upload.Dragger>
        {uploading && <Progress percent={uploadProgress} status="active" />}
      </Modal>
      <Modal title="压缩文件" open={compressModalOpen} onCancel={() => setCompressModalOpen(false)} footer={null}>
        <Form form={compressForm} onFinish={handleCompress} layout="vertical">
          <Form.Item name="name" label="压缩包名称" rules={[{ required: true }]} initialValue="archive"><Input placeholder="archive" /></Form.Item>
          <Form.Item name="format" label="压缩格式" rules={[{ required: true }]} initialValue="zip">
            <Radio.Group>
              <Radio value="zip">ZIP (.zip)</Radio>
              <Radio value="tar.gz">TAR.GZ (.tar.gz)</Radio>
              <Radio value="tar">TAR (.tar)</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" block>开始压缩</Button></Form.Item>
        </Form>
      </Modal>
      <Modal title="URL下载" open={urlDownloadModalOpen} onCancel={() => setUrlDownloadModalOpen(false)} footer={null}>
        <Form form={urlDownloadForm} onFinish={handleUrlDownload} layout="vertical">
          <Form.Item name="url" label="文件 URL" rules={[{ required: true, message: '请输入文件URL' }]}>
            <Input placeholder="https://example.com/file.zip" />
          </Form.Item>
          <Form.Item name="filename" label="保存文件名（可选）" extra="留空则自动从URL获取文件名">
            <Input placeholder="example.zip" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={urlDownloading}>
              {urlDownloading ? `下载中... ${urlDownloadProgress}%` : '开始下载'}
            </Button>
          </Form.Item>
          {urlDownloading && <Progress percent={urlDownloadProgress} status="active" />}
        </Form>
      </Modal>
      <Modal title={`解压文件: ${extractFile?.name || ''}`} open={extractModalOpen} onCancel={() => setExtractModalOpen(false)} footer={null}>
        <Form form={extractForm} onFinish={handleExtract} layout="vertical">
          <Form.Item name="destinationPath" label="解压目录" rules={[{ required: true, message: '请输入解压目录' }]} initialValue={currentPath}><Input placeholder={currentPath} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit" block>开始解压</Button></Form.Item>
        </Form>
      </Modal>

      {/* 图片预览模态框 */}
      <Modal
        open={imagePreviewVisible}
        onCancel={() => {
          setImagePreviewVisible(false);
          if (currentImageUrl) {
            URL.revokeObjectURL(currentImageUrl);
            setCurrentImageUrl('');
          }
        }}
        footer={null}
        width="90%"
        style={{ top: 20 }}
        bodyStyle={{ padding: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}
        closable
        maskClosable
        keyboard
      >
        {currentFolderImages.length > 0 && (
          <div style={{ position: 'relative', width: '100%', height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* 图片信息 */}
            <div style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#fff',
              fontSize: '14px',
              zIndex: 10,
              background: 'rgba(0, 0, 0, 0.6)',
              padding: '8px 16px',
              borderRadius: '4px',
              whiteSpace: 'nowrap'
            }}>
              {currentFolderImages[currentImageIndex]?.name} ({currentImageIndex + 1} / {currentFolderImages.length})
            </div>

            {/* 上一张按钮 */}
            {currentFolderImages.length > 1 && (
              <Button
                type="text"
                icon={<span style={{ fontSize: '32px', color: '#fff' }}>‹</span>}
                onClick={showPrevImage}
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: 'none',
                  color: '#fff'
                }}
              />
            )}

            {/* 图片 */}
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={currentFolderImages[currentImageIndex]?.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij7liqDovb3kuK08L3RleHQ+PC9zdmc+';
                }}
              />
            ) : (
              <Spin size="large" tip="加载中..." />
            )}

            {/* 下一张按钮 */}
            {currentFolderImages.length > 1 && (
              <Button
                type="text"
                icon={<span style={{ fontSize: '32px', color: '#fff' }}>›</span>}
                onClick={showNextImage}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: 'none',
                  color: '#fff'
                }}
              />
            )}

            {/* 操作提示 */}
            {currentFolderImages.length > 1 && (
              <div style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                color: '#fff',
                fontSize: '12px',
                zIndex: 10,
                background: 'rgba(0, 0, 0, 0.6)',
                padding: '6px 12px',
                borderRadius: '4px'
              }}>
                使用 ← ↑ → ↓ 键切换图片 • ESC 关闭
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <span>编辑文件: {currentEditPath.split('/').pop()}</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              (Ctrl+S / Cmd+S 保存，Esc 关闭)
            </Text>
          </Space>
        }
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        width="90%"
        style={{ top: 20 }}
        footer={[
          <Button key="cancel" onClick={() => setEditModalOpen(false)}>取消</Button>,
          <Button key="save" type="primary" onClick={handleSave}>保存 (Ctrl+S)</Button>
        ]}
      >
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4 }}>
          <Editor
            height="calc(100vh - 250px)"
            language={currentLanguage}
            theme="vs-dark"
            value={editorContent}
            onChange={(value) => setEditorContent(value || '')}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
            }}
          />
        </div>
      </Modal>

      {/* 文件属性对话框 */}
      <FileProperties
        visible={propertiesVisible}
        onClose={() => setPropertiesVisible(false)}
        filePath={selectedFilePath}
        onSuccess={() => {
          loadFiles();
          setPropertiesVisible(false);
        }}
      />

      {/* Recycle Bin Drawer */}
      <Drawer
        title={
          <Space>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            <span>回收站</span>
            <Tag color={recycleBinItems.length > 0 ? 'red' : 'default'}>
              {recycleBinItems.length} 个文件
            </Tag>
          </Space>
        }
        placement="right"
        width={500}
        open={recycleBinVisible}
        onClose={() => setRecycleBinVisible(false)}
        extra={
          <Button
            icon={<DeleteOutlined />}
            onClick={emptyRecycleBin}
            disabled={recycleBinItems.length === 0}
            danger
          >
            清空回收站
          </Button>
        }
      >
        {recycleBinLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="加载中..." />
          </div>
        ) : recycleBinItems.length === 0 ? (
          <Empty
            description={
              <div>
                <p>回收站为空</p>
                <p style={{ fontSize: '12px', color: '#999' }}>
                  删除的文件会移动到这里
                </p>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={recycleBinItems}
            renderItem={(item: any) => (
              <List.Item
                key={item.recycleName}
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: '#fff5f5',
                  borderLeft: '4px solid #ff4d4f',
                  display: 'block',
                  width: '100%'
                }}
              >
                <div style={{ width: '100%' }}>
                  {/* File name and icon */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    {item.type === 'directory' ? (
                      <FolderOutlined style={{ color: '#1890ff', fontSize: 18, marginRight: 8 }} />
                    ) : (
                      <FileOutlined style={{ fontSize: 18, marginRight: 8 }} />
                    )}
                    <Text strong style={{ flex: 1 }}>{item.originalName}</Text>
                  </div>

                  {/* Original path */}
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px', wordBreak: 'break-all' }}>
                    原路径: {item.originalPath}
                  </div>

                  {/* Deleted time */}
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                    删除时间: {new Date(item.deletedAt).toLocaleString('zh-CN')}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      type="primary"
                      size="small"
                      icon={<UndoOutlined />}
                      onClick={() => restoreFromRecycleBin(item.recycleName)}
                    >
                      恢复
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => permanentDelete(item.recycleName)}
                    >
                      永久删除
                    </Button>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Drawer>

      {/* Favorites Drawer */}
      <Drawer
        title={
          <Space>
            <StarFilled style={{ color: '#faad14' }} />
            我的收藏
          </Space>
        }
        placement="right"
        width={500}
        open={favoritesVisible}
        onClose={() => setFavoritesVisible(false)}
        extra={
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={loadFavorites}
          >
            刷新
          </Button>
        }
      >
        {favoritesLoading ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <Spin />
          </div>
        ) : favorites.length === 0 ? (
          <Empty
            description="还没有收藏的文件"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={favorites}
            renderItem={(item: any) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => handleNavigateToFavorite(item)}
                actions={[
                  <Button
                    type="text"
                    size="small"
                    icon={<StarFilled style={{ color: '#faad14' }} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite({ path: item.path, name: item.name, type: item.type } as FileItem);
                    }}
                  >
                    取消收藏
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={item.type === 'directory' ? <FolderOutlined /> : <FileOutlined />}
                  title={item.name}
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.path}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        收藏于 {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
}
