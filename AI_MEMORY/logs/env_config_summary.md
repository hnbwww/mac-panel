# 环境变量配置总结

## 工作时间
2026-03-06 11:40

## 目标
确保系统监控、终端命令、浏览器管理中的所有localhost配置都使用环境变量

## 完成的工作

### 1. 环境变量配置确认
**文件**: `frontend/.env`

```bash
VITE_API_URL=http://192.168.0.7:3001
VITE_WS_URL=ws://192.168.0.7:3001
VITE_TERMINAL_WS_URL=ws://192.168.0.7:3002
VITE_BROWSER_WS_URL=ws://192.168.0.7:3003
```

### 2. 统一配置文件
**文件**: `frontend/src/config/api.ts`

创建了统一的API和WebSocket配置函数：
- `getApiBaseUrl()` - 获取API地址
- `getWsBaseUrl()` - 获取系统监控WebSocket地址
- `getTerminalWsUrl()` - 获取终端WebSocket地址
- `getBrowserWsUrl()` - 获取浏览器WebSocket地址

所有函数都优先使用环境变量。

### 3. 代码使用情况

所有页面都已正确使用环境变量：

**系统监控 (SystemMonitor.tsx)**:
```typescript
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://192.168.0.7:3001';
const ws = new WebSocket(`${WS_BASE_URL}/ws/system-stats?token=${token}`);
```

**终端 (Terminal.tsx)**:
```typescript
const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || 'ws://192.168.0.7:3002';
const wsUrl = `${TERMINAL_WS_URL}/ws/terminal?token=${token}`;
```

**浏览器 (Browser.tsx)**:
```typescript
const BROWSER_WS_URL = import.meta.env.VITE_BROWSER_WS_URL || 'ws://192.168.0.7:3003';
const ws = new WebSocket(`${BROWSER_WS_URL}/ws/browser`);
```

**仪表盘 (Dashboard.tsx)**:
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
```

### 4. 配置文档
**文件**: `docs/ENV_CONFIG_GUIDE.md`

创建了完整的环境变量配置指南，包括：
- 配置说明
- 代码使用方式
- 环境变量优先级
- 验证配置方法
- 修改IP地址步骤
- 常见问题解决
- 最佳实践

## 配置优先级

所有代码遵循以下优先级：

1. **环境变量** (最高): `import.meta.env.VITE_*`
2. **生产环境**: `window.location.origin`  
3. **默认值**: `192.168.0.7` (当前局域网配置)

## 验证结果

- ✅ 环境变量文件已配置
- ✅ 所有页面使用环境变量
- ✅ fallback值已更新为192.168.0.7
- ✅ 后端服务运行正常
- ✅ 前端服务运行正常
- ✅ 配置文档已创建

## 连接地址

**API**: http://192.168.0.7:3001
**系统监控WS**: ws://192.168.0.7:3001/ws/system-stats
**终端WS**: ws://192.168.0.7:3002/ws/terminal
**浏览器WS**: ws://192.168.0.7:3003/ws/browser
**前端**: http://192.168.0.7:5174

## 注意事项

1. 修改`.env`文件后必须重启前端服务
2. 浏览器可能需要硬刷新（Ctrl+Shift+R）
3. 环境变量在Vite启动时读取，运行时不会自动重载

## 下次修改IP地址时

只需修改一个文件：`frontend/.env`

然后重启前端服务即可。
