const CDP = require('chrome-remote-interface');

async function testBrowserConnection() {
  console.log('Testing Chrome Remote Debugging Protocol connection...\n');

  // 默认尝试几个可能的端口
  const ports = [9222, 9223, 9224, 9225];

  for (const port of ports) {
    try {
      console.log(`Trying port ${port}...`);

      // 尝试获取目标列表
      const targets = await CDP.List({ port });

      console.log(`✓ Connected to Chrome on port ${port}`);
      console.log(`Found ${targets.length} targets:\n`);

      // 显示可用的标签页
      const pages = targets.filter(t => t.type === 'page');
      if (pages.length > 0) {
        console.log('Available pages:');
        pages.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.title}`);
          console.log(`     URL: ${t.url}`);
          console.log(`     ID: ${t.id}\n`);
        });
      } else {
        console.log('No pages found. Chrome might not have any tabs open.\n');
      }

      // 尝试创建新标签页
      try {
        console.log('Creating a new tab...');
        const newTarget = await CDP.New({ port, url: 'about:blank' });
        console.log(`✓ Created new tab with ID: ${newTarget.id}\n`);

        // 关闭刚创建的标签页
        console.log('Closing the test tab...');
        await CDP.Close({ port, id: newTarget.id });
        console.log('✓ Tab closed\n');
      } catch (err) {
        console.error(`✗ Failed to create tab: ${err.message}\n`);
      }

      console.log('✓ All browser CDP functions are working!');
      return true;
    } catch (err) {
      console.log(`✗ Port ${port} failed: ${err.message}\n`);
    }
  }

  console.error('\n❌ Could not connect to Chrome on any port.');
  console.error('\nPlease start Chrome with remote debugging enabled:');
  console.error(`
macOS:
  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222

Linux:
  google-chrome --remote-debugging-port=9222

Windows:
  chrome.exe --remote-debugging-port=9222
  `);

  return false;
}

testBrowserConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
