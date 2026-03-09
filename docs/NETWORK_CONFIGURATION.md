# Mac Panel 网络配置指南

## 问题说明

当从远程访问 Mac Panel 时，如果前端仍然尝试连接 `localhost:3001`，会导致登录失败和API调用失败。

## 解决方案

### 方法1：使用环境变量配置（推荐）

#### 前端配置

1. 复制环境变量示例文件：
```bash
cd frontend
cp .env.example .env
```

2. 编辑 `.env` 文件，设置您的公网IP或域名：
```bash
# 将 YOUR_PUBLIC_IP 替换为您的实际公网IP地址
VITE_API_URL=http://YOUR_PUBLIC_IP:3001
VITE_WS_URL=ws://YOUR_PUBLIC_IP:3001
```

3. 重新构建前端：
```bash
cd frontend
npm run build
```

#### 后端配置

1. 复制环境变量示例文件：
```bash
cd backend
cp .env.example .env
```

2. 根据需要修改配置（可选）

### 方法2：使用反向代理（生产环境推荐）

使用 Nginx 作为反向代理，可以：
- 统一端口访问
- 启用 HTTPS
- 负载均衡

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/mac-panel/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

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
}
```

### 方法3：使用开发模式（临时解决方案）

如果您只是临时需要远程访问，可以修改前端的 `src/config/index.ts`：

```typescript
const getApiBaseUrl = (): string => {
  // 临时指定公网IP
  return 'http://YOUR_PUBLIC_IP:3001';
};
```

**注意**：这种方法不推荐用于生产环境。

## 防火墙配置

确保以下端口在防火墙中开放：

```bash
# macOS (使用 pfctl 或应用程序防火墙)
# 端口：3001 (后端API)
#       3002 (终端WebSocket)
#       3003 (浏览器WebSocket)
#       5173 (前端开发服务器，可选)
```

## 安全建议

1. **生产环境必须配置**：
   - 强密码策略
   - HTTPS 证书
   - 限制访问IP
   - 定期更新依赖

2. **不要在生产环境使用**：
   - 默认JWT密钥
   - 弱密码
   - HTTP（未加密）

3. **建议的端口配置**：
   - 80/443: Nginx反向代理
   - 3001: 后端API（仅本地访问）
   - 3002-3003: WebSocket服务（仅本地访问）

## 测试配置

配置完成后，测试连接：

```bash
# 测试后端API
curl http://YOUR_PUBLIC_IP:3001/health

# 测试前端访问
curl http://YOUR_PUBLIC_IP:5173
```

## 常见问题

### 1. 登录后仍然无法访问API

**原因**：前端环境变量未生效

**解决**：
- 开发环境：确保 `.env` 文件在 `frontend/` 目录下
- 生产环境：需要重新构建前端 `npm run build`

### 2. WebSocket 连接失败

**原因**：WebSocket地址配置错误

**解决**：检查 `VITE_WS_URL` 是否正确配置

### 3. CORS 错误

**原因**：后端CORS配置未允许您的域名

**解决**：修改 `backend/src/app.ts` 中的 CORS 配置：

```typescript
app.use(cors({
  origin: 'http://YOUR_PUBLIC_IP:5173',  // 修改为你的前端地址
  credentials: true
}));
```

## 更新日志

- 2026-03-06: 创建文档，添加网络配置指南
