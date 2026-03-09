import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Space } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useTerminalStore } from '../store';
import 'xterm/css/xterm.css';
import './Terminal.css';

export default function TerminalPage() {
  const [searchParams] = useSearchParams();
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { tabs, activeTab, addTab, removeTab, setActiveTab } = useTerminalStore();

  useEffect(() => {
    console.log('[Terminal] Component mounted');
    initTerminal();

    return () => {
      console.log('[Terminal] Component unmounting, cleaning up...');
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (wsRef.current) {
        console.log('[Terminal] Closing WebSocket on unmount');
        wsRef.current.close();
      }
    };
  }, []);

  const initTerminal = () => {
    console.log('[Terminal] Initializing terminal...');
    if (!terminalRef.current) {
      console.error('[Terminal] terminalRef.current is null!');
      return;
    }

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = { terminal, fitAddon };
    console.log('[Terminal] Terminal instance created');

    // Connect to WebSocket
    connectWebSocket(terminal);
  };

  const connectWebSocket = (terminal: Terminal) => {
    console.log('[Terminal] Connecting to WebSocket...');
    const token = localStorage.getItem('token');

    // 调试：检查环境变量
    console.log('[Terminal] Environment check:');
    console.log('[Terminal] VITE_TERMINAL_WS_URL:', import.meta.env.VITE_TERMINAL_WS_URL);
    console.log('[Terminal] All env vars:', {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_WS_URL: import.meta.env.VITE_WS_URL,
      VITE_TERMINAL_WS_URL: import.meta.env.VITE_TERMINAL_WS_URL,
      VITE_BROWSER_WS_URL: import.meta.env.VITE_BROWSER_WS_URL
    });

    // 使用专门的终端WebSocket URL
    const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || 'ws://localhost:3002';
    // 如果URL已包含路径则不重复添加
    const wsUrl = TERMINAL_WS_URL.includes('/ws/terminal')
      ? `${TERMINAL_WS_URL}?token=${token}`
      : `${TERMINAL_WS_URL}/ws/terminal?token=${token}`;

    console.log('[Terminal] Final WebSocket URL:', wsUrl?.replace(token || '', '***'));

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Terminal] WebSocket onopen fired');
      setIsConnected(true);
      terminal.clear();
      terminal.write('\r\n✓ Connecting to terminal...\r\n');
    };

    ws.onmessage = (event) => {
      console.log('[Terminal] WebSocket onmessage, length:', event.data.length);
      try {
        const message = JSON.parse(event.data);
        console.log('[Terminal Frontend] Received message:', message.type);

        switch (message.type) {
          case 'data':
            // 写入终端数据
            terminal.write(message.data);
            break;

          case 'ready':
            // 终端就绪
            console.log('[Terminal Frontend] Terminal ready:', message);
            terminal.clear();
            terminal.write(`\r\n✓ Terminal ready\r\n`);
            terminal.write(`Session: ${message.sessionId}\r\n`);
            terminal.write(`Shell: ${message.shell}\r\n`);
            terminal.write(`Directory: ${message.cwd}\r\n`);
            terminal.write(`\r\n`);

            // Check if workdir parameter is provided
            const workDir = searchParams.get('workdir');
            if (workDir && ws.readyState === WebSocket.OPEN) {
              console.log('[Terminal] Changing to work directory:', workDir);
              terminal.write(`\r\n→ Changing to: ${workDir}\r\n`);
              // Send cd command
              ws.send(JSON.stringify({ type: 'input', data: `cd "${workDir}"\r` }));
            }

            break;

          case 'exit':
            // 终端退出
            console.log('[Terminal Frontend] Terminal exited:', message);
            terminal.write(`\r\n✓ Terminal exited (code: ${message.exitCode})\r\n`);
            setIsConnected(false);
            break;

          case 'error':
            // 错误消息
            console.log('[Terminal Frontend] Error:', message);
            terminal.write(`\r\n✗ Error: ${message.message}\r\n`);
            setIsConnected(false);
            break;

          case 'pong':
            // 心跳响应，忽略
            break;

          default:
            console.log('[Terminal Frontend] Unknown message type:', message.type);
            // 其他消息，尝试写入 data 字段
            if (message.data) {
              terminal.write(message.data);
            }
        }
      } catch (error) {
        console.error('[Terminal Frontend] Error parsing message:', error);
        // 如果不是 JSON 格式，直接写入
        terminal.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('[Terminal] WebSocket onerror:', error);
      terminal.write('\r\n✗ Connection error\r\n');
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('[Terminal] WebSocket onclose:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
      terminal.write(`\r\n✗ Connection closed (code: ${event.code})\r\n`);
      setIsConnected(false);
    };

    terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // 监听终端尺寸变化
    const handleResize = () => {
      if (terminalInstanceRef.current && ws.readyState === WebSocket.OPEN) {
        terminalInstanceRef.current.fitAddon.fit();
        const dims = { cols: terminal.cols, rows: terminal.rows };
        console.log('[Terminal] Resizing to:', dims);
        ws.send(JSON.stringify({
          type: 'resize',
          data: dims
        }));
      }
    };

    window.addEventListener('resize', handleResize);

    // 初始尺寸（延迟执行，确保终端已完全初始化）
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = setTimeout(() => {
      handleResize();
    }, 500);
  };

  const handleNewTab = () => {
    const newTab = {
      id: Date.now().toString(),
      title: `Terminal ${tabs.length + 1}`,
    };
    addTab(newTab);
    setActiveTab(newTab.id);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) {
      return; // Don't close the last tab
    }
    removeTab(tabId);
  };

  return (
    <div className="terminal-page">
      <div className="terminal-header">
        <Space className="terminal-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`terminal-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <CloseOutlined
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                />
              )}
            </div>
          ))}
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleNewTab}
          >
            新建
          </Button>
        </Space>

        <Space>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : ''}`} />
            {isConnected ? '已连接' : '未连接'}
          </div>
        </Space>
      </div>

      <Card className="terminal-card" bodyStyle={{ padding: 0 }}>
        <div ref={terminalRef} className="terminal-container" />
      </Card>
    </div>
  );
}
