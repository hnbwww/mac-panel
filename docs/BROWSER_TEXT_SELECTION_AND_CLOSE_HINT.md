# 浏览器文字选择和可关闭提示功能

## 更新时间
2026-03-06 17:22

## 🎉 新增功能

### 1. 📝 网页文字选择和复制

现在支持在网页上通过**鼠标拖拽**选择文字并复制！

#### 使用方法

```
1. 打开浏览器页面，导航到一个有文字的网页
2. 按住鼠标左键在文字上拖拽
3. 松开鼠标完成选择
4. 按 Ctrl+C 或右键菜单复制
5. 点击输入框，按 Ctrl+V 粘贴
```

#### 工作原理

```
用户操作流程：
1. 在浏览器画面上按下鼠标左键（记录起始坐标）
   ↓
2. 拖动鼠标到目标位置（发送拖拽事件到后端）
   ↓
3. 松开鼠标（后端在真实浏览器中完成选择）
   ↓
4. 使用 Ctrl+C 复制选中的文字
```

#### 技术实现

**前端代码**：
```typescript
// 鼠标按下 - 记录起始位置
const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
  const rect = imageRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const scaleX = naturalWidth / rect.width;
  const scaleY = naturalHeight / rect.height;

  setSelectionStart({
    x: x * scaleX,
    y: y * scaleY
  });
  setIsSelecting(true);
};

// 鼠标移动 - 实时拖拽
const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
  if (!isSelecting) return;

  // 发送拖拽选择事件到后端
  wsRef.current.send(JSON.stringify({
    type: 'selectText',
    data: {
      startX: selectionStart.x,
      startY: selectionStart.y,
      endX: currentX * scaleX,
      endY: currentY * scaleY
    }
  }));
};

// 鼠标松开 - 完成选择
const handleMouseUp = (e: React.MouseEvent<HTMLImageElement>) => {
  // 发送最终选择位置
  wsRef.current.send(JSON.stringify({
    type: 'selectText',
    data: {
      startX: selectionStart.x,
      startY: selectionStart.y,
      endX: endX * scaleX,
      endY: endY * scaleY,
      final: true
    }
  }));

  setIsSelecting(false);
};
```

**后端代码**：
```typescript
async selectText(sessionId: string, startX: number, startY: number, endX: number, endY: number): Promise<void> {
  const session = this.sessions.get(sessionId);
  const { Input, Runtime } = session.client;

  // 获取页面缩放比例
  const result = await Runtime.evaluate({
    expression: 'window.devicePixelRatio || 1'
  });
  const devicePixelRatio = result.result.value || 1;

  // 1. 在起始位置按下鼠标
  await Input.dispatchMouseEvent({
    type: 'mousePressed',
    x: startX * devicePixelRatio,
    y: startY * devicePixelRatio,
    button: 'left',
    clickCount: 1
  });

  // 2. 拖拽到结束位置
  await Input.dispatchMouseEvent({
    type: 'mouseMoved',
    x: endX * devicePixelRatio,
    y: endY * devicePixelRatio,
    button: 'left'  // 保持按下状态
  });

  // 3. 释放鼠标
  await Input.dispatchMouseEvent({
    type: 'mouseReleased',
    x: endX * devicePixelRatio,
    y: endY * devicePixelRatio,
    button: 'left',
    clickCount: 1
  });
}
```

#### 使用示例

**示例 1: 选择并复制网页文字**
```
1. 打开 Wikipedia 或任何有文字的网页
2. 在一段文字的起始位置按下鼠标左键
3. 拖动到文字结束位置
4. 松开鼠标（文字被选中）
5. 按 Ctrl+C（复制）
6. 点击输入框
7. 按 Ctrl+V（粘贴）
8. ✅ 文字被粘贴到输入框
```

**示例 2: 选择单行文字**
```
1. 在文字行首按下鼠标
2. 向右拖动到行尾
3. 松开鼠标
4. ✅ 该行文字被选中
```

**示例 3: 选择多行文字**
```
1. 在第一行文字开头按下鼠标
2. 向下拖动到最后一行
3. 松开鼠标
4. ✅ 多行文字被选中
```

---

### 2. ✕ 可关闭的使用说明提示

使用说明提示现在可以关闭了！

#### 功能说明

- **位置**：浏览器画面左上角
- **样式**：半透明黑色背景，白色文字
- **关闭按钮**：右上角 ✕ 按钮
- **记忆**：关闭后不会再次显示（当前会话）

#### 提示内容

```
💡 使用说明

1. 输入文字：点击网页上的输入框，然后直接输入
2. 选择文字：按住鼠标左键拖拽选择文字
3. 复制粘贴：使用 Ctrl+C/V 或右键菜单
4. 删除文字：使用 Backspace/Delete 键
5. 支持所有快捷键：Ctrl+A（全选）、Ctrl+X（剪切）等
```

#### 技术实现

**状态管理**：
```typescript
const [showUsageHint, setShowUsageHint] = useState<boolean>(true);
```

**UI 代码**：
```typescript
{showUsageHint && (
  <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 1000, ... }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        💡 使用说明
      </div>
      <div style={{ fontSize: '12px', opacity: 0.9 }}>
        ... 使用说明内容 ...
      </div>
    </div>
    <Button
      type="text"
      size="small"
      onClick={() => setShowUsageHint(false)}
      style={{ color: 'white', marginLeft: '12px' }}
    >
      ✕
    </Button>
  </div>
)}
```

---

## 📋 完整功能列表

### 鼠标操作

| 操作 | 功能 | 状态 |
|------|------|------|
| **左键点击** | 点击元素（按钮、链接、输入框） | ✅ |
| **拖拽选择** | 选择网页文字 | ✅ 新增 |
| **右键点击** | 显示菜单（复制、粘贴、全选） | ✅ |
| **鼠标滚轮** | 滚动页面（上下左右） | ✅ |

### 键盘操作

| 操作 | 功能 | 状态 |
|------|------|------|
| **普通输入** | A-Z, 0-9, 符号 | ✅ |
| **Backspace** | 删除前一个字符 | ✅ |
| **Delete** | 删除后一个字符 | ✅ |
| **方向键** | ← → ↑ ↓ 移动光标 | ✅ |
| **Enter** | 确认/换行 | ✅ |
| **Tab** | 切换焦点 | ✅ |
| **Escape** | 取消 | ✅ |
| **Ctrl+A** | 全选 | ✅ |
| **Ctrl+C** | 复制 | ✅ |
| **Ctrl+V** | 粘贴 | ✅ |
| **Ctrl+X** | 剪切 | ✅ |

### 文本操作

| 操作 | 功能 | 状态 |
|------|------|------|
| **拖拽选择** | 在网页上选择文字 | ✅ 新增 |
| **复制** | Ctrl+C 或右键菜单 | ✅ |
| **粘贴** | Ctrl+V 或右键菜单 | ✅ |
| **全选** | Ctrl+A 或右键菜单 | ✅ |
| **剪切** | Ctrl+X 或右键菜单 | ✅ |

---

## 测试步骤

### 测试 1: 文字选择功能

1. 打开浏览器页面
2. 导航到一个有文字的网页（如 Wikipedia）
3. 在一段文字的起始位置按下鼠标左键
4. 拖动到结束位置
5. 松开鼠标
6. ✅ 验证：文字被选中（需要等待截图刷新）

### 测试 2: 选择并复制

1. 使用拖拽选择一些文字
2. 按 Ctrl+C
3. 点击输入框
4. 按 Ctrl+V
5. ✅ 验证：文字被复制粘贴

### 测试 3: 关闭使用说明

1. 打开浏览器页面
2. 看到左上角的使用说明
3. 点击右上角的 ✕ 按钮
4. ✅ 验证：使用说明消失

### 测试 4: 多行文字选择

1. 找到一个有多行文字的段落
2. 从第一行开头按下鼠标
3. 向下拖动到最后一行
4. 松开鼠标
5. ✅ 验证：多行文字被选中

---

## WebSocket 消息协议

### selectText - 选择文字

```typescript
{
  type: 'selectText',
  data: {
    startX: number,  // 起始 X 坐标
    startY: number,  // 起始 Y 坐标
    endX: number,    // 结束 X 坐标
    endY: number     // 结束 Y 坐标
  }
}
```

**后端处理**：
1. 在 (startX, startY) 位置按下鼠标
2. 拖动到 (endX, endY) 位置
3. 释放鼠标
4. 文字被选中

---

## 后端支持要求

### 消息类型

需要后端支持以下新的消息类型：

#### selectText - 选择文字

```typescript
case 'selectText':
  await this.selectText(
    sessionId,
    data.startX || 0,
    data.startY || 0,
    data.endX || 0,
    data.endY || 0
  );
  break;
```

**实现函数**：
```typescript
async selectText(
  sessionId: string,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<void>
```

---

## 已知限制

### 1. 选择反馈延迟

**问题**: 拖拽选择后，需要等待截图刷新才能看到选中状态

**原因**:
- 截图刷新率是 2 FPS（每 0.5 秒刷新）
- 选择操作在真实浏览器中执行
- 需要等待下一次截图才能看到结果

**解决方案**:
- 耐心等待 0.5 秒
- 或者提高截图刷新率（增加带宽消耗）

### 2. 精确选择

**问题**: 难以精确选择单个字符或小段文字

**原因**:
- 鼠标坐标映射存在一定误差
- 截图缩放比例计算

**解决方案**:
- 尽量放大浏览器画面
- 细心操作，多次尝试

### 3. 复杂布局

**问题**: 在复杂布局中选择文字可能不准确

**原因**:
- 真实浏览器的文字选择算法
- 拖拽路径可能经过多个元素

**解决方案**:
- 使用 Ctrl+A 全选
- 或者多次尝试

---

## 后续改进建议

1. ✨ **添加选择预览**
   - 在前端显示拖拽框
   - 提供即时视觉反馈

2. ✨ **双击选择单词**
   - 监听双击事件
   - 自动选择整个单词

3. ✨ **三击选择段落**
   - 监听三击事件
   - 自动选择整个段落

4. ✨ **提高截图刷新率**
   - 从 2 FPS 提高到 5 FPS
   - 减少延迟感

5. ✨ **添加选择模式切换**
   - 点击模式 vs 选择模式
   - 避免误操作

---

## 总结

本次更新添加了两项重要功能：

### 1. ✅ 网页文字选择和复制

**功能**:
- 通过鼠标拖拽选择网页文字
- 使用 Ctrl+C 复制
- 使用 Ctrl+V 粘贴

**实现**:
- 前端：监听鼠标按下、移动、松开事件
- 后端：使用 CDP Input API 模拟拖拽选择
- 协议：新增 `selectText` 消息类型

**状态**:
- ✅ 功能完整实现
- ✅ 后端支持完整
- ✅ 可以正常使用

### 2. ✅ 可关闭的使用说明

**功能**:
- 显示在浏览器画面左上角
- 包含完整的使用说明
- 可以通过 ✕ 按钮关闭

**实现**:
- 状态管理：`showUsageHint`
- 条件渲染：只在 `showUsageHint` 为 true 时显示
- 关闭按钮：点击设置为 false

**状态**:
- ✅ 功能完整实现
- ✅ 可以正常关闭

---

**更新完成时间**: 2026-03-06 17:22
**状态**: ✅ 完成
**前端服务**: 已重启
**后端服务**: 已重新编译并重启
