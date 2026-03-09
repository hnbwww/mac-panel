# WebSocket 配置说明

## 配置概述

Mac Panel 使用三个独立的 WebSocket 服务：

| 服务 | 端口 | 端点 | 用途 |
|------|------|------|------|
| 系统监控 | 3001 | `/ws/system-stats` | 实时系统信息推送 |
| 终端 | 3002 | `/ws/terminal` | 终端会话连接 |
| 浏览器 | 3003 | `/ws/browser` | 浏览器远程控制 |

## 局域网配置（当前）

### 环境变量配置

**文件**: `frontend/.env`

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

### WebSocket 连接地址

- **系统监控**: `ws://192.168.0.7:3001/ws/system-stats`
- **终端**: `ws://192.168.0.7:3002/ws/terminal`
- **浏览器**: `ws://192.168.0.7:3003/ws/browser`

## 使用方式

### 1. 系统监控（自动连接）

访问仪表盘或系统监控页面时，系统会自动连接到 `ws://192.168.0.7:3001/ws/system-stats` 并接收实时系统信息。

### 2. 终端连接

1. 点击左侧菜单"终端命令"
2. 点击"+"创建新终端
3. 选择 Shell 类型（zsh/bash/fish）
4. 自动连接到 `ws://192.168.0.7:3002/ws/terminal`

### 3. 浏览器控制

1. 点击左侧菜单"浏览器管理"
2. 点击"打开浏览器"
3. 自动连接到 `ws://192.168.0.7:3003/ws/browser`

## 代码中的使用

### 前端页面使用环境变量

**系统监控** (`SystemMonitor.tsx`):
```typescript
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
const ws = new WebSocket(`${WS_BASE_URL}/ws/system-stats?token=${token}`);
```

**终端** (`Terminal.tsx`):
```typescript
const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || 'ws://localhost:3002';
const ws = new WebSocket(`${TERMINAL_WS_URL}/ws/terminal`);
```

**浏览器** (`Browser.tsx`):
```typescript
const BROWSER_WS_URL = import.meta.env.VITE_BROWSER_WS_URL || 'ws://localhost:3003';
const ws = new WebSocket(`${BROWSER_WS_URL}/ws/browser`);
```

### 配置函数

**文件**: `frontend/src/config/index.ts`

```typescript
const getWsBaseUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // 生产环境使用当前域名的ws协议
  if (import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  // 开发环境默认使用localhost:3003
  return 'ws://localhost:3003';
};
```

## 修改IP地址

如果IP地址发生变化（例如重启路由器），需要：

1. **查看新IP地址**:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

2. **更新 `frontend/.env` 文件**:
```bash
# 将所有 192.168.0.7 替换为新IP
VITE_API_URL=http://NEW_IP:3001
VITE_WS_URL=ws://NEW_IP:3001
VITE_TERMINAL_WS_URL=ws://NEW_IP:3002
VITE_BROWSER_WS_URL=ws://NEW_IP:3003
```

3. **重启前端服务**:
```bash
# 停止前端
lsof -ti:5173 | xargs kill -9

# 重启前端
cd frontend
npm run dev
```

## 故障排查

### 1. WebSocket 连接失败

**检查服务端口**:
```bash
lsof -i:3001  # 系统监控
lsof -i:3002  # 终端
lsof -i:3003  # 浈览器
```

**测试脚本**:
```bash
./test-websocket.sh
```

### 2. CORS 错误

后端已配置允许以下源：
- `http://localhost:5173`
- `http://localhost:5174`
- `http://192.168.0.7:5173`
- `http://192.168.0.7:5174`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`

### 3. 防火墙阻止

**检查防火墙状态**:
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

**临时关闭防火墙测试**:
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

## 安全建议

1. **仅局域网使用**：当前配置仅适合可信的局域网
2. **不要暴露到公网**：WebSocket 未加密，不应直接暴露
3. **使用 Nginx 反向代理**：生产环境建议使用 Nginx + WSS（加密WebSocket）

## Nginx WebSocket 代理示例

```nginx
# WebSocket - 系统监控
location /ws/system-stats {
    proxy_pass http://localhost:3001/ws/system-stats;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# WebSocket - 终端
location /ws/terminal {
    proxy_pass http://localhost:3002/ws/terminal;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# WebSocket - 浏览器
location /ws/browser {
    proxy_pass http://localhost:3003/ws/browser;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## 更新历史

- 2026-03-06: 配置局域网 WebSocket (192.168.0.7)
  - 系统监控: ws://192.168.0.7:3001
  - 终端: ws://192.168.0.7:3002
  - 浏览器: ws://192.168.0.7:3003
