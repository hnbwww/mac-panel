import { useEffect, useState, useRef } from 'react';
import { Card, Button, Input, Space, Typography } from 'antd';
import './TerminalTest.css';

const { TextArea } = Input;
const { Title, Text } = Typography;

export default function TerminalTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    addLog('Component mounted');

    const token = localStorage.getItem('token');
    const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    // 如果URL已包含路径则不重复添加
    const wsUrl = WS_BASE_URL.includes('/ws')
      ? `${WS_BASE_URL}/terminal?token=${token}`
      : `${WS_BASE_URL}/ws/terminal?token=${token}`;

    addLog(`Connecting to: ${wsUrl?.replace(token || '', '***')}`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('✓ WebSocket onopen fired');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      addLog(`✓ WebSocket onmessage received, length: ${event.data.length}`);

      try {
        const message = JSON.parse(event.data);
        addLog(`  Message type: ${message.type}`);
        addLog(`  Message data: ${JSON.stringify(message).substring(0, 100)}...`);
      } catch (error) {
        addLog(`  Failed to parse JSON, raw data: ${event.data.substring(0, 100)}...`);
      }
    };

    ws.onerror = (error) => {
      addLog('✗ WebSocket onerror fired');
      addLog(`  Error: ${JSON.stringify(error)}`);
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      addLog(`✗ WebSocket onclose fired`);
      addLog(`  Code: ${event.code}`);
      addLog(`  Reason: ${event.reason || 'none'}`);
      addLog(`  Was clean: ${event.wasClean}`);
      setIsConnected(false);
    };

    return () => {
      addLog('Component unmounting, closing WebSocket');
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('✗ WebSocket not connected');
      return;
    }

    const message = {
      type: 'input',
      data: inputValue + '\n'
    };

    addLog(`Sending: ${JSON.stringify(message)}`);
    wsRef.current.send(JSON.stringify(message));
    setInputValue('');
  };

  const testCommands = [
    { cmd: 'pwd\n', label: 'pwd' },
    { cmd: 'ls\n', label: 'ls' },
    { cmd: 'echo "test"\n', label: 'echo test' },
    { cmd: 'whoami\n', label: 'whoami' }
  ];

  return (
    <div className="terminal-test-page">
      <Card>
        <Title level={3}>终端 WebSocket 测试</Title>

        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 连接状态 */}
          <div>
            <Text strong>连接状态：</Text>
            <span style={{
              marginLeft: 16,
              padding: '4px 12px',
              borderRadius: 4,
              background: isConnected ? '#52c41a' : '#ff4d4f',
              color: 'white'
            }}>
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>

          {/* 快速测试命令 */}
          <div>
            <Text strong>快速命令：</Text>
            <div style={{ marginTop: 8 }}>
              {testCommands.map(({ cmd, label }) => (
                <Button
                  key={label}
                  size="small"
                  style={{ marginRight: 8 }}
                  disabled={!isConnected}
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      addLog(`Sending: ${label}`);
                      wsRef.current.send(JSON.stringify({ type: 'input', data: cmd }));
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义输入 */}
          <div>
            <Text strong>发送命令：</Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder="输入命令..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={sendMessage}
              disabled={!isConnected}
              addonAfter={
                <Button type="primary" onClick={sendMessage} disabled={!isConnected}>
                  发送
                </Button>
              }
            />
          </div>

          {/* 日志 */}
          <div>
            <Text strong>日志：</Text>
            <TextArea
              style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12 }}
              rows={20}
              value={logs.join('\n')}
              readOnly
            />
          </div>

          {/* 清除日志 */}
          <Button onClick={() => setLogs([])}>清除日志</Button>
        </Space>
      </Card>
    </div>
  );
}
