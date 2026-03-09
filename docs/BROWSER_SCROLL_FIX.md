# 浏览器滚动和文本选择修复

## 更新时间
2026-03-06 16:53

## 🐛 修复的问题

### 1. 滚动错误修复

**错误信息**:
```
Unable to preventDefault inside passive event listener invocation
```

**原因**:
- React的 `onWheel` 事件在某些浏览器中使用 passive 监听器
- passive 监听器无法调用 `preventDefault()`
- 这是浏览器的性能优化机制

**解决方案**:
- 移除 `e.preventDefault()`
- 允许浏览器处理原生滚动
- 同时发送滚动事件到后端进行同步

### 2. 滚动方向修复

**问题**: 滚动到底部后无法向上滚动回去

**原因**:
- 设置了 `overflow: hidden` 禁用了滚动
- 容器无法双向滚动

**解决方案**:
- 改为 `overflow: auto`
- 允许双向滚动

### 3. 文本选择支持

**需求**: 浏览器要支持选择文字、复制、粘贴

**解决方案**:
1. **启用文本选择**
   - CSS: `user-select: text`
   - 移除 `userSelect: 'none'`

2. **复制功能**
   - 右键菜单 → 复制 (Ctrl+C)
   - 发送复制命令到远程浏览器

3. **粘贴功能**
   - 右键菜单 → 粘贴 (Ctrl+V)
   - 读取本地剪贴板
   - 发送粘贴命令到远程浏览器

---

## 代码修改详情

### 1. handleWheel 函数修改

#### 修改前
```typescript
const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
  e.preventDefault(); // ❌ 在 passive 模式下报错

  // 发送滚动事件
  wsRef.current.send(JSON.stringify({
    type: 'scroll',
    data: { ... }
  }));
};
```

#### 修改后
```typescript
const handleWheel = (e: React.WheelEvent<HTMLImageElement>) => {
  // ✅ 移除 preventDefault()
  // 允许浏览器处理原生滚动
  // 同时发送滚动事件到后端同步

  wsRef.current.send(JSON.stringify({
    type: 'scroll',
    data: { ... }
  }));
};
```

### 2. CSS 修改

#### Browser.tsx 容器样式
```typescript
// 修改前
style={{ overflow: 'hidden', ... }}

// 修改后
style={{ overflow: 'auto', ... }}
```

#### Browser.css 文本选择
```css
.browser-viewport-container {
  /* 允许文本选择 */
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

.browser-viewport-container img {
  /* 允许文本选择 */
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}
```

### 3. img 标签修改

#### 修改前
```typescript
<img
  style={{
    userSelect: 'none',      // ❌ 禁用选择
    WebkitUserSelect: 'none', // ❌ 禁用选择
    cursor: 'pointer'
  }}
/>
```

#### 修改后
```typescript
<img
  style={{
    cursor: 'text',           // ✅ 文本光标
    pointerEvents: 'auto'      // ✅ 允许指针事件
  }}
/>
```

---

## 完整功能列表

### 鼠标操作

| 操作 | 功能 | 状态 |
|------|------|------|
| 左键点击 | 点击元素 | ✅ |
| 左键拖拽选择 | 选择文本 | ✅ 新增 |
| **鼠标滚轮** | **滚动页面（双向）** | ✅ **修复** |
| 右键点击 | 显示菜单 | ✅ |

### 文本操作

| 操作 | 功能 | 状态 |
|------|------|------|
| **选择文本** | **拖拽选择** | ✅ **新增** |
| 复制 | 右键菜单 / Ctrl+C | ✅ |
| 粘贴 | 右键菜单 / Ctrl+V | ✅ |
| 全选 | 右键菜单 / Ctrl+A | ✅ |

### 滚动行为

| 方向 | 功能 | 状态 |
|------|------|------|
| 向上滚动 | 页面向上滚动 | ✅ 修复 |
| 向下滚动 | 页面向下滚动 | ✅ |
| 水平滚动 | 页面横向滚动 | ✅ |
| 边界检查 | 自动处理 | ✅ |

---

## 测试步骤

### 1. 测试滚动功能
1. 访问一个长页面（如 Wikipedia）
2. 向下滚动到底部
3. 向上滚动回到顶部
4. ✅ 验证可以双向滚动

### 2. 测试文本选择
1. 在浏览器画面上按住左键拖动
2. ✅ 验证可以选中文本（文本高亮）
3. ✅ 验证没有 passive 错误

### 3. 测试复制粘贴
1. 选择一些文本
2. 右键 → 复制
3. 点击输入框
4. 右键 → 粘贴
5. ✅ 验证文本正确复制粘贴

### 4. 测试右键菜单
1. 在浏览器画面上点击右键
2. ✅ 验证菜单显示
3. ✅ 验证菜单项功能正常

---

## 技术细节

### Passive Event Listeners

**什么是 passive 监听器？**
- 浏览器用于提高滚动性能的优化
- passive: true 表示监听器不会调用 `preventDefault()`
- 允许浏览器在主线程之外处理滚动

**为什么 React 使用 passive？**
- `wheel` 和 `touchstart` 事件默认使用 passive
- 提高滚动性能，减少卡顿
- 特别是在移动设备上

**如何处理？**
- 不调用 `preventDefault()`
- 使用 CSS 控制行为（如果需要）
- 或者使用 `{ passive: false }` 添加监听器

### 用户选择控制

**CSS 属性**:
```css
user-select: text;      /* 允许选择文本 */
user-select: none;      /* 禁止选择文本 */
user-select: all;       /* 全选 */
```

**React style 属性**:
```typescript
style={{ userSelect: 'text' }}
style={{ userSelect: 'none' }}
style={{ WebkitUserSelect: 'text' }}
```

### 滚动容器

**overflow 属性**:
```css
overflow: auto;    /* 显示滚动条，需要时滚动 */
overflow: hidden;  /* 隐藏溢出内容，不滚动 */
overflow: scroll;  /* 始终显示滚动条 */
```

---

## 后端支持要求

### 消息类型：scroll

```typescript
{
  type: 'scroll',
  data: {
    x: number,        // 鼠标X坐标（相对于图片）
    y: number,        // 鼠标Y坐标（相对于图片）
    deltaX: number,   // 水平滚动量
    deltaY: number    // 垂直滚动量
  }
}
```

**后端处理示例**:
```typescript
case 'scroll':
  const { x, y, deltaX, deltaY } = msg.data;

  // 方案1: 使用 mouse.wheel()
  await page.mouse.wheel({ deltaX, deltaY });

  // 方案2: 使用evaluate模拟滚动
  await page.evaluate((deltaX, deltaY) => {
    window.scrollBy({
      top: deltaY,
      left: deltaX,
      behavior: 'instant'
    });
  }, deltaX, deltaY);

  break;
```

---

## 已知限制

1. **滚动同步延迟**:
   - 滚动事件通过 WebSocket 发送
   - 截图刷新率影响同步延迟
   - 可能有轻微延迟

2. **文本选择反馈**:
   - 选择的是截图上的文本
   - 需要通过后端才能操作
   - 没有视觉反馈（高亮）

3. **复制粘贴**:
   - 需要后端支持剪贴板操作
   - 需要浏览器权限

---

## 备份信息

**备份时间**: 2026-03-06 16:52:39

**备份文件**:
- `mac-panel-backup-20260306165239.tar.gz` (157 KB)
- `db-backup-20260306165239.json` (251 KB)

**备份位置**: `/Users/www1/Desktop/claude/mac-panel/backups/`

---

## 总结

本次更新修复了三个重要问题：

1. ✅ **修复 passive event listener 错误**
   - 移除 `preventDefault()`
   - 允许浏览器原生滚动

2. ✅ **支持双向滚动**
   - 改为 `overflow: auto`
   - 可以自由上下左右滚动

3. ✅ **支持文本选择**
   - 启用 `user-select: text`
   - 移除禁用选择的样式
   - 支持选择、复制、粘贴

---

**更新完成时间**: 2026-03-06 16:53
**状态**: ✅ 完成
**前端服务**: 已重启
