const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { userId: 'test', username: 'testuser' },
  process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  { expiresIn: '1h' }
);

console.log('=== Testing Terminal Command Logging ===\n');

const ws = new WebSocket(`ws://localhost:3002/ws/terminal?token=${token}`, {
  perMessageDeflate: false
});

let commandCount = 0;

ws.on('open', () => {
  console.log('✓ Connected to terminal\n');

  // 发送一些测试命令
  const commands = [
    'echo "Hello World"',
    'pwd',
    'whoami',
    'ls -la',
    'echo "Test complete"'
  ];

  let delay = 500;
  commands.forEach(cmd => {
    setTimeout(() => {
      console.log(`Sending: ${cmd}`);
      ws.send(JSON.stringify({
        type: 'input',
        data: cmd + '\n'
      }));
      commandCount++;
    }, delay);
    delay += 1000;
  });

  // 最后测试一个危险命令（只是发送，不会真的执行）
  setTimeout(() => {
    console.log('\nSending dangerous command test (just for logging):');
    console.log('Sending: rm -rf /tmp/test');
    ws.send(JSON.stringify({
      type: 'input',
      data: 'rm -rf /tmp/test\n'
    }));
    commandCount++;
  }, delay + 1000);

  // 关闭连接
  setTimeout(() => {
    console.log(`\n✓ Sent ${commandCount} commands`);
    console.log('Closing connection...');
    ws.close();
  }, delay + 2000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    if (msg.type === 'ready') {
      console.log('✓ Terminal ready\n');
    } else if (msg.type === 'warning') {
      console.log(`⚠️  WARNING: ${msg.message}`);
      console.log(`   Command: ${msg.command}`);
      console.log(`   Reason: ${msg.reason}\n`);
    } else if (msg.type === 'data') {
      // 只显示重要输出
      const output = msg.data.trim();
      if (output && !output.includes('\x1b') && output.length < 100) {
        // 只显示简单的输出
      }
    }
  } catch (e) {
    // ignore
  }
});

ws.on('error', (error) => {
  console.error('✗ Error:', error.message);
});

ws.on('close', () => {
  console.log('\n✓ Connection closed');
  console.log('\n=== Checking log file ===');
  checkLogFile();
  process.exit(0);
});

function checkLogFile() {
  const fs = require('fs');
  const path = require('path');
  const logFile = path.join(process.cwd(), 'logs', 'terminal', 'commands.log');

  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    console.log(`\n📝 Log file: ${logFile}`);
    console.log(`📊 Total logged commands: ${lines.length}\n`);

    // 显示最近5条日志
    console.log('Recent logs:');
    lines.slice(-5).forEach((line, i) => {
      try {
        const log = JSON.parse(line);
        console.log(`\n${i + 1}. [${log.timestamp}]`);
        console.log(`   User: ${log.username}`);
        console.log(`   Command: ${log.command}`);
        console.log(`   CWD: ${log.cwd}`);

        // 检查是否危险
        const terminalLogger = require('./src/services/terminalLogger').terminalLogger;
        const risk = terminalLogger.isDangerousCommand(log.command);
        if (risk.dangerous) {
          console.log(`   ⚠️  DANGEROUS (${risk.level}): ${risk.reason}`);
        }
      } catch (e) {
        console.log(`   Invalid log entry`);
      }
    });

    console.log('\n✓ Command logging is working!');
  } else {
    console.log('⚠️  Log file not found yet (may be buffered)');
  }
}

// 运行15秒
setTimeout(() => {
  console.log('\n⏱ Timeout');
  process.exit(0);
}, 15000);
