const WebSocket = require('ws');

// 使用用户的token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlhdCI6MTc3MjcyODA1MywiZXhwIjoxNzczMzMyODUzfQ.pIiiIaMOq3mZhJTsR-YdmsJkJmoSoiC6uB4UT6oamlc';
const targetId = 'C14CE47EBB1530C8CCC0B65AC4FBE1E1';
const wsUrl = `ws://localhost:3003/ws/browser?token=${token}&targetId=${targetId}`;

console.log('正在连接到浏览器WebSocket...');
console.log('URL:', wsUrl.replace(token, '***'));

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ WebSocket 已连接');
  console.log('→ 等待 ready 消息...');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    console.log('✓ 收到消息:', msg.type);

    if (msg.type === 'ready') {
      console.log('  会话ID:', msg.sessionId);
      console.log('→ 发送 startScreenshot 命令...');
      ws.send(JSON.stringify({ type: 'startScreenshot', data: { fps: 1 } }));
    }

    if (msg.type === 'screenshot') {
      console.log('✓ 收到截图! 大小:', msg.data.length, 'bytes');
      setTimeout(() => ws.close(), 1000);
    }

    if (msg.type === 'error') {
      console.log('✗ 错误:', msg.message);
      ws.close();
    }
  } catch (e) {
    console.log('✗ 消息解析错误:', e.message);
    console.log('原始数据:', data.toString().substring(0, 100));
  }
});

ws.on('error', (error) => {
  console.log('✗ WebSocket 错误:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('✗ WebSocket 已关闭');
  console.log('  代码:', code);
  console.log('  原因:', reason.toString() || 'none');
});

// 10秒超时
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('⏱ 超时，关闭连接');
    ws.close();
  }
}, 10000);
