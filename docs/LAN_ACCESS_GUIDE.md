# Mac Panel 局域网访问配置指南

## 配置说明

当前已配置为局域网访问模式：

- **局域网IP**: 192.168.0.7
- **前端访问地址**: http://192.168.0.7:5173
- **后端API地址**: http://192.168.0.7:3001

## 从局域网内其他设备访问

### 1. 确保设备在同一网络
确保您的设备（手机、平板、其他电脑）连接到相同的Wi-Fi网络

### 2. 访问地址
在浏览器中打开：
```
http://192.168.0.7:5173
```

### 3. 登录账户
- **用户名**: admin
- **密码**: admin123

## 防火墙配置（macOS）

### 查看防火墙状态
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

### 如果防火墙阻止访问
1. 打开"系统设置" → "网络" → "防火墙"
2. 点击"防火墙选项"
3. 确保允许传入连接的节点应用已包含：
   - node（或 ts-node）
   - Node.js 相关应用

或者临时关闭防火墙测试：
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 5173 | 前端 | Web界面访问 |
| 3001 | 后端API | API接口 |
| 3002 | 终端WS | WebSocket终端 |
| 3003 | 浏览器WS | WebSocket浏览器 |

## 当前环境变量配置

### 前端 (frontend/.env)
```bash
VITE_API_URL=http://192.168.0.7:3001
VITE_WS_URL=ws://192.168.0.7:3001
```

### 后端 CORS 配置
已允许以下源访问：
- http://localhost:5173
- http://localhost:5174
- http://192.168.0.7:5173
- http://192.168.0.7:5174
- http://127.0.0.1:5173
- http://127.0.0.1:5174

## 故障排查

### 1. 无法访问 192.168.0.7:5173

**检查服务状态**：
```bash
curl http://192.168.0.7:5173
```

**检查前端是否运行**：
```bash
lsof -i:5173
```

### 2. 可以访问页面但无法登录

**检查后端API**：
```bash
curl http://192.168.0.7:3001/health
```

应该返回：
```json
{"status":"ok","message":"Mac Panel Backend is running"}
```

### 3. CORS 错误

检查浏览器控制台是否有CORS错误。如果有，确保后端的CORS配置包含您的访问地址。

### 4. IP地址变化

如果您重启路由器或IP地址发生变化，需要：

1. 查看新的IP地址：
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

2. 更新 `frontend/.env` 文件中的IP地址

3. 重启前端服务

## 安全建议

1. **仅局域网使用**：此配置仅适合在可信的局域网内使用
2. **不要暴露到公网**：不要将此IP地址转发到公网
3. **修改默认密码**：首次登录后请修改admin密码
4. **定期备份**：定期备份数据库和重要数据

## 切换到公网访问

如果需要从外网访问，请参考 `docs/NETWORK_CONFIGURATION.md` 配置公网访问。

## 更新历史
- 2026-03-06: 配置局域网访问 (192.168.0.7)
