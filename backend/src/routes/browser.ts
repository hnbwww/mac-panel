import { Router, Request, Response } from 'express';
import { browserService } from '../services/browserService';
import { requirePermission, AuthRequest } from '../middlewares/permission';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

/**
 * Chrome 安装检查和系统准备
 */
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

/**
 * 检查 Chrome 是否已安装
 */
async function checkChromeInstallation(): Promise<ChromeCheckResult> {
  const platform = process.platform;
  const result: ChromeCheckResult = {
    installed: false,
    platform,
    instructions: {
      title: '',
      steps: [],
      commands: []
    }
  };

  try {
    let chromePath = '';
    let version = '';

    if (platform === 'darwin') {
      // macOS
      const possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ];

      for (const path of possiblePaths) {
        try {
          await execAsync(`test -f "${path}"`);
          chromePath = path;
          break;
        } catch {
          continue;
        }
      }

      if (chromePath) {
        // 获取版本
        try {
          const { stdout } = await execAsync(`"${chromePath}" --version`);
          version = stdout.trim();
        } catch {
          version = 'Unknown';
        }
      }

      // macOS 安装说明
      result.instructions = {
        title: '在 macOS 上安装 Google Chrome',
        steps: [
          '1. 打开 Safari 浏览器',
          '2. 访问 https://www.google.com/chrome/',
          '3. 点击"下载 Chrome"按钮',
          '4. 下载完成后，双击安装包',
          '5. 将 Chrome 拖拽到应用程序文件夹',
          '6. 等待安装完成',
          '7. 在"启动台"中找到 Chrome 并打开'
        ],
        commands: [
          '或使用 Homebrew 安装：',
          'brew install --cask google-chrome',
          '',
          '安装后需要启动 Chrome 并开启远程调试：',
          'nohup /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\',
          '  --remote-debugging-port=9222 \\',
          '  --user-data-dir=/tmp/chrome-debug >/dev/null 2>&1 &'
        ]
      };

    } else if (platform === 'linux') {
      // Linux
      try {
        const { stdout } = await execAsync('which google-chrome google-chrome-stable chromium-browser chromium 2>/dev/null | head -n 1');
        chromePath = stdout.trim();
      } catch {
        // 未找到
      }

      if (chromePath) {
        try {
          const { stdout } = await execAsync(`"${chromePath}" --version`);
          version = stdout.trim();
        } catch {
          version = 'Unknown';
        }
      }

      // Linux 安装说明
      result.instructions = {
        title: '在 Linux 上安装 Google Chrome',
        steps: [
          '1. 下载 Chrome .deb 包（Debian/Ubuntu）',
          '2. 或下载 .rpm 包（Fedora/CentOS）',
          '3. 使用包管理器安装',
          '4. 启动 Chrome 并开启远程调试'
        ],
        commands: [
          'Debian/Ubuntu:',
          'wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb',
          'sudo dpkg -i google-chrome-stable_current_amd64.deb',
          'sudo apt-get install -f',
          '',
          'Fedora/CentOS:',
          'wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm',
          'sudo yum install -y google-chrome-stable_current_x86_64.rpm',
          '',
          '启动远程调试:',
          'google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug &'
        ]
      };

    } else if (platform === 'win32') {
      // Windows
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
      ];

      for (const path of possiblePaths) {
        try {
          await execAsync(`if exist "${path}" exit 0 else exit 1`, { shell: 'cmd.exe' });
          chromePath = path;
          break;
        } catch {
          continue;
        }
      }

      if (chromePath) {
        try {
          const { stdout } = await execAsync(`"${chromePath}" --version`);
          version = stdout.trim();
        } catch {
          version = 'Unknown';
        }
      }

      // Windows 安装说明
      result.instructions = {
        title: '在 Windows 上安装 Google Chrome',
        steps: [
          '1. 打开 Internet Explorer 或 Edge 浏览器',
          '2. 访问 https://www.google.com/chrome/',
          '3. 点击"下载 Chrome"按钮',
          '4. 下载完成后，双击安装程序',
          '5. 按照安装向导完成安装',
          '6. 安装完成后，以远程调试模式启动 Chrome'
        ],
        commands: [
          '或使用命令行启动远程调试：',
          '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\\chrome-debug'
        ]
      };
    }

    result.installed = !!chromePath;
    result.chromePath = chromePath || undefined;
    result.chromeVersion = version || undefined;

    // 检查 Chrome 是否正在运行并开启了远程调试
    if (result.installed) {
      try {
        await execAsync(`curl -s http://localhost:9222/json/version`);
        result.remoteDebugEnabled = true;
        result.running = true;
      } catch {
        result.remoteDebugEnabled = false;
        result.running = false;
      }
    }

  } catch (error: any) {
    result.installed = false;
  }

  return result;
}

// 获取可用的浏览器目标列表
router.get('/targets', async (req: Request, res: Response) => {
  try {
    const { host = 'localhost', port = 9222 } = req.query;

    const targets = await browserService.getTargets(
      host as string,
      parseInt(port as string)
    );

    res.json(targets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 创建新的浏览器标签页
router.post('/tabs', async (req: Request, res: Response) => {
  try {
    const { host = 'localhost', port = 9222, url = 'about:blank' } = req.body;

    const tab = await browserService.createTab(
      host as string,
      parseInt(port),
      url
    );

    res.json(tab);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 关闭浏览器标签页
router.delete('/tabs/:targetId', async (req: Request, res: Response) => {
  try {
    const { targetId } = req.params;
    const { host = 'localhost', port = 9222 } = req.query;

    await browserService.closeTab(
      targetId,
      host as string,
      parseInt(port as string)
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取浏览器状态信息
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { host = 'localhost', port = 9222 } = req.query;

    // 尝试获取目标列表来检查连接状态
    const targets = await browserService.getTargets(
      host as string,
      parseInt(port as string)
    );

    res.json({
      connected: true,
      host,
      port,
      targetCount: targets.length,
      targets
    });
  } catch (error: any) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// 获取浏览器状态信息
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { host = 'localhost', port = 9222 } = req.query;

    // 尝试获取目标列表来检查连接状态
    const targets = await browserService.getTargets(
      host as string,
      parseInt(port as string)
    );

    res.json({
      connected: true,
      host,
      port,
      targetCount: targets.length,
      targets
    });
  } catch (error: any) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

/**
 * GET /api/browser/check-chrome
 * 检查 Chrome 安装状态
 */
router.get('/check-chrome', async (req: any, res: Response) => {
  try {
    const result = await checkChromeInstallation();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to check Chrome installation',
      message: error.message
    });
  }
});

/**
 * GET /api/browser/start-chrome
 * 获取 Chrome 启动指引
 */
router.get('/start-chrome', async (req: any, res: Response) => {
  const check = await checkChromeInstallation();

  if (!check.installed) {
    return res.status(400).json({
      error: 'Chrome is not installed',
      instructions: check.instructions
    });
  }

  if (check.remoteDebugEnabled) {
    return res.json({
      success: true,
      message: 'Chrome is already running with remote debugging enabled'
    });
  }

  // 返回启动命令（让用户自己执行）
  let startCommand = '';

  if (check.platform === 'darwin') {
    startCommand = `nohup /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug >/dev/null 2>&1 &`;
  } else if (check.platform === 'linux') {
    startCommand = `google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug >/dev/null 2>&1 &`;
  } else if (check.platform === 'win32') {
    startCommand = `start "" "${check.chromePath}" --remote-debugging-port=9222 --user-data-dir=%TEMP%\\chrome-debug`;
  }

  res.json({
    success: false,
    message: 'Chrome is installed but not running with remote debugging',
    chromePath: check.chromePath,
    startCommand,
    instructions: {
      title: '启动 Chrome 远程调试模式',
      steps: [
        '1. 打开终端（Terminal）或命令提示符',
        '2. 复制并执行以下命令：',
        '3. Chrome 将在远程调试模式下启动',
        '4. 保持 Chrome 窗口打开',
        '5. 返回此页面，点击"重新检查"按钮'
      ],
      commands: [startCommand]
    }
  });
});

/**
 * POST /api/browser/install-chrome
 * 尝试安装 Chrome（通过 Homebrew 或下载）
 */
router.post('/install-chrome', async (req: any, res: Response) => {
  const check = await checkChromeInstallation();

  if (check.installed) {
    return res.json({
      success: true,
      message: 'Chrome is already installed',
      chromePath: check.chromePath
    });
  }

  try {
    if (check.platform === 'darwin') {
      // macOS: 使用 Homebrew 安装
      // 首先检查 Homebrew 是否已安装
      try {
        await execAsync('which brew');
        // Homebrew 已安装，直接安装 Chrome
        const { stdout, stderr } = await execAsync('brew install --cask google-chrome');
        return res.json({
          success: true,
          message: 'Chrome installation started via Homebrew',
          output: stdout,
          error: stderr
        });
      } catch (error: any) {
        // Homebrew 未安装，返回安装指引
        return res.status(400).json({
          success: false,
          error: 'Homebrew not found',
          message: '请先安装 Homebrew，然后重试',
          instructions: {
            title: '先安装 Homebrew',
            steps: [
              '1. 打开终端（Terminal）',
              '2. 复制并执行以下命令安装 Homebrew：',
              '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
              '3. 等待 Homebrew 安装完成',
              '4. 返回此页面，点击"安装 Chrome"按钮'
            ],
            commands: ['/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"']
          }
        });
      }
    } else if (check.platform === 'linux') {
      // Linux: 尝试使用包管理器
      try {
        // 尝试 Debian/Ubuntu
        await execAsync('which apt-get');
        return res.json({
          success: true,
          message: 'Starting Chrome installation via apt-get',
          commands: [
            'wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb',
            'sudo dpkg -i google-chrome-stable_current_amd64.deb',
            'sudo apt-get install -f'
          ]
        });
      } catch {
        try {
          // 尝试 Fedora/CentOS
          await execAsync('which yum');
          return res.json({
            success: true,
            message: 'Starting Chrome installation via yum',
            commands: [
              'wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm',
              'sudo yum install -y google-chrome-stable_current_x86_64.rpm'
            ]
          });
        } catch {
          return res.status(400).json({
            success: false,
            error: 'Unsupported package manager',
            message: '请手动从官网下载安装'
          });
        }
      }
    } else if (check.platform === 'win32') {
      return res.status(400).json({
        success: false,
        error: 'Windows installation requires manual download',
        message: '请访问 https://www.google.com/chrome/ 下载安装'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: '安装失败，请手动安装'
    });
  }
});

/**
 * POST /api/browser/launch-chrome
 * 启动 Chrome 远程调试模式
 */
router.post('/launch-chrome', async (req: any, res: Response) => {
  const check = await checkChromeInstallation();

  if (!check.installed) {
    return res.status(400).json({
      error: 'Chrome is not installed'
    });
  }

  if (check.remoteDebugEnabled) {
    return res.json({
      success: true,
      message: 'Chrome is already running with remote debugging enabled'
    });
  }

  try {
    let command = '';

    if (check.platform === 'darwin') {
      command = `nohup /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug >/dev/null 2>&1 &`;
    } else if (check.platform === 'linux') {
      command = `nohup google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug >/dev/null 2>&1 &`;
    } else if (check.platform === 'win32') {
      command = `start "" "${check.chromePath}" --remote-debugging-port=9222 --user-data-dir=%TEMP%\\chrome-debug`;
    }

    await execAsync(command);

    // 等待一下，然后检查是否成功启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    const recheck = await checkChromeInstallation();

    if (recheck.remoteDebugEnabled) {
      return res.json({
        success: true,
        message: 'Chrome 启动成功，远程调试已启用'
      });
    } else {
      return res.json({
        success: true,
        message: 'Chrome 启动命令已执行，请稍等几秒后点击"重新检查"',
        note: 'Chrome 可能正在启动中'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: '启动 Chrome 失败，请手动启动'
    });
  }
});

export default router;
