import CDP from 'chrome-remote-interface';
import { WebSocket, WebSocketServer } from 'ws';

interface BrowserSession {
  id: string;
  client: any;
  ws: WebSocket;
  targetId: string;
  url?: string;
  title?: string;
  userId?: string;
}

interface Size {
  width: number;
  height: number;
}

class BrowserService {
  private sessions: Map<string, BrowserSession> = new Map();
  private screenshotInterval: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 获取可用的 Chrome 浏览器目标列表
   */
  async getTargets(host = 'localhost', port = 9222): Promise<any[]> {
    try {
      const targets = await CDP.List({ host, port });
      return targets
        .filter((t: any) => t.type === 'page' || t.type === 'iframe')
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          type: t.type
        }));
    } catch (error: any) {
      throw new Error(`Failed to get browser targets: ${error.message}`);
    }
  }

  /**
   * 创建新的浏览器标签页
   */
  async createTab(host = 'localhost', port = 9222, url = 'about:blank'): Promise<any> {
    try {
      const target = await CDP.New({ host, port, url });
      return {
        id: target.id,
        title: 'New Tab',
        url: target.url || url
      };
    } catch (error: any) {
      throw new Error(`Failed to create new tab: ${error.message}`);
    }
  }

  /**
   * 关闭浏览器标签页
   */
  async closeTab(targetId: string, host = 'localhost', port = 9222): Promise<void> {
    try {
      await CDP.Close({ host, port, id: targetId });
    } catch (error: any) {
      throw new Error(`Failed to close tab: ${error.message}`);
    }
  }

  /**
   * 连接到浏览器目标并创建会话
   */
  async connectToTarget(
    ws: WebSocket,
    targetId: string,
    options: {
      host?: string;
      port?: number;
      userId?: string;
    } = {}
  ): Promise<string> {
    const { host = 'localhost', port = 9222, userId } = options;

    try {
      // 连接到 CDP
      const client = await CDP({ target: targetId });

      const session: BrowserSession = {
        id: `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        client,
        ws,
        targetId,
        userId
      };

      this.sessions.set(session.id, session);

      // 启用必要的域
      const { Page, Runtime, Input, Network } = await client;

      await Page.enable();
      await Runtime.enable();
      // Input 不需要 enable
      await Network.enable();

      // 设置页面内容
      await this.setupPageHandlers(session);

      // 发送就绪消息
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ready',
          sessionId: session.id,
          targetId
        }));
      }

      return session.id;
    } catch (error: any) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Failed to connect to browser: ${error.message}`
        }));
      }
      throw error;
    }
  }

  /**
   * 设置页面事件处理器
   */
  private async setupPageHandlers(session: BrowserSession): Promise<void> {
    const { Page, Runtime } = session.client;

    // 监听页面加载事件
    Page.loadEventFired(async () => {
      try {
        const result = await Runtime.evaluate({
          expression: 'document.title'
        });

        session.title = result.result.value;

        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({
            type: 'pageLoaded',
            title: session.title
          }));
        }
      } catch (error) {
        console.error('Error getting page title:', error);
      }
    });

    // 监听导航事件
    Page.frameNavigated(async ({ frame }: any) => {
      if (frame.parentId === undefined) { // 只处理主框架
        session.url = frame.url;
        session.title = frame.name || 'Loading...';

        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({
            type: 'navigated',
            url: session.url,
            title: session.title
          }));
        }
      }
    });
  }

  /**
   * 开始截图流
   */
  startScreenshotStream(sessionId: string, fps = 2): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error('[Browser] startScreenshot: Session not found:', sessionId);
      throw new Error('Session not found');
    }

    console.log(`[Browser] Starting screenshot stream for session ${sessionId} at ${fps} FPS`);

    // 清除旧的定时器
    this.stopScreenshotStream(sessionId);

    let screenshotCount = 0;

    const interval = setInterval(async () => {
      try {
        const screenshot = await this.captureScreenshot(sessionId);
        if (screenshot && session.ws.readyState === WebSocket.OPEN) {
          screenshotCount++;
          if (screenshotCount <= 3 || screenshotCount % 10 === 0) {
            // 只打印前3次和每10次
            console.log(`[Browser] Screenshot ${screenshotCount} sent, size: ${screenshot.length} bytes`);
          }
          session.ws.send(JSON.stringify({
            type: 'screenshot',
            data: screenshot,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('[Browser] Screenshot error:', error);
      }
    }, Math.floor(1000 / fps));

    this.screenshotInterval.set(sessionId, interval);
    console.log(`[Browser] Screenshot interval set: ${Math.floor(1000 / fps)}ms`);
  }

  /**
   * 停止截图流
   */
  stopScreenshotStream(sessionId: string): void {
    const interval = this.screenshotInterval.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.screenshotInterval.delete(sessionId);
    }
  }

  /**
   * 截取屏幕截图
   */
  async captureScreenshot(sessionId: string, format = 'png', quality = 80): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      const { Page } = session.client;
      const result = await Page.captureScreenshot({
        format,
        quality: format === 'jpeg' ? quality : undefined
      });

      return result.data;
    } catch (error) {
      console.error('Capture screenshot error:', error);
      return null;
    }
  }

  /**
   * 导航到指定 URL
   */
  async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Page } = session.client;
    await Page.navigate({ url });
    session.url = url;
  }

  /**
   * 刷新页面
   */
  async reload(sessionId: string, ignoreCache = false): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Page } = session.client;
    await Page.reload({ ignoreCache });
  }

  /**
   * 后退
   */
  async goBack(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Page } = session.client;
    await Page.navigateBack();
  }

  /**
   * 前进
   */
  async goForward(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Page } = session.client;
    await Page.navigateForward();
  }

  /**
   * 设置视口大小
   */
  async setViewport(sessionId: string, size: Size): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Emulation } = session.client;

    await Emulation.setDeviceMetricsOverride({
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: false
    });

    await Emulation.setVisibleSize({
      width: size.width,
      height: size.height
    });

    // 等待一小段时间确保布局更新
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 点击元素
   */
  async click(sessionId: string, x: number, y: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input, Runtime } = session.client;

    // 获取页面缩放比例
    const result = await Runtime.evaluate({
      expression: 'window.devicePixelRatio || 1'
    });
    const devicePixelRatio = result.result.value || 1;

    // 执行点击
    await Input.dispatchMouseEvent({
      type: 'mousePressed',
      x: x * devicePixelRatio,
      y: y * devicePixelRatio,
      button: 'left',
      clickCount: 1
    });

    await Input.dispatchMouseEvent({
      type: 'mouseReleased',
      x: x * devicePixelRatio,
      y: y * devicePixelRatio,
      button: 'left',
      clickCount: 1
    });
  }

  /**
   * 滚动页面（使用鼠标滚轮）
   */
  async scroll(sessionId: string, x: number, y: number, deltaX: number, deltaY: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input, Runtime } = session.client;

    // 获取页面缩放比例
    const result = await Runtime.evaluate({
      expression: 'window.devicePixelRatio || 1'
    });
    const devicePixelRatio = result.result.value || 1;

    // 在指定位置发送滚轮事件
    await Input.dispatchMouseEvent({
      type: 'mouseWheel',
      x: x * devicePixelRatio,
      y: y * devicePixelRatio,
      deltaX: deltaX,
      deltaY: deltaY
    });
  }

  /**
   * 发送按键事件
   */
  async keypress(sessionId: string, key: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input } = session.client;

    // 映射按键名称
    const keyMap: { [key: string]: string } = {
      'Enter': 'Enter',
      'Tab': 'Tab',
      'Escape': 'Escape',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight'
    };

    const mappedKey = keyMap[key] || key;

    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: mappedKey,
      code: mappedKey
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: mappedKey,
      code: mappedKey
    });
  }

  /**
   * 复制
   */
  async copy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input, Runtime } = session.client;

    console.log('[Browser] Starting copy operation...');

    // 首先检查当前是否有选中的文字
    try {
      const beforeCopyResult = await Runtime.evaluate({
        expression: 'window.getSelection().toString()',
        returnByValue: true
      });
      console.log('[Browser] Selection before Ctrl+C:', beforeCopyResult.result.value ? `"${beforeCopyResult.result.value.substring(0, 50)}..."` : '(empty)');
    } catch (e: any) {
      console.log('[Browser] Could not check selection before copy:', e?.message || e);
    }

    // 执行 Ctrl+C
    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'Control',
      code: 'ControlLeft'
    });

    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'c',
      code: 'KeyC'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'c',
      code: 'KeyC'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'Control',
      code: 'ControlLeft'
    });

    console.log('[Browser] Ctrl+C executed, waiting for clipboard...');

    // 尝试获取选中的文本内容
    try {
      // 增加延迟时间，确保复制操作完成
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('[Browser] Evaluating selected text...');

      // 方法1: 使用 window.getSelection()
      const result = await Runtime.evaluate({
        expression: 'window.getSelection().toString()',
        returnByValue: true
      });

      let selectedText = result.result.value;
      console.log('[Browser] Method 1 (getSelection):', selectedText ? `"${selectedText.substring(0, 50)}..."` : '(empty)');

      // 方法2: 如果方法1没获取到，尝试使用 document.selection (IE兼容)
      if (!selectedText) {
        try {
          const result2 = await Runtime.evaluate({
            expression: 'document.selection ? document.selection.createRange().text : ""',
            returnByValue: true
          });
          selectedText = result2.result.value;
          console.log('[Browser] Method 2 (document.selection):', selectedText ? `"${selectedText.substring(0, 50)}..."` : '(empty)');
        } catch (e: any) {
          console.log('[Browser] Method 2 failed:', e?.message || e);
        }
      }

      // 方法3: 尝试获取剪贴板内容（需要在有选中文字的情况下）
      if (!selectedText) {
        try {
          const result3 = await Runtime.evaluate({
            expression: `(() => {
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                return range.toString();
              }
              return "";
            })()`,
            returnByValue: true
          });
          selectedText = result3.result.value;
          console.log('[Browser] Method 3 (range):', selectedText ? `"${selectedText.substring(0, 50)}..."` : '(empty)');
        } catch (e: any) {
          console.log('[Browser] Method 3 failed:', e?.message || e);
        }
      }

      console.log('[Browser] Final selected text:', selectedText ? `"${selectedText.substring(0, 50)}..." (length: ${selectedText.length})` : '(empty)');

      if (session.ws.readyState === WebSocket.OPEN) {
        if (selectedText && selectedText.trim().length > 0) {
          // 有选中的文字
          session.ws.send(JSON.stringify({
            type: 'copiedText',
            data: {
              text: selectedText,
              timestamp: Date.now()
            }
          }));
          console.log('[Browser] ✓ Sent copiedText message with', selectedText.length, 'characters');
        } else {
          // 没有选中的文字，发送空消息提示
          session.ws.send(JSON.stringify({
            type: 'info',
            data: {
              message: '未检测到选中的文字。提示：拖拽选择后需要单击确认复制'
            }
          }));
          console.log('[Browser] ⚠ No text selected, sent info message');
        }
      } else {
        console.error('[Browser] ✗ WebSocket not open');
      }
    } catch (error: any) {
      console.error('[Browser] Error getting selected text:', error);
      // 发送错误消息
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({
          type: 'error',
          message: '复制失败：' + (error?.message || '未知错误')
        }));
      }
    }
  }

  /**
   * 粘贴
   */
  async paste(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input } = session.client;

    // 先执行 Ctrl+V
    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'Control',
      code: 'ControlLeft'
    });

    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'v',
      code: 'KeyV'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'v',
      code: 'KeyV'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'Control',
      code: 'ControlLeft'
    });

    // 如果提供了文本，直接输入（因为在非 HTTPS 环境下剪贴板 API 不可用）
    if (text && text.length > 0) {
      await this.type(sessionId, text);
    }
  }

  /**
   * 全选
   */
  async selectAll(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input } = session.client;

    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'Control',
      code: 'ControlLeft'
    });

    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'a',
      code: 'KeyA'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'a',
      code: 'KeyA'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'Control',
      code: 'ControlLeft'
    });
  }

  /**
   * 剪切
   */
  async cut(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input } = session.client;

    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'Control',
      code: 'ControlLeft'
    });

    await Input.dispatchKeyEvent({
      type: 'keyDown',
      key: 'x',
      code: 'KeyX'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'x',
      code: 'KeyX'
    });

    await Input.dispatchKeyEvent({
      type: 'keyUp',
      key: 'Control',
      code: 'ControlLeft'
    });
  }

  /**
   * 右键点击
   */
  async contextMenu(sessionId: string, x: number, y: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input, Runtime } = session.client;

    // 获取页面缩放比例
    const result = await Runtime.evaluate({
      expression: 'window.devicePixelRatio || 1'
    });
    const devicePixelRatio = result.result.value || 1;

    // 执行右键点击
    await Input.dispatchMouseEvent({
      type: 'mousePressed',
      x: x * devicePixelRatio,
      y: y * devicePixelRatio,
      button: 'right',
      clickCount: 1
    });

    await Input.dispatchMouseEvent({
      type: 'mouseReleased',
      x: x * devicePixelRatio,
      y: y * devicePixelRatio,
      button: 'right',
      clickCount: 1
    });
  }

  /**
   * 选择文字（通过拖拽）
   */
  async selectText(sessionId: string, startX: number, startY: number, endX: number, endY: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input, Runtime } = session.client;

    console.log('[Browser] ========== selectText START ==========');
    console.log('[Browser] Coordinates:', { startX, startY, endX, endY });

    // 获取页面缩放比例
    const result = await Runtime.evaluate({
      expression: 'window.devicePixelRatio || 1'
    });
    const devicePixelRatio = result.result.value || 1;
    console.log('[Browser] Device pixel ratio:', devicePixelRatio);

    // 1. 在起始位置按下鼠标
    console.log('[Browser] Step 1: Mouse down at', Math.round(startX * devicePixelRatio), Math.round(startY * devicePixelRatio));
    await Input.dispatchMouseEvent({
      type: 'mousePressed',
      x: startX * devicePixelRatio,
      y: startY * devicePixelRatio,
      button: 'left',
      clickCount: 1
    });

    // 添加延迟，确保按下操作完成
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. 拖拽到结束位置（分步移动）
    const steps = 8;  // 增加到8步，更平滑
    console.log('[Browser] Step 2: Dragging in', steps, 'steps');
    for (let i = 0; i <= steps; i++) {
      const x = startX + (endX - startX) * (i / steps);
      const y = startY + (endY - startY) * (i / steps);
      await Input.dispatchMouseEvent({
        type: 'mouseMoved',
        x: x * devicePixelRatio,
        y: y * devicePixelRatio,
        button: 'left'  // 保持按下状态
      });
      // 每次移动间延迟，模拟真实拖拽
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    // 3. 释放鼠标
    console.log('[Browser] Step 3: Mouse up at', Math.round(endX * devicePixelRatio), Math.round(endY * devicePixelRatio));
    await Input.dispatchMouseEvent({
      type: 'mouseReleased',
      x: endX * devicePixelRatio,
      y: endY * devicePixelRatio,
      button: 'left',
      clickCount: 1
    });

    // 等待选择操作完成
    console.log('[Browser] Step 4: Waiting for selection to complete...');
    await new Promise(resolve => setTimeout(resolve, 200));

    // 4. 验证是否有选中的文字
    try {
      const checkResult = await Runtime.evaluate({
        expression: 'window.getSelection().toString()',
        returnByValue: true
      });
      const selectedText = checkResult.result.value;
      if (selectedText) {
        console.log('[Browser] ✓ Text selected successfully:', `"${selectedText.substring(0, 50)}..."`);
      } else {
        console.log('[Browser] ⚠ No text selected after drag');
      }
    } catch (e: any) {
      console.log('[Browser] Could not verify selection:', e?.message || e);
    }

    console.log('[Browser] ========== selectText END ==========');
  }

  /**
   * 输入文本
   */
  async type(sessionId: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Input } = session.client;

    for (const char of text) {
      if (char === '\n') {
        await Input.dispatchKeyEvent({
          type: 'char',
          key: 'Enter',
          text: '\r',
          code: 'Enter'
        });
      } else if (char === '\t') {
        await Input.dispatchKeyEvent({
          type: 'char',
          key: 'Tab',
          text: '\t',
          code: 'Tab'
        });
      } else if (char === '\b') {
        await Input.dispatchKeyEvent({
          type: 'keyDown',
          key: 'Backspace',
          code: 'Backspace'
        });
        await Input.dispatchKeyEvent({
          type: 'keyUp',
          key: 'Backspace',
          code: 'Backspace'
        });
      } else {
        await Input.dispatchKeyEvent({
          type: 'char',
          key: char,
          text: char
        });
      }
    }
  }

  /**
   * 执行 JavaScript 代码
   */
  async executeScript(sessionId: string, script: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { Runtime } = session.client;

    const result = await Runtime.evaluate({
      expression: script,
      returnByValue: true
    });

    return result.result.value;
  }

  /**
   * 获取当前页面信息
   */
  async getPageInfo(sessionId: string): Promise<{ url?: string; title?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return {
      url: session.url,
      title: session.title
    };
  }

  /**
   * 关闭会话
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // 停止截图流
    this.stopScreenshotStream(sessionId);

    // 关闭 CDP 连接
    try {
      await session.client.close();
    } catch (error) {
      console.error('Error closing client:', error);
    }

    // 关闭 WebSocket
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }

    // 删除会话
    this.sessions.delete(sessionId);
  }

  /**
   * 处理 WebSocket 消息
   */
  async handleWebSocketMessage(sessionId: string, message: any): Promise<void> {
    const { type, data } = message;

    try {
      switch (type) {
        case 'startScreenshot':
          this.startScreenshotStream(sessionId, data?.fps || 2);
          break;

        case 'stopScreenshot':
          this.stopScreenshotStream(sessionId);
          break;

        case 'navigate':
          await this.navigate(sessionId, data.url);
          break;

        case 'reload':
          await this.reload(sessionId, data?.ignoreCache);
          break;

        case 'goBack':
          await this.goBack(sessionId);
          break;

        case 'goForward':
          await this.goForward(sessionId);
          break;

        case 'click':
          await this.click(sessionId, data.x, data.y);
          break;

        case 'scroll':
          await this.scroll(sessionId, data.x || 0, data.y || 0, data.deltaX || 0, data.deltaY || 0);
          break;

        case 'keypress':
          await this.keypress(sessionId, data.key);
          break;

        case 'copy':
          await this.copy(sessionId);
          break;

        case 'paste':
          await this.paste(sessionId, data.text || '');
          break;

        case 'selectAll':
          await this.selectAll(sessionId);
          break;

        case 'cut':
          await this.cut(sessionId);
          break;

        case 'contextmenu':
          await this.contextMenu(sessionId, data.x || 0, data.y || 0);
          break;

        case 'selectText':
          await this.selectText(sessionId, data.startX || 0, data.startY || 0, data.endX || 0, data.endY || 0);
          break;

        case 'type':
          await this.type(sessionId, data.text);
          break;

        case 'setViewport':
          await this.setViewport(sessionId, data);
          break;

        case 'executeScript':
          const result = await this.executeScript(sessionId, data.script);
          if (this.sessions.get(sessionId)?.ws.readyState === WebSocket.OPEN) {
            this.sessions.get(sessionId)!.ws.send(JSON.stringify({
              type: 'scriptResult',
              result
            }));
          }
          break;

        case 'getPageInfo':
          const info = await this.getPageInfo(sessionId);
          if (this.sessions.get(sessionId)?.ws.readyState === WebSocket.OPEN) {
            this.sessions.get(sessionId)!.ws.send(JSON.stringify({
              type: 'pageInfo',
              info
            }));
          }
          break;

        default:
          console.warn('Unknown message type:', type);
      }
    } catch (error: any) {
      if (this.sessions.get(sessionId)?.ws.readyState === WebSocket.OPEN) {
        this.sessions.get(sessionId)!.ws.send(JSON.stringify({
          type: 'error',
          message: error.message
        }));
      }
    }
  }
}

// 导出单例
export const browserService = new BrowserService();

// WebSocket 处理函数
export function handleBrowserConnection(ws: WebSocket, req: any) {
  console.log('[Browser] New WebSocket connection request');

  // 从 token 获取用户信息
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const targetId = url.searchParams.get('targetId');

  if (!token || !targetId) {
    console.error('[Browser] Missing token or targetId');
    ws.close();
    return;
  }

  console.log('[Browser] Token and targetId extracted, connecting to target...');

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

    // 连接到浏览器目标
    browserService.connectToTarget(ws, targetId, {
      userId: (decoded as any).userId
    }).then(sessionId => {
      console.log(`[Browser] Session created: ${sessionId} for target: ${targetId}`);

      // 设置 WebSocket 消息处理
      ws.on('message', (message: Buffer) => {
        try {
          const msg = JSON.parse(message.toString());
          browserService.handleWebSocketMessage(sessionId, msg);
        } catch (error) {
          console.error('[Browser] Message handling error:', error);
        }
      });

      // WebSocket 关闭时清理会话
      ws.on('close', () => {
        browserService.closeSession(sessionId);
        console.log(`[Browser] Session closed: ${sessionId}`);
      });
    }).catch(error => {
      console.error('[Browser] Connection error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `连接失败: ${error.message}`
        }));
      }
      ws.close();
    });
  } catch (e: any) {
    console.error('[Browser] Auth error:', e);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `认证失败: ${e.message}`
      }));
    }
    ws.close();
  }

  ws.on('error', (error) => {
    console.error('[Browser] WebSocket error:', error);
  });
}
