# 浏览器输入后端支持修复

## 更新时间
2026-03-06 17:10

## 🐛 修复的问题

### 1. 输入的文字无法删除
**原因**: 前端发送 `keypress` 消息，但后端未处理该消息类型
**解决**: 在后端添加 `keypress` 消息处理

### 2. 粘贴提示"无法访问剪贴板"
**原因**: `http://192.168.0.7` 是非 HTTPS 环境，浏览器阻止访问剪贴板 API
**解决**: 添加手动输入对话框作为备选方案

---

## 后端新增功能

### 新增消息类型处理

在 `backend/src/services/browserService.ts` 的 `handleWebSocketMessage` 函数中添加了以下消息类型的处理：

#### 1. keypress - 按键事件

```typescript
case 'keypress':
  await this.keypress(sessionId, data.key);
  break;
```

**支持的按键**:
- Enter - 回车键
- Tab - 制表键
- Escape - 退出键
- Backspace - 退格键（删除）
- Delete - 删除键
- ArrowUp - 上方向键
- ArrowDown - 下方向键
- ArrowLeft - 左方向键
- ArrowRight - 右方向键

**实现代码**:
```typescript
async keypress(sessionId: string, key: string): Promise<void> {
  const session = this.sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const { Input } = session.client;

  // 按键映射
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

  // 发送按键事件
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
```

#### 2. copy - 复制

```typescript
case 'copy':
  await this.copy(sessionId);
  break;
```

**实现**: 发送 Ctrl+C 按键事件

#### 3. paste - 粘贴

```typescript
case 'paste':
  await this.paste(sessionId, data.text || '');
  break;
```

**实现**:
1. 发送 Ctrl+V 按键事件
2. 如果提供了文本，直接输入（解决剪贴板 API 不可用问题）

```typescript
async paste(sessionId: string, text: string): Promise<void> {
  const session = this.sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const { Input } = session.client;

  // 发送 Ctrl+V
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

  // 如果提供了文本，直接输入
  if (text && text.length > 0) {
    await this.type(sessionId, text);
  }
}
```

#### 4. selectAll - 全选

```typescript
case 'selectAll':
  await this.selectAll(sessionId);
  break;
```

**实现**: 发送 Ctrl+A 按键事件

#### 5. cut - 剪切

```typescript
case 'cut':
  await this.cut(sessionId);
  break;
```

**实现**: 发送 Ctrl+X 按键事件

#### 6. contextmenu - 右键菜单

```typescript
case 'contextmenu':
  await this.contextMenu(sessionId, data.x || 0, data.y || 0);
  break;
```

**实现**: 在指定坐标发送右键点击事件

```typescript
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
```

#### 7. scroll - 滚动（修复）

**之前的问题**: 后端期望接收滚动偏移量 `x` 和 `y`
**现在的修复**: 正确处理鼠标坐标和滚轮增量

```typescript
case 'scroll':
  await this.scroll(sessionId, data.x || 0, data.y || 0, data.deltaX || 0, data.deltaY || 0);
  break;
```

**实现**:
```typescript
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
```

---

## 前端修复

### 粘贴功能改进

**问题**: 在非 HTTPS 环境下，`navigator.clipboard.readText()` 不可用

**解决方案**:
1. 先尝试使用剪贴板 API
2. 如果失败，弹出输入框让用户手动输入要粘贴的文本

**实现代码**:
```typescript
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
        <Input
          id="paste-text-input"
          placeholder="在此输入文本..."
          multiline
          autoFocus
          onPressEnter={(e) => {
            const input = e.currentTarget as HTMLInputElement;
            if (wsRef.current && input.value) {
              wsRef.current.send(JSON.stringify({
                type: 'paste',
                data: { text: input.value }
              }));
              message.success('已粘贴文本');
            }
          }}
        />
      </div>
    ),
    onOk: () => {
      const input = document.getElementById('paste-text-input') as HTMLInputElement;
      if (wsRef.current && input?.value) {
        wsRef.current.send(JSON.stringify({
          type: 'paste',
          data: { text: input.value }
        }));
        message.success('已粘贴文本');
      }
    },
    okText: '粘贴',
    cancelText: '取消'
  });
};
```

---

## 完整功能列表

### 键盘输入功能

| 按键 | 功能 | 后端支持 | 前端发送 |
|------|------|---------|---------|
| **普通字符** | 输入文字 | ✅ `type` | ✅ `type` |
| **Enter** | 换行/确认 | ✅ `keypress` | ✅ `keypress` |
| **Backspace** | 删除前一个字符 | ✅ `keypress` | ✅ `keypress` |
| **Delete** | 删除后一个字符 | ✅ `keypress` | ✅ `keypress` |
| **Tab** | 切换焦点 | ✅ `keypress` | ✅ `keypress` |
| **Escape** | 取消 | ✅ `keypress` | ✅ `keypress` |
| **方向键** | 移动光标 | ✅ `keypress` | ✅ `keypress` |
| **Ctrl+C** | 复制 | ✅ `copy` | ✅ `copy` |
| **Ctrl+V** | 粘贴 | ✅ `paste` | ✅ `paste` |
| **Ctrl+A** | 全选 | ✅ `selectAll` | ✅ `selectAll` |
| **Ctrl+X** | 剪切 | ✅ `cut` | ✅ `cut` |

### 鼠标操作

| 操作 | 功能 | 后端支持 |
|------|------|---------|
| 左键点击 | 点击元素 | ✅ `click` |
| 右键点击 | 显示菜单 | ✅ `contextmenu` |
| 鼠标滚轮 | 滚动页面 | ✅ `scroll` |

---

## 测试步骤

### 1. 测试文字删除

1. 打开浏览器页面
2. 连接到一个标签
3. 导航到 Google 或其他有输入框的页面
4. 点击搜索框，输入一些文字
5. 按 **Backspace** 键
6. ✅ 验证字符被删除
7. 按 **Delete** 键
8. ✅ 验证字符被删除

### 2. 测试粘贴功能（非 HTTPS 环境）

1. 在浏览器画面上点击右键
2. 点击"粘贴 (Ctrl+V)"
3. ✅ 应该弹出输入框
4. 输入要粘贴的文本
5. 点击"粘贴"按钮
6. ✅ 验证文本被粘贴到浏览器

### 3. 测试方向键

1. 点击一个文本框
2. 输入一些文字
3. 按 **←** **→** 方向键
4. ✅ 验证光标移动
5. 按 **↑** **↓** 方向键
6. ✅ 验证行移动

### 4. 测试复制粘贴

1. 在页面中选择一些文本（拖拽选择）
2. 右键 → 复制
3. 点击输入框
4. 右键 → 粘贴
5. ✅ 验证文本被粘贴

### 5. 测试快捷键

1. **Ctrl+A** - 全选
2. **Ctrl+C** - 复制
3. **Ctrl+V** - 粘贴
4. **Ctrl+X** - 剪切
5. ✅ 验证所有快捷键正常工作

---

## WebSocket 消息协议

### 前端 → 后端

```typescript
// 按键事件
{
  type: 'keypress',
  data: {
    key: string  // Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight
  }
}

// 复制
{
  type: 'copy',
  data: {}
}

// 粘贴
{
  type: 'paste',
  data: {
    text: string  // 要粘贴的文本（可选，用于剪贴板 API 不可用时）
  }
}

// 全选
{
  type: 'selectAll',
  data: {}
}

// 剪切
{
  type: 'cut',
  data: {}
}

// 右键菜单
{
  type: 'contextmenu',
  data: {
    x: number,  // X 坐标
    y: number   // Y 坐标
  }
}

// 滚动（修复）
{
  type: 'scroll',
  data: {
    x: number,      // 鼠标 X 坐标
    y: number,      // 鼠标 Y 坐标
    deltaX: number, // 水平滚动量
    deltaY: number  // 垂直滚动量
  }
}
```

---

## 已知限制

### 剪贴板 API 限制

**问题**: 浏览器的剪贴板 API 只在以下环境可用：
- HTTPS 网站
- localhost（开发环境）

**当前环境**: `http://192.168.0.7:5175`

**解决方案**:
- ✅ 已实现：弹出输入框让用户手动输入
- 未来改进：使用 HTTPS 部署

### 输入延迟

**问题**: 所有输入通过 WebSocket 发送，存在网络延迟

**影响**:
- 快速输入可能跟不上
- 快捷键响应有延迟

**缓解方案**:
- 本地输入预览（未来）
- 提高截图刷新率

---

## 后续改进建议

1. ✨ 使用 HTTPS 部署，启用剪贴板 API
2. ✨ 添加本地输入预览，减少延迟感
3. ✨ 支持更多键盘组合（Ctrl+Z 撤销、Ctrl+Y 重做）
4. ✨ 添加输入法支持（中文、日文等）
5. ✨ 改进粘贴功能，支持富文本粘贴

---

## 总结

本次更新修复了浏览器输入功能的关键问题：

### 修复内容

1. ✅ **后端支持 `keypress` 消息**
   - Enter, Backspace, Delete, Tab, Escape
   - 方向键（↑↓←→）

2. ✅ **后端支持 `copy`、`paste`、`selectAll`、`cut` 消息**
   - 完整的剪贴板操作支持

3. ✅ **后端支持 `contextmenu` 消息**
   - 正确的右键点击事件

4. ✅ **修复 `scroll` 消息处理**
   - 使用正确的滚轮事件

5. ✅ **前端粘贴功能改进**
   - 非 HTTPS 环境下使用手动输入

### 结果

现在可以在浏览器中：
- ✅ 正常输入文字
- ✅ 使用 Backspace/Delete 删除文字
- ✅ 使用方向键移动光标
- ✅ 使用 Enter 键
- ✅ 使用快捷键（Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+X）
- ✅ 通过输入框粘贴文本（非 HTTPS 环境）

---

**更新完成时间**: 2026-03-06 17:10
**状态**: ✅ 完成
**后端服务**: 已重新编译并重启
**前端服务**: 已重启
