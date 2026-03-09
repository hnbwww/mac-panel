# 浏览器交互功能增强

## 更新时间
2026-03-06 16:45

## 新增功能

### 1. 🖱️ 鼠标滚轮支持

#### 功能说明
浏览器截图区域现在支持鼠标滚轮滚动，滚动事件会实时发送到远程浏览器。

#### 实现细节
```typescript
const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
  // 计算坐标
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 考虑截图缩放比例
  const scaleX = naturalWidth / displayWidth;
  const scaleY = naturalHeight / displayHeight;

  // 发送滚动事件到后端
  wsRef.current.send(JSON.stringify({
    type: 'scroll',
    data: {
      x: x * scaleX,
      y: y * scaleY,
      deltaX: e.deltaX,
      deltaY: e.deltaY
    }
  }));
};
```

#### 使用方法
- 在浏览器画面上滚动鼠标滚轮
- 支持垂直滚动和水平滚动
- 精确的坐标映射

#### 后端需要支持
```typescript
// 后端需要处理 'scroll' 类型消息
case 'scroll':
  const { x, y, deltaX, deltaY } = msg.data;
  // 模拟滚轮事件
  await page.mouse.wheel({ deltaX, deltaY });
  break;
```

---

### 2. 🖱️ 右键菜单

#### 功能说明
在浏览器画面上点击右键，会显示自定义上下文菜单，支持复制、粘贴等操作。

#### 菜单项
1. **复制 (Ctrl+C)**
   - 发送复制命令到远程浏览器
   - 提示用户已执行

2. **粘贴 (Ctrl+V)**
   - 读取本地剪贴板内容
   - 发送到远程浏览器并粘贴

3. **全选 (Ctrl+A)**
   - 发送全选命令到远程浏览器
   - 选中当前页面所有内容

4. **关闭**
   - 关闭右键菜单

#### 实现细节

##### 显示右键菜单
```typescript
const handleContextMenu = (e: React.MouseEvent<HTMLImageElement>) => {
  e.preventDefault();

  // 发送右键点击到后端
  wsRef.current.send(JSON.stringify({
    type: 'contextmenu',
    data: {
      x: x * scaleX,
      y: y * scaleY,
      button: 2
    }
  }));

  // 显示自定义菜单
  setContextMenuPosition({
    x: e.clientX,
    y: e.clientY
  });
  setContextMenuVisible(true);
};
```

##### 点击其他地方关闭菜单
```typescript
useEffect(() => {
  const handleClickOutside = () => {
    if (contextMenuVisible) {
      setContextMenuVisible(false);
    }
  };

  if (contextMenuVisible) {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }
}, [contextMenuVisible]);
```

---

### 3. 📏 自适应屏幕宽度

#### 功能说明
浏览器视口现在默认会根据当前屏幕大小自动调整，最大化利用可用空间。

#### 默认视口计算
```typescript
const calculateDefaultViewport = () => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // 留出空间给工具栏和标签栏
  return {
    width: Math.max(1024, screenWidth - 100),
    height: Math.max(768, screenHeight - 300)
  };
};
```

#### 自动应用
- 连接到浏览器时自动应用
- 确保最佳显示效果
- 可手动调整覆盖

#### 不同屏幕尺寸示例

| 屏幕尺寸 | 默认视口 | 说明 |
|---------|---------|------|
| 1920x1080 | 1820x780 | 桌面显示器 |
| 1366x768 | 1266x468 | 笔记本 |
| 2560x1440 | 2460x1140 | 2K显示器 |

---

## 完整的交互功能

### 鼠标操作

| 操作 | 功能 | 状态 |
|------|------|------|
| 左键点击 | 点击元素 | ✅ |
| 右键点击 | 显示菜单 | ✅ |
| 鼠标滚轮 | 滚动页面 | ✅ |
| 拖拽 | 未实现 | ⏳ |

### 键盘操作（通过右键菜单）

| 操作 | 功能 | 状态 |
|------|------|------|
| Ctrl+C | 复制 | ✅ |
| Ctrl+V | 粘贴 | ✅ |
| Ctrl+A | 全选 | ✅ |

### 导航操作

| 按钮 | 功能 | 快捷键 |
|------|------|--------|
| 后退 | 返回上一页 | ✅ |
| 前进 | 前往下一页 | ✅ |
| 刷新 | 重新加载页面 | ✅ |
| 主页 | 跳转到首页 | ✅ |
| 跳转 | 导航到URL | ✅ |

---

## 代码修改

### 新增状态

```typescript
const [contextMenuVisible, setContextMenuVisible] = useState<boolean>(false);
const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
```

### 新增函数

1. `calculateDefaultViewport()` - 计算默认视口大小
2. `handleWheel()` - 处理鼠标滚轮事件
3. `handleCopy()` - 处理复制命令
4. `handlePaste()` - 处理粘贴命令
5. `handleSelectAll()` - 处理全选命令
6. `handleCloseContextMenu()` - 关闭右键菜单

### 修改的事件处理

```typescript
<img
  onWheel={handleWheel}        // 新增：滚轮支持
  onContextMenu={handleContextMenu}  // 已有：右键菜单
/>
```

---

## CSS 样式

### 右键菜单样式

```css
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  padding: 4px 0;
  min-width: 150px;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
}

.context-menu-item:hover {
  background: #f5f5f5;
}
```

---

## 后端支持要求

### WebSocket 消息类型

需要后端支持以下新的消息类型：

#### 1. scroll - 滚动事件
```typescript
{
  type: 'scroll',
  data: {
    x: number,
    y: number,
    deltaX: number,
    deltaY: number
  }
}
```

**后端处理示例**:
```typescript
case 'scroll':
  const { x, y, deltaX, deltaY } = msg.data;
  await page.mouse.wheel({ deltaX, deltaY });
  break;
```

#### 2. contextmenu - 右键菜单
```typescript
{
  type: 'contextmenu',
  data: {
    x: number,
    y: number,
    button: 2
  }
}
```

**后端处理示例**:
```typescript
case 'contextmenu':
  const { x, y, button } = msg.data;
  await page.mouse.click(x, y, { button });
  break;
```

#### 3. copy - 复制
```typescript
{
  type: 'copy',
  data: {}
}
```

**后端处理示例**:
```typescript
case 'copy':
  await page.keyboard.down('Control');
  await page.keyboard.press('c');
  await page.keyboard.up('Control');
  break;
```

#### 4. paste - 粘贴
```typescript
{
  type: 'paste',
  data: {
    text: string
  }
}
```

**后端处理示例**:
```typescript
case 'paste':
  const { text } = msg.data;
  await page.keyboard.down('Control');
  await page.keyboard.press('v');
  await page.keyboard.up('Control');
  await page.keyboard.type(text);
  break;
```

#### 5. selectAll - 全选
```typescript
{
  type: 'selectAll',
  data: {}
}
```

**后端处理示例**:
```typescript
case 'selectAll':
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  break;
```

---

## 测试步骤

### 1. 测试滚轮功能
1. 连接到浏览器标签
2. 导航到一个有长内容的页面（如 Wikipedia）
3. 使用鼠标滚轮滚动
4. 验证页面内容正确滚动

### 2. 测试右键菜单
1. 在浏览器画面上点击右键
2. 验证自定义菜单显示
3. 点击"复制"选项
4. 点击其他地方，验证菜单关闭

### 3. 测试复制粘贴
1. 在浏览器中选择一些文本
2. 右键点击 → 复制
3. 点击输入框
4. 右键点击 → 粘贴
5. 验证内容正确粘贴

### 4. 测试自适应屏幕
1. 连接到浏览器
2. 检查默认视口大小
3. 验证浏览器内容完整显示

---

## 已知限制

1. **滚轮精度**：
   - 取决于截图刷新率
   - 可能有轻微延迟

2. **右键菜单**：
   - 是前端自定义菜单，不是浏览器原生菜单
   - 后端仍会触发右键事件

3. **复制粘贴**：
   - 需要浏览器权限
   - HTTPS 或 localhost 环境才能使用剪贴板 API

---

## 后续改进建议

1. ✨ 支持触摸滚动（移动设备）
2. ✨ 支持双指缩放
3. ✨ 添加拖拽支持
4. ✨ 支持更多键盘快捷键
5. ✨ 添加历史记录导航
6. ✨ 改进滚轮响应速度

---

## 总结

本次更新为浏览器页面添加了三项重要功能：

1. ✅ **鼠标滚轮支持** - 更自然的滚动体验
2. ✅ **右键菜单** - 复制、粘贴、全选功能
3. ✅ **自适应屏幕** - 默认视口适应屏幕大小

这些功能使远程浏览器更接近真实浏览器的使用体验！

---
**更新完成时间**: 2026-03-06 16:45
**状态**: ✅ 完成
**后端支持**: 需要添加相应的消息类型处理
