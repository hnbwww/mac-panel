# 环境变量配置完整指南

## 配置说明

Mac Panel 使用环境变量来管理所有的 API 和 WebSocket 连接地址。这样做的好处是：

1. **统一配置**：所有地址在一个文件中管理
2. **环境自适应**：开发、生产、局域网环境自动切换
3. **易于维护**：修改 IP 地址只需改一个文件

## 环境变量文件

**文件位置**: `frontend/.env`

### 当前配置（局域网模式）

```bash
# API服务器地址
VITE_API_URL=http://192.168.0.7:3001

# WebSocket服务器地址
VITE_WS_URL=ws://192.168.0.7:3001

# 终端 WebSocket (端口 3002)
VITE_TERMINAL_WS_URL=ws://192.168.0.7:3002

# 浏览器 WebSocket (端口 3003)
VITE_BROWSER_WS_URL=ws://192.168.0.7:3003
```

## 代码使用方式

### 方式1：直接使用环境变量（推荐）

```typescript
// 系统监控
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://192.168.0.7:3001';
const ws = new WebSocket(`${WS_BASE_URL}/ws/system-stats`);

// 终端
const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || 'ws://192.168.0.7:3002';
const ws = new WebSocket(`${TERMINAL_WS_URL}/ws/terminal`);

// 浏览器
const BROWSER_WS_URL = import.meta.env.VITE_BROWSER_WS_URL || 'ws://192.168.0.7:3003';
const ws = new WebSocket(`${BROWSER_WS_URL}/ws/browser`);

// API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.0.7:3001';
fetch(`${API_BASE_URL}/api/system/summary`);
```

### 方式2：使用统一配置函数

```typescript
import { getApiBaseUrl, getWsBaseUrl, getTerminalWsUrl, getBrowserWsUrl } from '../config/api';

// 使用
const apiBaseUrl = getApiBaseUrl();
const wsBaseUrl = getWsBaseUrl();
const terminalWsUrl = getTerminalWsUrl();
const browserWsUrl = getBrowserWsUrl();
```

## 环境变量优先级

代码中的配置优先级如下：

1. **环境变量**（最高优先级）: `import.meta.env.VITE_*`
2. **生产环境**: `window.location.origin`
3. **开发环境默认值**: `192.168.0.7`（当前配置）

## 验证配置

### 1. 检查环境变量文件

```bash
cat frontend/.env
```

应该看到：
```
VITE_API_URL=http://192.168.0.7:3001
VITE_WS_URL=ws://192.168.0.7:3001
VITE_TERMINAL_WS_URL=ws://192.168.0.7:3002
VITE_BROWSER_WS_URL=ws://192.168.0.7:3003
```

### 2. 重启前端服务

```bash
# 停止前端
lsof -ti:5173 | xargs kill -9

# 重启前端
cd frontend
npm run dev
```

### 3. 清除浏览器缓存

如果修改了环境变量，需要：

1. 停止前端服务
2. 重启前端服务
3. 在浏览器中按 `Ctrl+Shift+R`（硬刷新）

### 4. 浏览器控制台验证

打开浏览器控制台（F12），运行：

```javascript
// 查看当前使用的API地址
console.log('API URL:', window.location.origin);
```

## 各页面使用的连接

### 系统监控页面 (SystemMonitor.tsx)
```typescript
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://192.168.0.7:3001';
const ws = new WebSocket(`${WS_BASE_URL}/ws/system-stats?token=${token}`);
```

### 终端页面 (Terminal.tsx)
```typescript
const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || 'ws://192.168.0.7:3002';
const ws = new WebSocket(`${TERMINAL_WS_URL}/ws/terminal?token=${token}`);
```

### 浏览器页面 (Browser.tsx)
```typescript
const BROWSER_WS_URL = import.meta.env.VITE_BROWSER_WS_URL || 'ws://192.168.0.7:3003';
const ws = new WebSocket(`${BROWSER_WS_URL}/ws/browser`);
```

### 仪表盘页面 (Dashboard.tsx)
```typescript
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://192.168.0.7:3001';
};

const API_BASE_URL = getApiBaseUrl();
const response = await fetch(`${API_BASE_URL}/api/system/summary`);
```

## 修改IP地址

如果IP地址发生变化：

1. **更新 .env 文件**:
```bash
cd frontend
nano .env  # 或使用其他编辑器
```

2. **替换所有IP地址**:
```bash
# 将 192.168.0.7 替换为新IP
VITE_API_URL=http://NEW_IP:3001
VITE_WS_URL=ws://NEW_IP:3001
VITE_TERMINAL_WS_URL=ws://NEW_IP:3002
VITE_BROWSER_WS_URL=ws://NEW_IP:3003
```

3. **重启前端服务**:
```bash
lsof -ti:5173 | xargs kill -9
cd frontend
npm run dev
```

## 常见问题

### 1. 修改.env文件后没有生效

**原因**: Vite在启动时读取环境变量，修改后需要重启

**解决**:
```bash
# 停止前端
lsof -ti:5173 | xargs kill -9

# 重启前端
cd frontend
npm run dev
```

### 2. 浏览器仍然连接到localhost

**原因**: 浏览器缓存了旧的JavaScript文件

**解决**:
- 硬刷新: `Ctrl+Shift+R`（Windows）或 `Cmd+Shift+R`（Mac）
- 或清除浏览器缓存

### 3. WebSocket连接失败

**检查清单**:
1. ✅ 后端服务是否运行（端口3001/3002/3003）
2. ✅ 前端服务是否运行（端口5173）
3. ✅ 环境变量是否正确配置
4. ✅ 防火墙是否阻止连接
5. ✅ IP地址是否正确

**测试命令**:
```bash
# 测试后端API
curl http://192.168.0.7:3001/health

# 测试前端
curl http://192.168.0.7:5173

# 检查端口
lsof -i:3001  # 后端
lsof -i:3002  # 终端WS
lsof -i:3003  # 浏览器WS
lsof -i:5173  # 前端
```

## 生产环境配置

生产环境建议：

1. **使用环境变量文件**:
```bash
# frontend/.env.production
VITE_API_URL=https://your-domain.com
VITE_WS_URL=wss://your-domain.com
VITE_TERMINAL_WS_URL=wss://your-domain.com
VITE_BROWSER_WS_URL=wss://your-domain.com
```

2. **使用Nginx反向代理**:
所有WebSocket和API请求都通过Nginx，使用统一的域名和端口

3. **使用HTTPS/WSS**:
生产环境必须使用加密连接

## 配置最佳实践

1. ✅ **使用环境变量**: 不要在代码中硬编码地址
2. ✅ **统一配置**: 使用统一的配置文件或函数
3. ✅ **优先级明确**: 环境变量 > 生产环境 > 默认值
4. ✅ **文档完善**: 记录所有配置项和修改方法
5. ✅ **版本控制**: .env.example纳入版本控制，.env不纳入
6. ✅ **安全考虑**: 不要在代码中暴露敏感信息

## 更新历史

- 2026-03-06: 创建环境变量配置完整指南
  - 统一所有API和WebSocket地址配置
  - 提供详细的验证和故障排查方法

