const WebSocket = require('ws');

async function testBrowserConnection() {
  const fetch = require('node-fetch');
  
  // 1. 获取token
  const tokenResponse = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const tokenData = await tokenResponse.json();
  const token = tokenData.token;

  console.log('✓ Token obtained');

  // 2. 获取浏览器标签
  const targetsResponse = await fetch('http://localhost:3001/api/browser/targets', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const targets = await targetsResponse.json();

  console.log(`✓ Found ${targets.length} browser target(s)`);
  targets.forEach(t => console.log(`  - ${t.title}: ${t.url}`));

  if (targets.length === 0) {
    console.error('\n✗ No browser targets found!');
    console.log('\nPlease make sure Chrome is running with remote debugging:');
    console.log('/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
    return;
  }

  const targetId = targets[0].id;
  console.log(`\n→ Connecting to: ${targets[0].title}`);
  console.log(`  Target ID: ${targetId}`);

  // 3. 连接到WebSocket
  const ws = new WebSocket(`ws://localhost:3001/ws/browser?token=${token}&targetId=${targetId}`);

  let messageCount = 0;
  let screenshotReceived = false;

  ws.on('open', () => {
    console.log('\n✓ WebSocket connected');
  });

  ws.on('message', (data) => {
    messageCount++;
    const msg = JSON.parse(data);
    console.log(`\n✓ Message ${messageCount}: ${msg.type}`);

    if (msg.type === 'ready') {
      console.log('  Session ID:', msg.sessionId);
      console.log('  → Requesting screenshot...');
      ws.send(JSON.stringify({ type: 'startScreenshot', data: { fps: 1 } }));
    }

    if (msg.type === 'screenshot') {
      screenshotReceived = true;
      const dataLength = msg.data.length;
      console.log(`  ✓ Screenshot: ${dataLength} bytes`);
      console.log(`  ✓ Format: data:image/png;base64,...`);
      setTimeout(() => ws.close(), 500);
    }

    if (msg.type === 'error') {
      console.error('  ✗ Error:', msg.message);
      ws.close();
    }
  });

  ws.on('error', (error) => {
    console.error('\n✗ WebSocket error:', error.message);
    process.exit(1);
  });

  ws.on('close', () => {
    console.log('\n✓ WebSocket closed');
    console.log(`\n📊 Statistics:`);
    console.log(`  Messages received: ${messageCount}`);
    console.log(`  Screenshot: ${screenshotReceived ? '✓' : '✗'}`);
    
    if (messageCount >= 2 && screenshotReceived) {
      console.log('\n✅✅✅ Browser connection test PASSED!');
      console.log('\n📝 The browser feature is working correctly.');
      console.log('📝 If you still see "未连接" in the UI:');
      console.log('   1. Refresh the browser page (http://localhost:5173/browser)');
      console.log('   2. Click on one of the browser targets in the left panel');
      console.log('   3. Wait for the connection and screenshot to load');
    } else {
      console.log('\n⚠ Test incomplete - please check browser service');
    }
    process.exit(screenshotReceived ? 0 : 1);
  });

  // 超时保护
  setTimeout(() => {
    console.log('\n⏱ Timeout (10s)');
    console.log('Messages received:', messageCount);
    console.log('Screenshot:', screenshotReceived);
    ws.close();
    process.exit(1);
  }, 10000);
}

testBrowserConnection().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
