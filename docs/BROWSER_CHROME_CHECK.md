# Chrome 浏览器安装检查功能

## 更新时间
2026-03-06 18:00

## 🎯 新增功能

### 自动检查 Chrome 浏览器状态

在打开浏览器管理页面时，自动检查 Chrome 浏览器的安装和运行状态，并引导用户完成安装和启动。

### 功能说明

**触发时机**：打开浏览器页面时自动检查

**检查项目**：
1. Chrome 是否已安装
2. Chrome 版本信息
3. Chrome 是否正在运行
4. 远程调试端口 (9222) 是否已开启

### 用户界面

#### 模态弹窗

**位置**：页面中心（Modal）

**显示条件**：
- Chrome 未安装
- Chrome 已安装但未开启远程调试

**内容**：
- ✓/✗ 状态标记
- 安装状态和版本信息
- 远程调试状态
- 安装/启动引导步骤
- 一键操作按钮

## API 端点

### 1. GET /api/browser/check-chrome

**功能**：检查 Chrome 安装和运行状态

**响应示例**：

```json
{
  "installed": true,
  "chromePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "chromeVersion": "Google Chrome 120.0.6099.109",
  "running": true,
  "remoteDebugEnabled": true,
  "platform": "darwin",
  "instructions": {
    "title": "在 macOS 上安装 Google Chrome",
    "steps": [
      "1. 打开 Safari 浏览器",
      "2. 访问 https://www.google.com/chrome/",
      "3. 点击"下载 Chrome"按钮"
    ],
    "commands": [
      "brew install --cask google-chrome"
    ]
  }
}
```

### 2. POST /api/browser/install-chrome

**功能**：尝试安装 Chrome（通过 Homebrew）

**请求**：
```http
POST /api/browser/install-chrome
Authorization: Bearer {token}
```

**响应（成功）**：
```json
{
  "success": true,
  "message": "Chrome installation started via Homebrew",
  "output": "..."
}
```

**响应（失败）**：
```json
{
  "success": false,
  "error": "Homebrew not found",
  "message": "请先安装 Homebrew，然后重试",
  "instructions": {
    "title": "先安装 Homebrew",
    "steps": [
      "1. 打开终端（Terminal）",
      "2. 复制并执行以下命令安装 Homebrew：",
      "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    ]
  }
}
```

### 3. POST /api/browser/launch-chrome

**功能**：启动 Chrome 远程调试模式

**请求**：
```http
POST /api/browser/launch-chrome
Authorization: Bearer {token}
```

**响应（成功）**：
```json
{
  "success": true,
  "message": "Chrome 启动成功，远程调试已启用"
}
```

**响应（等待中）**：
```json
{
  "success": true,
  "message": "Chrome 启动命令已执行，请稍等几秒后点击"重新检查"",
  "note": "Chrome 可能正在启动中"
}
```

## 前端实现

### 状态管理

```typescript
const [chromeCheckResult, setChromeCheckResult] = useState<ChromeCheckResult | null>(null);
const [chromeCheckModalVisible, setChromeCheckModalVisible] = useState<boolean>(false);
const [checkingChrome, setCheckingChrome] = useState<boolean>(true);
```

### 自动检查

```typescript
useEffect(() => {
  checkChromeInstallation();
}, []);

const checkChromeInstallation = async () => {
  setCheckingChrome(true);
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    const response = await fetch(`${API_BASE_URL}/api/browser/check-chrome`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (response.ok) {
      const data: ChromeCheckResult = await response.json();
      setChromeCheckResult(data);

      // 如果 Chrome 未安装或未开启远程调试，显示提示
      if (!data.installed || !data.remoteDebugEnabled) {
        setChromeCheckModalVisible(true);
      }
    }
  } catch (error) {
    console.error('Failed to check Chrome installation:', error);
  } finally {
    setCheckingChrome(false);
  }
};
```

### 一键安装

```typescript
<Button
  type="primary"
  onClick={async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/browser/install-chrome`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        message.success({ content: 'Chrome 安装已启动，请稍候...', duration: 5 });
        // 30秒后自动重新检查
        setTimeout(recheckChrome, 30000);
      } else {
        Modal.error({
          title: '安装失败',
          content: <div>{data.message}</div>
        });
      }
    } catch (error) {
      message.error('安装请求失败');
    }
  }}
>
  一键安装 Chrome
</Button>
```

### 一键启动

```typescript
<Button
  type="primary"
  onClick={async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_BASE_URL}/api/browser/launch-chrome`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        message.success({ content: data.message || 'Chrome 启动成功', duration: 5 });
        // 3秒后自动重新检查
        setTimeout(recheckChrome, 3000);
      } else {
        message.error(data.message || data.error);
      }
    } catch (error) {
      message.error('启动 Chrome 失败');
    }
  }}
>
  一键启动 Chrome
</Button>
```

## 支持的平台

### macOS (darwin)

**检查路径**：
- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary`
- `/Applications/Chromium.app/Contents/MacOS/Chromium`

**安装方法**：
1. 手动下载：https://www.google.com/chrome/
2. Homebrew：`brew install --cask google-chrome`

**启动命令**：
```bash
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug >/dev/null 2>&1 &
```

### Linux

**检查路径**：
- `which google-chrome`
- `which google-chrome-stable`
- `which chromium-browser`
- `which chromium`

**安装方法**：
- Debian/Ubuntu：`wget` + `dpkg`
- Fedora/CentOS：`wget` + `yum`

**启动命令**：
```bash
nohup google-chrome --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug >/dev/null 2>&1 &
```

### Windows (win32)

**检查路径**：
- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
- `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`

**安装方法**：
- 手动下载：https://www.google.com/chrome/

**启动命令**：
```batch
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir=%TEMP%\chrome-debug
```

## 用户体验流程

### 场景 1：Chrome 已安装并运行

1. 用户打开浏览器页面
2. 自动检查 Chrome 状态
3. 检测到 Chrome 已安装且远程调试已启用
4. 不显示弹窗，直接可以使用

### 场景 2：Chrome 已安装但未运行

1. 用户打开浏览器页面
2. 自动检查 Chrome 状态
3. 检测到 Chrome 已安装但远程调试未启用
4. 显示提示弹窗
5. 用户点击"一键启动 Chrome"
6. 后端执行启动命令
7. 3秒后自动重新检查
8. 检测成功，关闭弹窗

### 场景 3：Chrome 未安装

1. 用户打开浏览器页面
2. 自动检查 Chrome 状态
3. 检测到 Chrome 未安装
4. 显示安装引导弹窗
5. 用户选择：
   - **一键安装**（macOS + Homebrew）
     - 后端执行 `brew install --cask google-chrome`
     - 30秒后自动重新检查
   - **手动安装**
     - 按照弹窗中的步骤手动操作
     - 完成后点击"重新检查"按钮

### 场景 4：Homebrew 未安装（macOS）

1. 用户点击"一键安装 Chrome"
2. 后端检测到 Homebrew 未安装
3. 显示 Homebrew 安装引导
4. 用户按照引导安装 Homebrew
5. 完成后重新点击"一键安装 Chrome"

## 安全考虑

### 权限控制

- 所有 API 端点都需要身份验证（`Authorization: Bearer {token}`）
- 安装和启动操作需要后端权限
- 不会在无用户确认的情况下执行危险操作

### 命令执行

- 使用 `promisify(exec)` 安全执行命令
- 不接受用户输入的命令参数
- 只执行预定义的安全命令

### 错误处理

- 所有操作都有 try-catch 保护
- 错误信息返回给用户，不暴露敏感信息
- 失败时提供明确的下一步指引

## 后续优化建议

1. ✨ **进度显示**
   - 安装过程中显示进度条
   - 实时显示安装日志

2. ✨ **多种浏览器支持**
   - 支持 Firefox (需要 --start-debugger-server)
   - 支持 Edge (Chrome DevTools Protocol)

3. ✨ **自动重试**
   - 安装失败后自动重试
   - 启动失败后自动重试

4. ✨ **版本检查**
   - 检查 Chrome 版本是否过低
   - 提示用户更新 Chrome

---

## 总结

### 新增功能
- ✅ **自动检查** - 页面加载时自动检查 Chrome 状态
- ✅ **状态显示** - 清晰显示安装和运行状态
- ✅ **一键安装** - macOS 支持通过 Homebrew 一键安装
- ✅ **一键启动** - 一键启动 Chrome 远程调试模式
- ✅ **引导说明** - 详细的安装和启动步骤
- ✅ **跨平台** - 支持 macOS、Linux、Windows

### 价值
1. **降低门槛** - 用户无需手动检查和配置
2. **提升体验** - 一键操作，自动化流程
3. **减少支持** - 清晰的引导减少用户疑问
4. **专业体验** - 完整的准备检查流程

### 完成
- ✅ 后端 API 已添加
- ✅ 前端界面已实现
- ✅ 跨平台支持已添加
- ✅ 文档已创建
- ✅ 服务已重启

---

**更新完成时间**: 2026-03-06 18:00
**状态**: ✅ 完成
**后端服务**: 已重启
**前端服务**: 已重启
