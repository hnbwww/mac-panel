# Mac Panel - 服务器管理系统 v2.0

类似宝塔面板的 Mac 平台服务器管理系统，现已升级到生产可用版本。

## 🚀 快速开始

### 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/hnbwww/mac-panel/master/web-install.sh | sudo bash
```

**就这么简单！** 安装脚本会自动：
- 📥 从 GitHub 下载最新代码
- 🔧 检查系统环境（macOS 12.0+）
- 📦 安装所有依赖（Homebrew、Node.js、git）
- 👤 创建服务用户和配置权限
- 🔨 构建并启动服务

**安装完成后访问**：http://localhost:5173 (前端) / http://localhost:3001 (后端)
**默认账号**：admin / admin123

### 手动安装

```bash
# 1. 克隆项目
git clone https://github.com/hnbwww/mac-panel.git
cd mac-panel

# 2. 运行安装脚本
chmod +x install.sh
sudo ./install.sh
```

详细安装文档请查看：[AUTO_INSTALL_GUIDE.md](./AUTO_INSTALL_GUIDE.md)

---

## ✨ 新增功能 (v2.0)

### 核心增强
- ✅ **权限管理系统** - 基于角色的访问控制 (RBAC)
- ✅ **操作日志审计** - 完整的操作日志记录和查询
- ✅ **数据库持久化** - 使用 lowdb 进行数据持久化存储
- ✅ **系统监控仪表盘** - 实时 CPU、内存、磁盘、网络监控
- ✅ **进程管理** - 查看和管理系统进程
- ✅ **任务中心** - 定时任务管理、执行记录、失败告警
- ✅ **增强终端** - 支持 node-pty 的真正伪终端，多标签页
- ✅ **文件上传** - 支持大文件和分片上传

## 功能特性

### 📁 文件管理
- 新建、复制、移动、删除文件/文件夹
- 文件内容编辑（Monaco Editor）
- 压缩/解压文件
- 文件上传下载
- 文件权限管理

### 💻 终端
- 多标签页支持
- 真正的伪终端体验（node-pty）
- 多 shell 支持（zsh/bash/fish）
- 工作目录切换
- 终端大小自适应

### 📊 系统监控
- **实时监控图表**
  - CPU 使用率趋势（最近 60 秒）
  - 内存使用率趋势
  - 网络流量监控
  - 磁盘分区使用率
- **系统信息**
  - CPU 核心数、负载均衡
  - 内存总量、已用、可用
  - 磁盘分区详情
  - 系统运行时间

### ⚙️ 进程管理
- 进程列表（支持搜索和排序）
- 按 CPU/内存排序
- 终止进程功能
- 进程详情查看

### 🌐 网站管理
- 创建/编辑/删除网站
- SSL 证书管理
- 网站备份
- 反向代理配置
- 访问日志查看

### 🗄️ 数据库管理
- 支持 MySQL、PostgreSQL、Redis、MongoDB
- 数据库创建/删除
- SQL 查询执行器
- 数据库备份

### ⏰ 任务中心
- **定时任务管理**
  - 支持 Shell 命令
  - 支持 HTTP 请求
  - 支持备份任务
  - Cron 表达式配置
- **执行记录**
  - 执行历史查询
  - 输出/错误查看
  - 执行状态追踪
- **告警通知**
  - 系统内通知中心
  - 邮件通知（需配置 SMTP）
  - Webhook 通知

## 技术架构

### 后端
- **框架**: Express + TypeScript
- **数据库**: lowdb (JSON 持久化)
- **终端**: node-pty (真正的伪终端)
- **系统信息**: systeminformation
- **定时任务**: node-cron
- **WebSocket**: 实时通信

### 前端
- **框架**: React 18 + TypeScript
- **UI 库**: Ant Design 5.x
- **图表**: @ant-design/charts (基于 G2Plot)
- **终端**: @xterm/xterm
- **状态管理**: Zustand

## 快速开始

### 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd frontend
npm install
```

### 启动开发服务器

```bash
# 终端 1 - 启动后端
cd backend
npm run dev

# 终端 2 - 启动前端
cd frontend
npm run dev
```

### 访问应用

- 前端地址: http://localhost:5173 (前端) / http://localhost:3001 (后端)
- 后端地址: http://localhost:5173 (前端) / http://localhost:3001 (后端)
- 默认账号: `admin`
- 默认密码: `admin123`

## 项目结构

```
mac-panel/
├── frontend/                # 前端项目
│   ├── src/
│   │   ├── components/     # 通用组件
│   │   │   └── Layout.tsx  # 主布局
│   │   ├── pages/          # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Files.tsx
│   │   │   ├── Terminal.tsx
│   │   │   ├── Websites.tsx
│   │   │   ├── Database.tsx
│   │   │   ├── SystemMonitor.tsx
│   │   │   ├── Processes.tsx
│   │   │   └── Tasks/
│   │   ├── services/       # API 服务
│   │   ├── store/          # Zustand 状态管理
│   │   └── config/         # 配置文件
│   └── package.json
│
├── backend/                # 后端项目
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   │   ├── auth.ts
│   │   │   ├── files.ts
│   │   │   ├── filesUpload.ts
│   │   │   ├── terminal.ts
│   │   │   ├── websites.ts
│   │   │   ├── database.ts
│   │   │   ├── system.ts
│   │   │   ├── tasks.ts
│   │   │   └── notifications.ts
│   │   ├── services/       # 业务逻辑
│   │   │   ├── database.ts
│   │   │   ├── terminalService.ts
│   │   │   ├── systemInfoService.ts
│   │   │   ├── taskScheduler.ts
│   │   │   └── notificationService.ts
│   │   ├── middlewares/    # 中间件
│   │   │   ├── auth.ts
│   │   │   ├── permission.ts
│   │   │   └── auditLog.ts
│   │   └── utils/          # 工具函数
│   └── package.json
```

## 环境变量配置

### 前端 (.env)
```env
VITE_API_URL=http://localhost:5173 (前端) / http://localhost:3001 (后端)
VITE_WS_URL=ws://localhost:3001
```

### 后端 (.env)
```env
PORT=3001
FRONTEND_PORT=5173
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
```

## 权限系统

### 预设角色

1. **admin** - 系统管理员
   - 拥有所有权限 (*)

2. **user** - 普通用户
   - files:read, write, create, delete
   - websites:read
   - database:read

3. **viewer** - 只读用户
   - 所有资源的只读权限 (*:read)

### 权限格式

权限格式为 `resource:action`，例如：
- `files:read` - 读取文件
- `files:write` - 写入文件
- `system:read` - 查看系统信息
- `tasks:execute` - 执行任务

## API 端点

### 认证
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/verify` - 验证 Token
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/change-password` - 修改密码

### 文件管理
- `GET /api/files/list` - 获取文件列表
- `POST /api/files/create` - 创建文件/文件夹
- `POST /api/files/upload` - 上传文件
- `GET /api/files/content` - 获取文件内容
- `POST /api/files/content` - 保存文件内容

### 系统监控
- `GET /api/system/info` - 获取系统信息
- `GET /api/system/cpu` - 获取 CPU 信息
- `GET /api/system/memory` - 获取内存信息
- `GET /api/system/disk` - 获取磁盘信息
- `GET /api/system/processes` - 获取进程列表
- `DELETE /api/system/processes/:pid` - 终止进程

### 任务管理
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务
- `POST /api/tasks/:id/execute` - 立即执行任务
- `POST /api/tasks/:id/toggle` - 切换启用状态
- `GET /api/tasks/:id/executions` - 获取执行记录

### 通知
- `GET /api/notifications` - 获取通知列表
- `PUT /api/notifications/:id/read` - 标记已读
- `POST /api/notifications/read-all` - 全部标记已读
- `DELETE /api/notifications/:id` - 删除通知

### WebSocket
- `WS /ws/terminal` - 终端连接
- `WS /ws/system-stats` - 系统状态推送

## 生产部署

### 构建项目

```bash
# 构建后端
cd backend
npm run build

# 构建前端
cd frontend
npm run build
```

### 使用 PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd backend
pm2 start dist/app.js --name mac-panel-backend

# 配置 Nginx 提供前端静态文件
# 前端构建产物在 frontend/dist 目录
```

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/mac-panel/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 反向代理到后端 API
    location /api/ {
        proxy_pass http://localhost:5173 (前端) / http://localhost:3001 (后端);
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://localhost:5173 (前端) / http://localhost:3001 (后端);
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

## 安全建议

⚠️ **生产环境部署前请务必：**

1. **修改默认密码**
   - 登录后立即修改 admin 用户密码

2. **更换 JWT_SECRET**
   - 在 .env 中设置强密码

3. **配置 HTTPS**
   - 使用 Let's Encrypt 或其他 SSL 证书

4. **配置防火墙**
   - 仅开放必要端口（80, 443）
   - 限制管理后台访问IP

5. **定期备份**
   - 备份数据库文件 (data/db.json)
   - 备份重要配置文件

6. **更新依赖**
   - 定期运行 `npm audit` 和 `npm update`

## 常见问题

### 1. 终端无法连接
- 检查 WebSocket 连接是否正常
- 确认后端服务正在运行

### 2. 文件上传失败
- 检查目标目录权限
- 确认文件大小未超过限制（默认 1GB）

### 3. 定时任务不执行
- 检查 Cron 表达式是否正确
- 查看执行记录了解失败原因

### 4. 系统信息不准确
- 某些系统指标需要管理员权限
- macOS 可能需要授权访问系统信息

## 开发路线图

- [ ] Docker 容器管理
- [ ] Let's Encrypt SSL 自动申请
- [ ] 真实数据库连接（MySQL/Redis 管理）
- [ ] 用户管理界面
- [ ] 操作日志查询界面
- [ ] 通知中心完整实现
- [ ] 系统配置管理
- [ ] 更多系统监控指标
- [ ] 性能优化

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
