# 浏览器内容复制到本机功能

## 更新时间
2026-03-06 17:32

## 🎉 新功能：将网页内容复制到本机剪贴板

### 功能说明

现在可以将网页中复制的文字内容专门存储，并一键复制到本机剪贴板，方便在本地电脑中使用！

### 为什么需要这个功能？

**用户痛点**：
1. 在远程浏览器中复制了文字
2. 但只能在远程浏览器中使用
3. 无法在本地电脑的笔记、文档等地方使用
4. 需要一种方式将远程内容同步到本地

**解决方案**：
- 后端复制时自动提取文字内容
- 通过 WebSocket 发送到前端
- 前端保存到剪贴板历史（标记为"来自网页"）
- 提供"复制到本机"按钮
- 一键复制到本地剪贴板

### 工作流程

```
1. 用户在网页上拖拽选择文字
   ↓
2. 松开鼠标（自动触发复制）
   ↓
3. 后端执行 Ctrl+C（复制到浏览器剪贴板）
   ↓
4. 后端提取选中的文字内容
   ↓
5. 后端通过 WebSocket 发送 'copiedText' 消息到前端
   ↓
6. 前端接收消息，添加到剪贴板历史（标记为"来自网页"）
   ↓
7. 用户点击"剪贴板"按钮查看历史
   ↓
8. 看到带有绿色标记的"来自网页"记录
   ↓
9. 点击"复制到本机"按钮
   ↓
10. 文字被复制到本地剪贴板
11. ✅ 可以在本地电脑的任何地方粘贴使用
```

### 技术实现

#### 1. 后端提取复制的文字

**文件**: `backend/src/services/browserService.ts`

**修改**: `copy()` 函数

**添加逻辑**:
```typescript
async copy(sessionId: string): Promise<void> {
  const session = this.sessions.get(sessionId);
  const { Input, Runtime } = session.client;

  // 执行 Ctrl+C
  await Input.dispatchKeyEvent({ type: 'keyDown', key: 'Control', code: 'ControlLeft' });
  await Input.dispatchKeyEvent({ type: 'keyDown', key: 'c', code: 'KeyC' });
  await Input.dispatchKeyEvent({ type: 'keyUp', key: 'c', code: 'KeyC' });
  await Input.dispatchKeyEvent({ type: 'keyUp', key: 'Control', code: 'ControlLeft' });

  // 等待复制完成
  await new Promise(resolve => setTimeout(resolve, 100));

  // 获取选中的文本
  const result = await Runtime.evaluate({
    expression: 'window.getSelection().toString()',
    returnByValue: true
  });

  const selectedText = result.result.value;
  if (selectedText && session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify({
      type: 'copiedText',
      data: {
        text: selectedText,
        timestamp: Date.now()
      }
    }));
  }
}
```

#### 2. 前端接收复制内容

**文件**: `frontend/src/pages/Browser.tsx`

**添加消息处理**:
```typescript
case 'copiedText':
  console.log('[Browser] ✓ Text copied from browser:', msg.data.text);
  addToClipboardHistory(msg.data.text, true);  // true 表示来自浏览器
  message.success('✓ 已复制到剪贴板历史');
  break;
```

#### 3. 扩展数据结构

**添加来源字段**:
```typescript
interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
  preview: string;
  source: 'browser' | 'manual';  // 来源标记
}
```

#### 4. 复制到本机剪贴板

**新增函数**:
```typescript
const copyToClipboard = async (content: string) => {
  try {
    // 优先使用现代 Clipboard API
    await navigator.clipboard.writeText(content);
    message.success('✓ 已复制到本机剪贴板');
  } catch (error) {
    // 降级方案：使用传统方法
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
```

#### 5. UI 改进

**来源标签**:
- 来自网页：绿色 "来自网页" 标签
- 手动输入：灰色 "手动输入" 标签

**不同操作按钮**:
- **来自网页**：显示"复制到本机"按钮（主按钮，蓝色）
- **所有记录**：显示"粘贴到浏览器"按钮（次要按钮）

**视觉区分**:
- 来自网页的记录：浅绿色背景 + 左侧绿色边框
- 手动输入的记录：浅灰色背景

### 使用方法

#### 方法 1：从网页复制到本机

```
1. 在网页上拖拽选择一些文字
2. 松开鼠标
3. ✅ 看到"✓ 已复制到剪贴板历史"
4. 点击"剪贴板"按钮
5. 看到带有"来自网页"标签的记录（绿色标记）
6. 点击"复制到本机"按钮
7. ✅ 看到"✓ 已复制到本机剪贴板"
8. 在本地电脑的任何地方按 Ctrl+V
9. ✅ 粘贴出来！
```

#### 方法 2：查看和使用历史

```
1. 打开剪贴板面板
2. 看到所有历史记录
3. "来自网页"的记录：
   - 点击"复制到本机" → 复制到本地剪贴板
   - 点击"粘贴到浏览器" → 粘贴回远程浏览器
4. "手动输入"的记录：
   - 只能"粘贴到浏览器"
5. 选择需要的操作
```

### 界面展示

#### 剪贴板面板

```
┌─────────────────────────────────────────────┐
│ 📋 剪贴板历史  [2 条记录]          [清空]  │
├─────────────────────────────────────────────┤
│                                              │
│ 2026-03-06 17:30:15      来自网页 ✓       │
│ ┌────────────────────────────────────────┐ │
│ │ 这是从网页上复制的文字内容，会显示...  │ │
│ │                        [复制到本机][粘贴│ │
│ │                         到浏览器][删除]│ │
│ └────────────────────────────────────────┘ │
│                                              │
│ 2026-03-06 17:28:30      手动输入          │
│ ┌────────────────────────────────────────┐ │
│ │ 这是手动输入粘贴的内容...              │ │
│ │                            [粘贴到浏览器]│ │
│ │                                 [删除]│ │
│ └────────────────────────────────────────┘ │
│                                              │
└─────────────────────────────────────────────┘
```

#### 视觉区分

**来自网页**：
- 浅绿色背景（#f6ffed）
- 左侧绿色边框（3px solid #52c41a）
- 绿色"来自网页"标签

**手动输入**：
- 浅灰色背景（#fafafa）
- 普通边框
- 灰色"手动输入"标签

### 功能特点

#### 1. 自动提取

- 后端执行 Ctrl+C 后自动提取文字
- 通过 WebSocket 实时发送到前端
- 无需手动操作

#### 2. 来源标记

- 明确标记内容来源
- 视觉上容易区分
- 提供不同的操作选项

#### 3. 一键复制到本机

- 单击即可复制到本地剪贴板
- 兼容方案（支持旧浏览器）
- 清晰的成功提示

#### 4. 双向操作

**从网页到本机**：
- 网页复制 → 剪贴板历史 → 复制到本机 → 本地使用

**从本机到网页**：
- 网页复制 → 剪贴板历史 → 粘贴到浏览器 → 在网页中使用

### 使用场景

#### 场景 1：复制网页内容到笔记

```
1. 在远程浏览器中打开一篇文章
2. 选择一段精彩的文字
3. 松开鼠标（自动复制）
4. 打开剪贴板面板
5. 点击"复制到本机"
6. 在本地笔记软件中粘贴
7. ✅ 内容成功保存到笔记
```

#### 场景 2：收集多段文字

```
1. 在网页上选择第一段文字 → 自动复制
2. 在网页上选择第二段文字 → 自动复制
3. 在网页上选择第三段文字 → 自动复制
4. 打开剪贴板面板
5. 看到所有3条"来自网页"的记录
6. 逐个点击"复制到本机"
7. 在本地文档中整理粘贴
```

#### 场景 3：远程内容本地使用

```
1. 在远程浏览器中找到需要的信息（如用户名、密码、地址等）
2. 选择并复制
3. 通过剪贴板历史复制到本机
4. 在本地应用中使用
5. ✅ 无需手动输入
```

### 对比说明

| 操作 | 之前 | 现在 |
|------|------|------|
| 复制网页文字 | 只能复制到浏览器剪贴板 | **自动提取并保存到历史** |
| 查看复制内容 | 看不到 | **在剪贴板历史中查看** |
| 复制到本机 | 不支持 | **一键复制到本机** |
| 来源识别 | 无 | **明确标记来源** |
| 历史记录 | 只有手动输入 | **网页复制 + 手动输入** |

### 技术细节

#### 后端实现

**Chrome DevTools Protocol**:
- `Input.dispatchKeyEvent` - 模拟按键
- `Runtime.evaluate` - 执行 JavaScript 获取选中文本

**JavaScript 代码**:
```javascript
window.getSelection().toString()
```
- 获取当前页面的选中内容
- 返回纯文本字符串

#### 前端实现

**Clipboard API**:
```javascript
await navigator.clipboard.writeText(content)
```

**降级方案**:
```javascript
const textArea = document.createElement('textarea');
textArea.value = content;
textArea.select();
document.execCommand('copy');
```

#### 数据流

```
用户操作（拖拽选择）
    ↓
前端发送 selectText 消息
    ↓
后端执行拖拽选择
    ↓
前端发送 copy 消息
    ↓
后端执行 Ctrl+C
    ↓
后端获取选中文字（Runtime.evaluate）
    ↓
后端发送 copiedText 消息
    ↓
前端添加到剪贴板历史（标记为 browser）
    ↓
用户点击"复制到本机"
    ↓
前端复制到本地剪贴板（navigator.clipboard.writeText）
    ↓
完成！
```

### 已知限制

1. **纯文本复制**
   - 只能复制纯文本
   - 不支持富文本格式（HTML、图片等）
   - 后续可以改进

2. **HTTPS 要求**
   - Clipboard API 需要 HTTPS 或 localhost
   - 已实现降级方案
   - 但最好使用 HTTPS

3. **字符编码**
   - 使用 UTF-8 编码
   - 支持中文等非ASCII字符
   - 大部分情况没问题

4. **选择限制**
   - 只能复制用拖拽选择的文字
   - 不能复制用 Ctrl+A 全选的文字
   - 后续可以改进

### 后续改进建议

1. ✨ **富文本支持**
   - 支持 HTML 格式
   - 支持图片复制
   - 保留格式

2. ✨ **批量操作**
   - 全选记录
   - 批量复制到本机
   - 批量删除

3. ✨ **搜索功能**
   - 在历史中搜索
   - 快速找到需要的内容

4. ✨ **导出功能**
   - 导出为 TXT 文件
   - 导出为 JSON
   - 备份重要内容

5. ✨ **快捷键**
   - Ctrl+Shift+C - 复制到本机
   - 快速访问

6. ✨ **持久化存储**
   - 使用 localStorage
   - 刷新页面后不丢失
   - 跨会话使用

---

## 总结

### 新增功能

1. ✅ **自动提取** - 后端自动提取复制的文字
2. ✅ **WebSocket 同步** - 实时发送到前端
3. ✅ **来源标记** - 区分网页复制和手动输入
4. ✅ **复制到本机** - 一键复制到本地剪贴板
5. ✅ **视觉区分** - 绿色标记来自网页的记录
6. ✅ **双向操作** - 网页↔本机双向同步

### 解决的问题

- ✅ 可以看到网页复制的内容
- ✅ 可以将网页内容复制到本机
- ✅ 方便在本地使用远程内容
- ✅ 完整的历史记录管理

### 使用体验

- **简单** - 拖拽选择后自动保存
- **直观** - 绿色标记明确识别
- **便捷** - 一键复制到本机
- **高效** - 无需手动重新输入

---

**更新完成时间**: 2026-03-06 17:32
**状态**: ✅ 完成
**后端服务**: 已重新编译并重启
**前端服务**: 已重启
**影响**: 网页复制的内容自动保存并可复制到本机
