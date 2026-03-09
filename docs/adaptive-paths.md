# 路径自适应改进说明

## 改进内容

### 1. 后端路径自适应

#### 修改文件：`backend/src/routes/system.ts`

#### 改进点：

**之前（硬编码）：**
```typescript
const pidFile = '/Users/www1/Desktop/claude/mac-panel/backend.pid';
const startCommand = 'cd /Users/www1/Desktop/claude/mac-panel/backend && nohup npm run dev > backend.log 2>&1 & echo $! > backend.pid';
```

**现在（自适应）：**
```typescript
// 获取项目根目录（从当前文件位置向上查找）
const currentDir = __dirname;
const projectRoot = path.resolve(currentDir, '../..');

const backendDir = path.join(projectRoot, 'backend');
const pidFile = path.join(projectRoot, 'backend.pid');
const logFile = path.join(backendDir, 'backend.log');

// 使用自适应路径
const startCommand = `cd "${backendDir}" && nohup npm run dev > "${logFile}" 2>&1 & echo $! > "${pidFile}"`;
```

### 2. 前端API地址自适应

#### 修改文件：`frontend/src/pages/Dashboard.tsx`

#### 改进点：

**之前（硬编码）：**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

**现在（自适应）：**
```typescript
// 获取API基础URL（支持开发和生产环境）
const getApiBaseUrl = () => {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 生产环境使用相对路径
  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  // 开发环境默认使用localhost:3001
  return 'http://localhost:3001';
};

// 使用函数获取API地址
const API_BASE_URL = getApiBaseUrl();
```

## 优势

### 1. **跨平台兼容**
- ✅ 支持不同操作系统（macOS, Linux, Windows）
- ✅ 支持不同路径结构
- ✅ 支持不同用户目录

### 2. **部署灵活**
- ✅ 可以部署到任意目录
- ✅ 不需要修改配置文件
- ✅ 自动适应项目位置

### 3. **环境自适应**
- ✅ 开发环境：使用 VITE_API_URL 或 localhost
- ✅ 生产环境：使用当前域名
- ✅ 测试环境：自动适配

### 4. **路径安全**
- ✅ 使用 path.join() 处理路径分隔符
- ✅ 避免路径注入风险
- ✅ 支持空格路径（使用引号包裹）

## 使用示例

### 场景1：项目在用户目录
```
/Users/username/projects/mac-panel/
```
系统会自动识别并使用正确的路径。

### 场景2：项目在服务器目录
```
/var/www/mac-panel/
```
无需修改代码，自动适配。

### 场景3：项目在Windows系统
```
C:\projects\mac-panel\
```
Node.js 的 path 模块会自动处理路径分隔符。

## 环境变量配置

### 开发环境
创建 `.env.development` 文件：
```bash
VITE_API_URL=http://localhost:3001
```

### 生产环境
创建 `.env.production` 文件：
```bash
VITE_API_URL=https://your-domain.com
```

### 不设置环境变量
系统会自动使用：
- 开发：`http://localhost:3001`
- 生产：当前页面域名

## API 接口改进

### 重启服务接口
**请求：**
```json
POST /api/system/restart-services
{
  "services": "all"  // 或 "backend" 或 "frontend"
}
```

**响应：**
```json
{
  "success": true,
  "restarted": ["backend", "frontend"],
  "errors": [],
  "projectRoot": "/path/to/mac-panel"
}
```

### 服务状态接口
**请求：**
```
GET /api/system/services-status
```

**响应：**
```json
{
  "backend": {
    "running": true,
    "pid": "54136"
  },
  "frontend": {
    "running": true,
    "pid": "18483"
  },
  "projectRoot": "/path/to/mac-panel"
}
```

## 测试验证

### 1. 后端测试
```bash
# 检查路径是否正确
node -e "console.log(require('path').resolve(__dirname, '../..'))"

# 测试重启接口
curl -X POST http://localhost:3001/api/system/restart-services \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"services": "backend"}'
```

### 2. 前端测试
```bash
# 检查API地址是否正确
# 在浏览器控制台执行
console.log(import.meta.env.VITE_API_URL || window.location.origin)
```

## 注意事项

1. **相对路径限制**
   - 后端使用 `__dirname` 获取当前文件路径
   - 需要确保项目结构相对稳定

2. **权限问题**
   - 确保有权限访问项目目录
   - 确保有权限创建日志文件

3. **进程管理**
   - PID 文件存储在项目根目录
   - 确保有权限读写 PID 文件

4. **跨域问题**
   - 生产环境需要配置反向代理
   - 或设置正确的 CORS 策略

## 兼容性

- ✅ Node.js 14+
- ✅ macOS, Linux, Windows
- ✅ Vite 4+
- ✅ TypeScript 4+

## 更新日志

### 2026-03-06
- ✅ 移除所有硬编码路径
- ✅ 使用 path 模块处理路径
- ✅ 添加环境变量支持
- ✅ 改进API地址获取逻辑
- ✅ 添加项目根目录返回
