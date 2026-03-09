import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Input,
  Space,
  List,
  Typography,
  Tag,
  Spin,
  message,
  Dropdown,
  Divider,
  Tooltip,
  Modal,
  Drawer,
  Empty,
  Alert,
  Steps
} from 'antd';
import {
  ReloadOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DesktopOutlined,
  PlusOutlined,
  CloseOutlined,
  ChromeOutlined,
  CopyOutlined,
  SaveOutlined,
  SettingOutlined,
  HomeOutlined,
  SnippetsOutlined,
  DeleteOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { API_BASE_URL } from '../config';
import './Browser.css';

const { Text, Paragraph, Title } = Typography;
const { Step } = Steps;

interface ChromeCheckResult {
  installed: boolean;
  chromePath?: string;
  chromeVersion?: string;
  running?: boolean;
  remoteDebugEnabled?: boolean;
  platform: string;
  instructions?: {
    title: string;
    steps: string[];
    commands?: string[];
  };
}

interface BrowserTarget {
  id: string;
  title: string;
  url: string;
  type: string;
}

interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
  preview: string;
  source: 'browser' | 'manual';  // 来源：浏览器复制 或 手动输入
}

export default function BrowserPage() {
  const [targets, setTargets] = useState<BrowserTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [pageInfo, setPageInfo] = useState<{ url?: string; title?: string }>({});
  const [contextMenuVisible, setContextMenuVisible] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showUsageHint, setShowUsageHint] = useState<boolean>(true);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [clipboardVisible, setClipboardVisible] = useState<boolean>(false);
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>([]);
  const [currentClipboard, setCurrentClipboard] = useState<string>('');

  // Chrome 检查相关状态
  const [chromeCheckResult, setChromeCheckResult] = useState<ChromeCheckResult | null>(null);
  const [chromeCheckModalVisible, setChromeCheckModalVisible] = useState<boolean>(false);
  const [checkingChrome, setCheckingChrome] = useState<boolean>(true);

  // 计算适应屏幕的默认视口大小
  const calculateDefaultViewport = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    // 留出一些空间给工具栏和标签栏
    return {
      width: Math.max(1024, screenWidth - 100),
      height: Math.max(768, screenHeight - 300)
    };
  };

  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(calculateDefaultViewport());

  const wsRef = useRef<WebSocket | null>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 检查 Chrome 安装状态
  const checkChromeInstallation = async (showModalOnError = false) => {
    setCheckingChrome(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/browser/check-chrome`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data: ChromeCheckResult = await response.json();
        setChromeCheckResult(data);

        // 只有在明确需要显示弹窗时才显示
        if (showModalOnError && (!data.installed || !data.remoteDebugEnabled)) {
          setChromeCheckModalVisible(true);
        }
      }
    } catch (error) {
      console.error('Failed to check Chrome installation:', error);
    } finally {
      setCheckingChrome(false);
    }
  };

  // 页面加载时检查 Chrome（不自动显示弹窗，只在底部状态栏显示）
  useEffect(() => {
    checkChromeInstallation(false);
  }, []);

  // 重新检查 Chrome 状态
  const recheckChrome = () => {
    checkChromeInstallation();
  };

  // 启动 Chrome 远程调试
  const startChromeDebugging = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/browser/start-chrome`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          message.success('Chrome 远程调试已启动');
          recheckChrome();
        } else {
          // 显示启动命令
          Modal.info({
            title: data.instructions?.title || '启动 Chrome 远程调试模式',
            width: 700,
            content: (
              <div>
                <Paragraph>{data.message}</Paragraph>
                {data.instructions?.steps.map((step, index) => (
                  <Paragraph key={index}>{step}</Paragraph>
                ))}
                {data.startCommand && (
                  <div style={{ marginTop: '16px' }}>
                    <Text strong>启动命令：</Text>
                    <div style={{
                      background: '#f6f8fa',
                      padding: '12px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      marginTop: '8px',
                      wordBreak: 'break-all'
                    }}>
                      {data.startCommand}
                    </div>
                    <Button
                      type="primary"
                      onClick={() => {
                        navigator.clipboard.writeText(data.startCommand);
                        message.success('命令已复制到剪贴板');
                      }}
                      style={{ marginTop: '8px' }}
                    >
                      复制命令
                    </Button>
                  </div>
                )}
              </div>
            ),
            onOk: () => {
              // 用户确认后，可以自动重新检查
              setTimeout(recheckChrome, 3000);
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to start Chrome:', error);
      message.error('启动 Chrome 失败');
    }
  };

  // 加载浏览器目标列表
  useEffect(() => {
    loadTargets();
    const interval = setInterval(loadTargets, 5000); // 每5秒刷新目标列表
    return () => clearInterval(interval);
  }, []);

  // 连接到选中的目标
  useEffect(() => {
    if (selectedTarget) {
      connectToTarget(selectedTarget);
    }
    return () => {
      disconnect();
    };
  }, [selectedTarget]);

  const loadTargets = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/browser/targets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTargets(data);
      } else {
        console.error('Failed to load targets');
      }
    } catch (error) {
      console.error('Failed to load targets:', error);
    }
  };

  const connectToTarget = (targetId: string) => {
    console.log('[Browser] Connecting to target:', targetId);
    disconnect();

    const token = localStorage.getItem('token');
    // 浏览器 WebSocket 使用单独的端口，可通过 .env 中的 VITE_BROWSER_WS_URL 配置
    const BROWSER_WS_URL = import.meta.env.VITE_BROWSER_WS_URL || 'ws://localhost:3003';
    // 如果URL已包含路径则不重复添加
    const wsUrl = BROWSER_WS_URL.includes('/ws/browser')
      ? `${BROWSER_WS_URL}?token=${token}&targetId=${targetId}`
      : `${BROWSER_WS_URL}/ws/browser?token=${token}&targetId=${targetId}`;

    console.log('[Browser] WebSocket URL:', wsUrl.replace(token, '***'));
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Browser] ✓ WebSocket connected');
      console.log('[Browser] State: readyState =', ws.readyState);
      setConnected(true);
      setLoading(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[Browser] ✓ Message received:', msg.type);

        switch (msg.type) {
          case 'ready':
            console.log('[Browser] Session ready:', msg.sessionId);
            console.log('[Browser] → Sending startScreenshot command...');

            // 确保WebSocket已完全打开
            if (ws.readyState === WebSocket.OPEN) {
              // 先设置视口大小以适应屏幕
              const defaultViewport = calculateDefaultViewport();
              ws.send(JSON.stringify({ type: 'setViewport', data: defaultViewport }));
              console.log('[Browser] ✓ Viewport set to', defaultViewport);

              // 启动截图
              ws.send(JSON.stringify({ type: 'startScreenshot', data: { fps: 2 } }));
              console.log('[Browser] ✓ startScreenshot sent');
            } else {
              console.error('[Browser] ✗ WebSocket not ready, state:', ws.readyState);
            }
            break;

          case 'screenshot':
            console.log('[Browser] ✓ Screenshot received, size:', msg.data.length);
            setScreenshot(`data:image/png;base64,${msg.data}`);
            break;

          case 'pageLoaded':
            console.log('[Browser] ✓ Page loaded:', msg.title);
            setPageInfo(prev => ({ ...prev, title: msg.title }));
            break;

          case 'navigated':
            console.log('[Browser] ✓ Navigated to:', msg.url);
            setPageInfo({ url: msg.url, title: msg.title });
            setUrlInput(msg.url);
            break;

          case 'pageInfo':
            console.log('[Browser] ✓ Page info:', msg.info);
            setPageInfo(msg.info);
            break;

          case 'copiedText':
            console.log('[Browser] ✓ Text copied from browser:', msg.data.text);
            // 将浏览器中复制的文本添加到剪贴板历史
            addToClipboardHistory(msg.data.text, true); // true 表示来自浏览器复制
            message.success('✓ 已复制到剪贴板历史');
            break;

          case 'info':
            console.log('[Browser] ℹ Info:', msg.data.message);
            message.info(msg.data.message);
            break;

          case 'error':
            console.error('[Browser] ✗ Error:', msg.message);
            message.error(`错误: ${msg.message}`);
            break;

          default:
            console.log('[Browser] Unknown message type:', msg.type);
        }
      } catch (e) {
        console.error('[Browser] Message parse error:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('[Browser] ✗ WebSocket error:', error);
      message.error('连接错误');
      setConnected(false);
      setLoading(false);
    };

    ws.onclose = (event) => {
      console.log('[Browser] WebSocket closed. Code:', event.code, 'Reason:', event.reason);
      setConnected(false);
      setLoading(false);
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }
    };

    wsRef.current = ws;
    setLoading(true);
  };

  const disconnect = () => {
    if (wsRef.current) {
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setScreenshot('');
    setPageInfo({});
  };

  const createNewTab = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/browser/tabs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: 'https://www.google.com' })
      });

      if (response.ok) {
        const tab = await response.json();
        message.success('新标签页已创建');
        loadTargets();
        setSelectedTarget(tab.id);
      } else {
        message.error('创建标签页失败');
      }
    } catch (error) {
      message.error('创建标签页失败');
      console.error('Failed to create tab:', error);
    }
  };

  const closeTab = async (targetId: string) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/browser/tabs/${targetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        message.success('标签页已关闭');
        if (selectedTarget === targetId) {
          setSelectedTarget(null);
          disconnect();
        }
        loadTargets();
      } else {
        message.error('关闭标签页失败');
      }
    } catch (error) {
      message.error('关闭标签页失败');
      console.error('Failed to close tab:', error);
    }
  };

  const handleNavigate = (e?: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!wsRef.current || !urlInput) return;

    // 自动添加 http:// 前缀（如果还没有的话）
    let finalUrl = urlInput.trim();
    if (!finalUrl.match(/^https?:\/\//i)) {
      finalUrl = 'http://' + finalUrl;
    }

    wsRef.current.send(JSON.stringify({
      type: 'navigate',
      data: { url: finalUrl }
    }));

    // 更新输入框显示的 URL
    setUrlInput(finalUrl);
  };

  const reload = () => {
    if (!wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'reload',
      data: { ignoreCache: false }
    }));
  };

  const goBack = () => {
    if (!wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'goBack',
      data: {}
    }));
  };

  const goForward = () => {
    if (!wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'goForward',
      data: {}
    }));
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!wsRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 考虑图片显示尺寸和实际尺寸的比例
    const scaleX = (e.currentTarget as any).naturalWidth / rect.width;
    const scaleY = (e.currentTarget as any).naturalHeight / rect.height;

    wsRef.current.send(JSON.stringify({
      type: 'click',
      data: {
        x: x * scaleX,
        y: y * scaleY
      }
    }));
  };

  // 鼠标按下 - 开始选择文字
  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!wsRef.current || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = (imageRef.current as any).naturalWidth / rect.width;
    const scaleY = (imageRef.current as any).naturalHeight / rect.height;

    setSelectionStart({
      x: x * scaleX,
      y: y * scaleY
    });
    setIsSelecting(true);
  };

  // 鼠标移动 - 更新选择
  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSelecting || !wsRef.current || !imageRef.current || !selectionStart) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = (imageRef.current as any).naturalWidth / rect.width;
    const scaleY = (imageRef.current as any).naturalHeight / rect.height;

    // 发送拖拽选择事件到后端
    wsRef.current.send(JSON.stringify({
      type: 'selectText',
      data: {
        startX: selectionStart.x,
        startY: selectionStart.y,
        endX: x * scaleX,
        endY: y * scaleY
      }
    }));
  };

  // 鼠标松开 - 完成选择并自动复制
  const handleMouseUp = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSelecting || !wsRef.current || !imageRef.current || !selectionStart) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = (imageRef.current as any).naturalWidth / rect.width;
    const scaleY = (imageRef.current as any).naturalHeight / rect.height;

    // 发送最终选择事件到后端
    wsRef.current.send(JSON.stringify({
      type: 'selectText',
      data: {
        startX: selectionStart.x,
        startY: selectionStart.y,
        endX: x * scaleX,
        endY: y * scaleY,
        final: true
      }
    }));

    setIsSelecting(false);
    setSelectionStart(null);

    // 显示提示
    const hideMessage = message.loading('正在选择文字...', 0);

    // 2秒后自动复制（给后端足够时间完成选择操作）
    setTimeout(() => {
      hideMessage(); // 关闭 loading 消息

      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'copy',
          data: {}
        }));
        // 显示复制中提示
        message.info('正在复制...', 1);
        console.log('[Browser] Auto-copy command sent (2s after mouse up)');
      }
    }, 2000); // 增加到2秒
  };

  // 添加到剪贴板历史
  const addToClipboardHistory = (content: string, fromBrowser = false) => {
    const newItem: ClipboardItem = {
      id: Date.now().toString(),
      content: content,
      timestamp: Date.now(),
      preview: content.length > 100 ? content.substring(0, 100) + '...' : content,
      source: fromBrowser ? 'browser' : 'manual'
    };

    setClipboardHistory(prev => [newItem, ...prev].slice(0, 20)); // 保留最近20条
    setCurrentClipboard(content);
  };

  // 从剪贴板历史粘贴
  const pasteFromHistory = (content: string) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'paste',
        data: { text: content }
      }));
      message.success('已粘贴');
      setClipboardVisible(false);
    }
  };

  // 删除剪贴板历史项
  const deleteClipboardItem = (id: string) => {
    setClipboardHistory(prev => prev.filter(item => item.id !== id));
    message.success('已删除');
  };

  // 清空剪贴板历史
  const clearClipboardHistory = () => {
    Modal.confirm({
      title: '清空剪贴板历史',
      content: '确定要清空所有剪贴板历史记录吗？',
      onOk: () => {
        setClipboardHistory([]);
        setCurrentClipboard('');
        message.success('已清空');
      }
    });
  };

  // 复制到本机剪贴板
  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      message.success('✓ 已复制到本机剪贴板');
    } catch (error) {
      // 如果失败，尝试使用传统方法
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        message.success('✓ 已复制到本机剪贴板');
      } catch (err) {
        message.error('复制失败，请手动复制');
      }
      document.body.removeChild(textArea);
    }
  };

  const typeText = (text: string) => {
    if (!wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'type',
      data: { text }
    }));
  };

  const setViewport = () => {
    if (!wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'setViewport',
      data: viewportSize
    }));

    message.success(`视口已设置为 ${viewportSize.width}x${viewportSize.height}`);
  };

  const handleCopyScreenshot = () => {
    if (screenshot) {
      // 将base64图片复制到剪贴板
      fetch(screenshot)
        .then(res => res.blob())
        .then(blob => {
          const item = new ClipboardItem({ 'image/png': blob });
          navigator.clipboard.write([item]);
          message.success('截图已复制到剪贴板');
        })
        .catch(() => {
          message.error('复制失败');
        });
    }
  };

  const handleSaveScreenshot = () => {
    if (screenshot) {
      const link = document.createElement('a');
      link.href = screenshot;
      link.download = `screenshot-${Date.now()}.png`;
      link.click();
      message.success('截图已保存');
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
    if (!wsRef.current || !imageRef.current) return;

    // 不调用 preventDefault，允许浏览器处理滚动
    // 发送滚轮事件到后端进行同步滚动

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = (imageRef.current as any).naturalWidth / rect.width;
    const scaleY = (imageRef.current as any).naturalHeight / rect.height;

    // 发送滚轮事件到后端
    wsRef.current.send(JSON.stringify({
      type: 'scroll',
      data: {
        x: x * scaleX,
        y: y * scaleY,
        deltaX: e.deltaX,
        deltaY: e.deltaY
      }
    }));
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();

    if (!wsRef.current || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = (imageRef.current as any).naturalWidth / rect.width;
    const scaleY = (imageRef.current as any).naturalHeight / rect.height;

    // 发送右键点击到后端
    wsRef.current.send(JSON.stringify({
      type: 'contextmenu',
      data: {
        x: x * scaleX,
        y: y * scaleY,
        button: 2
      }
    }));

    // 显示自定义右键菜单
    setContextMenuPosition({
      x: e.clientX,
      y: e.clientY
    });
    setContextMenuVisible(true);
  };

  const handleCopy = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'copy',
        data: {}
      }));
      message.info('已发送复制命令 (Ctrl+C)');
    }
    setContextMenuVisible(false);
  };

  const handlePaste = async () => {
    setContextMenuVisible(false);

    // 尝试从剪贴板读取
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (wsRef.current && clipboardText) {
        wsRef.current.send(JSON.stringify({
          type: 'paste',
          data: { text: clipboardText }
        }));
        message.success('已粘贴剪贴板内容');
        // 添加到历史
        addToClipboardHistory(clipboardText);
        return;
      }
    } catch (error) {
      // 非HTTPS环境无法访问剪贴板，使用手动输入
      console.log('剪贴板API不可用，使用手动输入');
    }

    // 弹出输入框让用户输入要粘贴的文本
    Modal.confirm({
      title: '粘贴文本',
      content: (
        <div>
          <p>请输入要粘贴的文本：</p>
          <Input.TextArea
            id="paste-text-input"
            placeholder="在此输入文本..."
            autoFocus
            rows={4}
          />
        </div>
      ),
      onOk: () => {
        const input = document.getElementById('paste-text-input') as HTMLTextAreaElement;
        if (wsRef.current && input?.value) {
          wsRef.current.send(JSON.stringify({
            type: 'paste',
            data: { text: input.value }
          }));
          message.success('已粘贴文本');
          // 添加到历史
          addToClipboardHistory(input.value);
        }
      },
      okText: '粘贴',
      cancelText: '取消'
    });
  };

  const handleSelectAll = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'selectAll',
        data: {}
      }));
      message.info('已发送全选命令 (Ctrl+A)');
    }
    setContextMenuVisible(false);
  };

  const handleCloseContextMenu = () => {
    setContextMenuVisible(false);
  };

  // 键盘输入处理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLImageElement>) => {
    if (!wsRef.current) return;

    // 阻止某些快捷键的默认行为
    const key = e.key;

    // 特殊按键处理
    if (e.ctrlKey || e.metaKey) {
      if (key === 'c') {
        // Ctrl+C - 复制
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'copy',
          data: {}
        }));
        return;
      }
      if (key === 'v') {
        // Ctrl+V - 粘贴
        e.preventDefault();
        handlePaste();
        return;
      }
      if (key === 'a') {
        // Ctrl+A - 全选
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'selectAll',
          data: {}
        }));
        return;
      }
      if (key === 'x') {
        // Ctrl+X - 剪切
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'cut',
          data: {}
        }));
        return;
      }
    }

    // 功能键
    if (key === 'Enter') {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'keypress',
        data: { key: 'Enter' }
      }));
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'keypress',
        data: { key: key === 'Backspace' ? 'Backspace' : 'Delete' }
      }));
      return;
    }
    if (key === 'Tab') {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'keypress',
        data: { key: 'Tab' }
      }));
      return;
    }
    if (key === 'Escape') {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'keypress',
        data: { key: 'Escape' }
      }));
      return;
    }
    if (key.startsWith('Arrow')) {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'keypress',
        data: { key }
      }));
      return;
    }

    // 普通字符输入
    if (key.length === 1) {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'type',
        data: { text: key }
      }));
    }
  };

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenuVisible) {
        setContextMenuVisible(false);
      }
    };

    if (contextMenuVisible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuVisible]);

  // 监听整个容器的键盘事件（无论焦点在哪里）
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 只在连接状态且有截图时处理键盘事件
      if (!wsRef.current || !screenshot) return;

      // 避免在输入框中打字时触发
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // 处理快捷键
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          wsRef.current.send(JSON.stringify({
            type: 'copy',
            data: {}
          }));
          return;
        }
        if (e.key === 'v') {
          e.preventDefault();
          handlePaste();
          return;
        }
        if (e.key === 'a') {
          e.preventDefault();
          wsRef.current.send(JSON.stringify({
            type: 'selectAll',
            data: {}
          }));
          return;
        }
        if (e.key === 'x') {
          e.preventDefault();
          wsRef.current.send(JSON.stringify({
            type: 'cut',
            data: {}
          }));
          return;
        }
      }

      // 处理功能键
      if (e.key === 'Enter') {
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'keypress',
          data: { key: 'Enter' }
        }));
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'keypress',
          data: { key: e.key === 'Backspace' ? 'Backspace' : 'Delete' }
        }));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'keypress',
          data: { key: 'Tab' }
        }));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'keypress',
          data: { key: 'Escape' }
        }));
        return;
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'keypress',
          data: { key: e.key }
        }));
        return;
      }

      // 普通字符输入
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        wsRef.current.send(JSON.stringify({
          type: 'type',
          data: { text: e.key }
        }));
      }
    };

    // 添加全局键盘监听
    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [screenshot, contextMenuVisible]);
  return (
    <div className="browser-page">
      <Card className="browser-card" bodyStyle={{ padding: 0 }}>
        {/* 浏览器标签栏 */}
        <div className="browser-tabs">
          <Space size={4} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
            {targets.map((target) => (
              <div
                key={target.id}
                className={`browser-tab ${selectedTarget === target.id ? 'active' : ''}`}
                onClick={() => setSelectedTarget(target.id)}
              >
                <ChromeOutlined style={{ marginRight: 6 }} />
                <span className="tab-title">{target.title || 'Loading...'}</span>
                <CloseOutlined
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(target.id);
                  }}
                />
              </div>
            ))}
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={createNewTab}
              className="new-tab-button"
            >
              新建标签
            </Button>
          </Space>
        </div>

        {/* 浏览器工具栏 */}
        <div className="browser-toolbar">
          <Space size={4}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={goBack}
              disabled={!connected}
              size="small"
            >
              后退
            </Button>
            <Button
              icon={<ArrowRightOutlined />}
              onClick={goForward}
              disabled={!connected}
              size="small"
            >
              前进
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={reload}
              disabled={!connected}
              size="small"
            >
              刷新
            </Button>
            <Button
              icon={<HomeOutlined />}
              onClick={() => setUrlInput('https://www.google.com')}
              disabled={!connected}
              size="small"
            >
              主页
            </Button>
          </Space>

          <div className="url-bar">
            <Input
              placeholder="输入 URL 或搜索内容"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onPressEnter={handleNavigate}
              disabled={!connected}
              style={{ width: '100%' }}
            />
          </div>

          <Space size={4}>
            <Button
              type="primary"
              onClick={handleNavigate}
              disabled={!connected}
              size="small"
            >
              跳转
            </Button>

            <Tooltip title="视口设置">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: '1',
                      label: '桌面 (1920x1080)',
                      onClick: () => { setViewportSize({ width: 1920, height: 1080 }); setViewport(); }
                    },
                    {
                      key: '2',
                      label: '笔记本 (1366x768)',
                      onClick: () => { setViewportSize({ width: 1366, height: 768 }); setViewport(); }
                    },
                    {
                      key: '3',
                      label: '平板 (768x1024)',
                      onClick: () => { setViewportSize({ width: 768, height: 1024 }); setViewport(); }
                    },
                    {
                      key: '4',
                      label: '手机 (375x667)',
                      onClick: () => { setViewportSize({ width: 375, height: 667 }); setViewport(); }
                    },
                    {
                      type: 'divider'
                    },
                    {
                      key: 'custom',
                      label: '自定义...',
                      onClick: () => {
                        Modal.confirm({
                          title: '自定义视口尺寸',
                          content: (
                            <div>
                              <Space direction="vertical">
                                <div>
                                  <Text>宽度:</Text>
                                  <Input
                                    type="number"
                                    defaultValue={viewportSize.width}
                                    onChange={(e) => setViewportSize(prev => ({ ...prev, width: parseInt(e.target.value) || 1280 }))}
                                  />
                                </div>
                                <div>
                                  <Text>高度:</Text>
                                  <Input
                                    type="number"
                                    defaultValue={viewportSize.height}
                                    onChange={(e) => setViewportSize(prev => ({ ...prev, height: parseInt(e.target.value) || 720 }))}
                                  />
                                </div>
                              </Space>
                            </div>
                          ),
                          onOk: setViewport
                        });
                      }
                    }
                  ]
                }}
              >
                <Button icon={<DesktopOutlined />} size="small">
                  视口
                </Button>
              </Dropdown>
            </Tooltip>

            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'copy',
                    icon: <CopyOutlined />,
                    label: '复制截图',
                    onClick: handleCopyScreenshot
                  },
                  {
                    key: 'save',
                    icon: <SaveOutlined />,
                    label: '保存截图',
                    onClick: handleSaveScreenshot
                  }
                ]
              }}
            >
              <Button icon={<SettingOutlined />} size="small">
                更多
              </Button>
            </Dropdown>

            <Button
              icon={<SnippetsOutlined />}
              onClick={() => setClipboardVisible(true)}
              disabled={!connected}
              size="small"
            >
              剪贴板
              {clipboardHistory.length > 0 && (
                <Tag size="small" color="blue" style={{ marginLeft: 4 }}>
                  {clipboardHistory.length}
                </Tag>
              )}
            </Button>

            <Tag color={connected ? 'green' : 'red'} style={{ marginLeft: 8 }}>
              {connected ? '已连接' : '未连接'}
            </Tag>
          </Space>
        </div>

        {/* 剪贴板历史面板 */}
        <Drawer
          title={
            <Space>
              <SnippetsOutlined />
              <span>剪贴板历史</span>
              <Tag color="blue">{clipboardHistory.length} 条记录</Tag>
            </Space>
          }
          placement="right"
          width={500}
          open={clipboardVisible}
          onClose={() => setClipboardVisible(false)}
          extra={
            <Button
              icon={<ClearOutlined />}
              onClick={clearClipboardHistory}
              disabled={clipboardHistory.length === 0}
              danger
            >
              清空
            </Button>
          }
        >
          {clipboardHistory.length === 0 ? (
            <Empty
              description={
                <div>
                  <p>暂无剪贴板历史</p>
                  <p style={{ fontSize: '12px', color: '#999' }}>
                    在网页中拖拽选择文字后会自动添加到这里
                  </p>
                </div>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              dataSource={clipboardHistory}
              renderItem={(item) => (
                <List.Item
                  key={item.id}
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: item.source === 'browser' ? '#f6ffed' : '#fafafa',
                    borderLeft: item.source === 'browser' ? '4px solid #52c41a' : '1px solid #d9d9d9',
                    display: 'block',
                    width: '100%'
                  }}
                >
                  <div style={{ width: '100%' }}>
                    {/* 时间和来源 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                      {item.source === 'browser' ? (
                        <Tag color="success">来自网页</Tag>
                      ) : (
                        <Tag color="default">手动输入</Tag>
                      )}
                    </div>

                    {/* 内容 */}
                    <div style={{
                      backgroundColor: 'white',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      wordBreak: 'break-all',
                      lineHeight: '1.6',
                      border: '1px solid #e8e8e8',
                      marginBottom: '8px',
                      maxHeight: '80px',
                      overflow: 'auto'
                    }}>
                      {item.content}
                    </div>

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {item.source === 'browser' && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(item.content)}
                        >
                          复制到本机
                        </Button>
                      )}
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => pasteFromHistory(item.content)}
                      >
                        粘贴到浏览器
                      </Button>
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => deleteClipboardItem(item.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Drawer>

        {/* 浏览器内容区域 */}
        <div className="browser-content" style={{ position: 'relative' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 100 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>正在连接...</div>
            </div>
          )}

          {!connected && !loading && (
            <div style={{ textAlign: 'center', padding: 100, color: '#999' }}>
              <ChromeOutlined style={{ fontSize: 64, marginBottom: 16 }} />
              <div style={{ fontSize: 16, marginBottom: 8 }}>欢迎使用远程浏览器</div>
              <div>请选择或创建一个标签页开始使用</div>
            </div>
          )}

          {screenshot && (
            <div className="browser-viewport-container" style={{ overflow: 'auto', position: 'relative' }}>
              {/* 使用说明提示 - 可关闭 */}
              {showUsageHint && (
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  right: 10,
                  zIndex: 1000,
                  background: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  lineHeight: '1.6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                        💡 使用说明
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.9 }}>
                        1. <strong>输入文字</strong>：点击网页上的输入框，然后直接输入<br/>
                        2. <strong>选择文字</strong>：拖拽选择文字，<strong>自动复制</strong>到剪贴板 ✓<br/>
                        3. <strong>粘贴文字</strong>：点击输入框后按 Ctrl+V 或右键粘贴<br/>
                        4. <strong>删除文字</strong>：使用 Backspace/Delete 键<br/>
                        5. 支持所有快捷键：Ctrl+A（全选）、Ctrl+X（剪切）等
                      </div>
                    </div>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => setShowUsageHint(false)}
                      style={{ color: 'white', marginLeft: '12px', minWidth: 'auto' }}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}

              <img
                ref={imageRef}
                src={screenshot}
                alt="Browser Screenshot"
                onClick={handleImageClick}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                  display: 'block',
                  cursor: isSelecting ? 'text' : 'text',
                  width: '100%',
                  height: 'auto',
                  pointerEvents: 'auto',
                  userSelect: 'none'
                }}
              />

              {/* 自定义右键菜单 */}
              {contextMenuVisible && (
                <div
                  className="context-menu"
                  style={{
                    position: 'fixed',
                    left: contextMenuPosition.x,
                    top: contextMenuPosition.y,
                    zIndex: 9999,
                    background: 'white',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    minWidth: '150px',
                    padding: '4px 0'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="context-menu-item"
                    onClick={handleCopy}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    复制 (Ctrl+C)
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={handlePaste}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    粘贴 (Ctrl+V)
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={handleSelectAll}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    全选 (Ctrl+A)
                  </div>
                  <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />
                  <div
                    className="context-menu-item"
                    onClick={handleCloseContextMenu}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    关闭
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 页面信息栏 */}
        {pageInfo.title && (
          <div className="browser-statusbar">
            <Space split={<Divider type="vertical" />}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                标题: {pageInfo.title}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                URL: {pageInfo.url}
              </Text>
            </Space>
          </div>
        )}
      </Card>

      {/* 使用环境条件提示 */}
      <Alert
        message={
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Text strong style={{ fontSize: '13px' }}>
              💡 使用环境条件 & 限制说明
            </Text>
            <div style={{ fontSize: '12px', lineHeight: '1.6', marginTop: '4px' }}>
              • 运行在非 HTTPS 环境（http://192.168.0.7），剪贴板 API 受限 → 使用手动输入方式粘贴<br/>
              • 浏览器画面是截图（PNG图片），每次刷新约 0.5 秒，存在输入延迟<br/>
              • 选中文字后自动复制到剪贴板历史，可在"剪贴贴板"面板查看<br/>
              • 网页复制的内容可点击"复制到本机"按钮，复制到本地剪贴板使用<br/>
              • 所有键盘输入通过 WebSocket 发送到远程浏览器，请确保网络连接稳定
            </div>
          </Space>
        }
        type="info"
        showIcon
        closable
        style={{
          marginTop: '16px',
          borderRadius: '4px',
          fontSize: '12px'
        }}
      />

      {/* Chrome 状态栏 */}
      <Card
        size="small"
        style={{
          marginTop: '16px',
          borderRadius: '4px',
          border: chromeCheckResult?.installed && chromeCheckResult.remoteDebugEnabled
            ? '1px solid #b7eb8f'
            : '1px solid #ffbb96'
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {/* 标题行 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <ChromeOutlined style={{
                fontSize: 18,
                color: chromeCheckResult?.installed && chromeCheckResult.remoteDebugEnabled ? '#52c41a' : '#faad14'
              }} />
              <Text strong style={{ fontSize: 13 }}>
                Chrome 浏览器状态
              </Text>
              {checkingChrome ? (
                <Spin size="small" />
              ) : (
                chromeCheckResult?.installed && chromeCheckResult.remoteDebugEnabled ? (
                  <Tag color="success" icon={<span>✓</span>}>已就绪</Tag>
                ) : chromeCheckResult?.installed ? (
                  <Tag color="warning" icon={<span>⚠</span>}>未启动</Tag>
                ) : (
                  <Tag color="error" icon={<span>✗</span>}>未安装</Tag>
                )
              )}
            </Space>
            <Button
              type="link"
              size="small"
              onClick={() => recheckChrome()}
              loading={checkingChrome}
              icon={<ReloadOutlined />}
            >
              刷新状态
            </Button>
          </div>

          {/* 详细信息 */}
          {chromeCheckResult && !checkingChrome && (
            <div style={{ fontSize: 12 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {/* 安装状态 */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">安装状态：</Text>
                  <Text>
                    {chromeCheckResult.installed ? (
                      <Text type="success">✓ 已安装</Text>
                    ) : (
                      <Text type="warning">✗ 未安装</Text>
                    )}
                    {chromeCheckResult.chromeVersion && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        ({chromeCheckResult.chromeVersion})
                      </Text>
                    )}
                  </Text>
                </div>

                {/* 运行状态 */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">远程调试：</Text>
                  <Text>
                    {chromeCheckResult.remoteDebugEnabled ? (
                      <Text type="success">✓ 已启用 (端口 9222)</Text>
                    ) : chromeCheckResult.running ? (
                      <Text type="warning">⚠ 运行中但未启用调试</Text>
                    ) : (
                      <Text type="warning">✗ 未启动</Text>
                    )}
                  </Text>
                </div>

                {/* 操作按钮 */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                  <Space wrap>
                    {!chromeCheckResult.installed && (
                      <Button
                        type="primary"
                        size="small"
                        onClick={async () => {
                          try {
                            const API_BASE_URL = import.meta.env.VITE_API_URL;
                            const response = await fetch(`${API_BASE_URL}/api/browser/install-chrome`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                              }
                            });

                            const data = await response.json();

                            if (data.success) {
                              message.success({ content: 'Chrome 安装已启动，请稍候...', duration: 5 });
                              setTimeout(recheckChrome, 30000);
                            } else {
                              setChromeCheckModalVisible(true);
                            }
                          } catch (error) {
                            message.error('安装请求失败');
                          }
                        }}
                      >
                        一键安装 Chrome
                      </Button>
                    )}
                    {chromeCheckResult.installed && !chromeCheckResult.remoteDebugEnabled && (
                      <Button
                        type="primary"
                        size="small"
                        onClick={async () => {
                          try {
                            const API_BASE_URL = import.meta.env.VITE_API_URL;
                            const response = await fetch(`${API_BASE_URL}/api/browser/launch-chrome`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                              }
                            });

                            const data = await response.json();

                            if (data.success) {
                              message.success({ content: data.message || 'Chrome 启动成功', duration: 5 });
                              setTimeout(recheckChrome, 3000);
                            } else {
                              message.error(data.message || data.error);
                            }
                          } catch (error) {
                            message.error('启动 Chrome 失败');
                          }
                        }}
                      >
                        一键启动调试模式
                      </Button>
                    )}
                    <Button
                      size="small"
                      onClick={() => setChromeCheckModalVisible(true)}
                    >
                      查看详细指引
                    </Button>
                  </Space>
                </div>
              </Space>
            </div>
          )}
        </Space>
      </Card>

      {/* Chrome 安装检查和引导弹窗 */}
      <Modal
        title={
          <Space>
            <ChromeOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <span>浏览器准备状态检查</span>
          </Space>
        }
        open={chromeCheckModalVisible}
        onCancel={() => setChromeCheckModalVisible(false)}
        footer={null}
        width={700}
        centered
      >
        {checkingChrome ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>正在检查 Chrome 浏览器...</div>
          </div>
        ) : chromeCheckResult ? (
          <div>
            {/* 检查结果 */}
            <div style={{ marginBottom: 24 }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div style={{
                  padding: '12px',
                  borderRadius: '4px',
                  background: chromeCheckResult.installed ? '#f6ffed' : '#fff2e8',
                  border: `1px solid ${chromeCheckResult.installed ? '#b7eb8f' : '#ffbb96'}`
                }}>
                  <Space>
                    {chromeCheckResult.installed ? (
                      <>
                        <Tag color="success">✓ Chrome 已安装</Tag>
                        {chromeCheckResult.chromeVersion && (
                          <Text type="secondary">版本: {chromeCheckResult.chromeVersion}</Text>
                        )}
                      </>
                    ) : (
                      <Tag color="warning">✗ Chrome 未安装</Tag>
                    )}
                  </Space>
                  {chromeCheckResult.chromePath && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      路径: {chromeCheckResult.chromePath}
                    </div>
                  )}
                </div>

                <div style={{
                  padding: '12px',
                  borderRadius: '4px',
                  background: chromeCheckResult.remoteDebugEnabled ? '#f6ffed' : '#fff2e8',
                  border: `1px solid ${chromeCheckResult.remoteDebugEnabled ? '#b7eb8f' : '#ffbb96'}`
                }}>
                  <Space>
                    {chromeCheckResult.remoteDebugEnabled ? (
                      <Tag color="success">✓ 远程调试已启用</Tag>
                    ) : (
                      <Tag color="warning">✗ 远程调试未启用</Tag>
                    )}
                  </Space>
                </div>
              </Space>
            </div>

            {/* Chrome 未安装 */}
            {!chromeCheckResult.installed && chromeCheckResult.instructions && (
              <div>
                <Title level={5}>{chromeCheckResult.instructions.title}</Title>
                <Steps
                  direction="vertical"
                  current={-1}
                  items={chromeCheckResult.instructions.steps.map((step, index) => ({
                    title: step,
                    description: chromeCheckResult.instructions?.commands?.[index] || undefined
                  }))}
                />
                {chromeCheckResult.instructions.commands && chromeCheckResult.instructions.commands.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong>安装命令：</Text>
                    <div style={{
                      background: '#f6f8fa',
                      padding: '12px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      marginTop: '8px',
                      wordBreak: 'break-all'
                    }}>
                      {chromeCheckResult.instructions.commands.join('\n')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chrome 已安装但未启动远程调试 */}
            {chromeCheckResult.installed && !chromeCheckResult.remoteDebugEnabled && (
              <Alert
                message="需要启动 Chrome 远程调试模式"
                description="浏览器管理功能需要 Chrome 以远程调试模式运行。请点击下方按钮启动。"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {/* 操作按钮 */}
            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setChromeCheckModalVisible(false)}>
                  关闭
                </Button>
                <Button onClick={recheckChrome} loading={checkingChrome}>
                  重新检查
                </Button>
                {!chromeCheckResult.installed && (
                  <Button
                    type="primary"
                    onClick={async () => {
                      try {
                        const API_BASE_URL = import.meta.env.VITE_API_URL;
                        const response = await fetch(`${API_BASE_URL}/api/browser/install-chrome`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                          }
                        });

                        const data = await response.json();

                        if (data.success) {
                          message.success({ content: 'Chrome 安装已启动，请稍候...', duration: 5 });
                          // 30秒后自动重新检查
                          setTimeout(recheckChrome, 30000);
                        } else {
                          Modal.error({
                            title: '安装失败',
                            content: (
                              <div>
                                <p>{data.message || data.error}</p>
                                {data.instructions && (
                                  <div>
                                    <p>请按照以下步骤操作：</p>
                                    <Steps
                                      direction="vertical"
                                      current={-1}
                                      size="small"
                                      items={data.instructions.steps.map((step: string) => ({ title: step }))}
                                    />
                                  </div>
                                )}
                              </div>
                            ),
                            width: 600
                          });
                        }
                      } catch (error) {
                        message.error('安装请求失败');
                      }
                    }}
                  >
                    一键安装 Chrome
                  </Button>
                )}
                {chromeCheckResult.installed && !chromeCheckResult.remoteDebugEnabled && (
                  <Button
                    type="primary"
                    onClick={async () => {
                      try {
                        const API_BASE_URL = import.meta.env.VITE_API_URL;
                        const response = await fetch(`${API_BASE_URL}/api/browser/launch-chrome`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                          }
                        });

                        const data = await response.json();

                        if (data.success) {
                          message.success({ content: data.message || 'Chrome 启动成功', duration: 5 });
                          // 3秒后自动重新检查
                          setTimeout(recheckChrome, 3000);
                        } else {
                          message.error(data.message || data.error);
                        }
                      } catch (error) {
                        message.error('启动 Chrome 失败');
                      }
                    }}
                  >
                    一键启动 Chrome
                  </Button>
                )}
                {chromeCheckResult.installed && chromeCheckResult.remoteDebugEnabled && (
                  <Button
                    type="primary"
                    onClick={() => setChromeCheckModalVisible(false)}
                  >
                    开始使用
                  </Button>
                )}
              </Space>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
