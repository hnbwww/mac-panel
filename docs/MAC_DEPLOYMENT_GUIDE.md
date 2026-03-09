# Mac Panel 部署完整指南

## 目录
1. [环境准备](#环境准备)
2. [项目安装](#项目安装)
3. [配置说明](#配置说明)
4. [启动服务](#启动服务)
5. [使用指南](#使用指南)
6. [常见问题](#常见问题)
7. [维护管理](#维护管理)

## 环境准备

### 1. 检查系统要求

#### macOS 版本要求
- **最低版本**: macOS 10.15 Catalina
- **推荐版本**: macOS 12.0 Monterey 或更高
- **架构**: Intel x64 或 Apple Silicon (M1/M2/M3)

#### 检查方法
```bash
# 查看 macOS 版本
sw_vers

# 查看系统架构
uname -m

# 查看系统详细信息
system_profiler SPSoftwareDataType
```

### 2. 安装 Node.js

#### 方法一：使用官方安装程序（推荐）
1. 访问 Node.js 官网：https://nodejs.org/
2. 下载 LTS 版本（推荐 Node.js 18.x 或 20.x）
3. 双击 .pkg 安装包
4. 按照安装向导完成安装

#### 方法二：使用 Homebrew
```bash
# 安装 Homebrew（如果未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node

# 验证安装
node --version
npm --version
```

#### 验证安装
```bash
# 检查 Node.js 版本（应该是 18.x 或更高）
node --version

# 检查 npm 版本
npm --version

# 检查安装路径
which node
which npm
```

**预期输出**:
```
node --version
v18.x.x

npm --version
9.x.x
```

### 3. 安装 Git（可选，用于版本控制）

```bash
# 使用 Homebrew 安装
brew install git

# 或下载安装包：https://git-scm.com/downloads
```

### 4. 准备工作目录

```bash
# 创建项目目录（根据您的偏好选择）
mkdir -p ~/mac-panel
cd ~/mac-panel

# 或使用当前目录
cd /Users/yourname/mac-panel
```

## 项目安装

### 1. 获取项目代码

#### 方法一：从压缩包解压
```bash
# 1. 将 mac-panel-xxx.tar.gz 复制到项目目录
cp /path/to/mac-panel-xxx.tar.gz .

# 2. 解压项目
tar -xzf mac-panel-xxx.tar.gz

# 3. 进入项目目录
cd mac-panel
```

#### 方法二：从 Git 克隆
```bash
# 如果项目托管在 Git 仓库
git clone <repository-url>
cd mac-panel
```

### 2. 安装项目依赖

#### 安装后端依赖
```bash
cd backend

# 安装所有依赖包
npm install

# 验证安装成功
ls -la node_modules | head -10
```

**说明**: 后端依赖包括：
- express（Web 框架）
- typescript（类型支持）
- ws（WebSocket）
- lowdb（JSON 数据库）
- systeminformation（系统信息）
- node-cron（定时任务）
- 其他必要依赖

**预计时间**: 2-5 分钟

#### 安装前端依赖
```bash
cd ../frontend

# 安装所有依赖包
npm install

# 验证安装成功
ls -la node_modules | head -10
```

**说明**: 前端依赖包括：
- react（UI 框架）
- vite（构建工具）
- antd（UI 组件库）
- @ant-design/charts（图表库）
- xterm（终端组件）
- react-router-dom（路由）
- 其他必要依赖

**预计时间**: 3-8 分钟

#### 可能遇到的问题

**问题1: 权限错误**
```bash
# 错误: EACCES: permission denied
# 解决方案: 使用 sudo 安装（不推荐，仅在必要时）
sudo npm install
```

**问题2: 网络慢或失败**
```bash
# 使用国内镜像源（推荐）
npm config set registry https://registry.npmmirror.com

# 重新安装
rm -rf node_modules package-lock.json
npm install
```

**问题3: 依赖冲突**
```bash
# 清理缓存后重新安装
npm cache clean --force
npm install
```

## 配置说明

### 1. 环境变量配置

#### 创建后端环境变量（可选）
```bash
cd backend

# 创建 .env 文件（如果需要自定义配置）
cat > .env << EOF
# 服务器端口
PORT=3001

# 数据库路径
DB_PATH=./data

# JWT 密钥（生产环境请更改）
JWT_SECRET=your-secret-key-change-in-production

# 日志级别
LOG_LEVEL=info
EOF
```

#### 创建前端环境变量（可选）
```bash
cd frontend

# 开发环境配置
cat > .env.development << EOF
# API 地址
VITE_API_URL=http://localhost:3001
EOF

# 生产环境配置
cat > .env.production << EOF
# API 地址（部署时修改为实际域名）
VITE_API_URL=https://your-domain.com
EOF
```

### 2. 默认账户

项目启动后会创建默认管理员账户：

```
用户名: admin
密码: admin123
```

**⚠️ 重要**: 首次登录后请立即修改密码！

### 3. 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 5173 | Vite 开发服务器 |
| 后端 | 3001 | Express API 服务器 |
| WebSocket-系统监控 | 3001/ws/system-stats | 系统状态推送 |
| WebSocket-终端 | 3002/ws/terminal | 终端通信 |
| WebSocket-浏览器 | 3003/ws/browser | 浏览器控制 |

## 启动服务

### 方法一：使用启动脚本（推荐）

```bash
# 在项目根目录
cd /Users/yourname/mac-panel

# 运行启动脚本
./start.sh
```

**启动脚本功能**:
- 同时启动前端和后端
- 自动创建必要的目录
- 后台运行服务
- 保存进程 PID

**输出示例**:
```
[INFO] Starting Mac Panel services...
[INFO] Backend starting...
[INFO] Frontend starting...
✅ Backend started on http://localhost:3001
✅ Frontend started on http://localhost:5173
```

### 方法二：手动启动

#### 启动后端
```bash
cd backend

# 开发模式
npm run dev

# 生产模式（如果配置了）
npm run prod
```

#### 启动前端
```bash
cd frontend

# 开发模式
npm run dev

# 生产构建
npm run build
npm run preview
```

### 后台运行（生产环境）

#### 使用 PM2（推荐）
```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd backend
pm2 start npm --name "mac-panel-backend" -- start

# 启动前端
cd frontend
npm run build
pm2 start npm --name "mac-panel-frontend" -- start preview

# 查看状态
pm2 list

# 查看日志
pm2 logs mac-panel-backend
pm2 logs mac-panel-frontend

# 停止服务
pm2 stop mac-panel-backend
pm2 stop mac-panel-frontend

# 重启服务
pm2 restart mac-panel-backend
pm2 restart mac-panel-frontend
```

#### 使用 nohup
```bash
# 启动后端
cd backend
nohup npm run dev > backend.log 2>&1 &
echo $! > backend.pid

# 启动前端
cd frontend
nohup npm run dev > frontend.log 2>&1 &
echo $! > frontend.pid

# 查看日志
tail -f backend.log
tail -f frontend.log

# 停止服务
kill $(cat backend.pid)
kill $(cat frontend.pid)
```

### 验证服务启动

#### 检查后端服务
```bash
# 测试 API 端点
curl http://localhost:3001/api/system/summary

# 检查进程
ps aux | grep "node.*backend" | grep -v grep
```

#### 检查前端服务
```bash
# 访问前端
open http://localhost:5173

# 或使用 curl
curl http://localhost:5173

# 检查进程
ps aux | grep vite | grep -v grep
```

## 使用指南

### 1. 首次登录

#### 访问应用
1. 打开浏览器
2. 访问 http://localhost:5173
3. 将看到登录页面

#### 登录
```
用户名: admin
密码: admin123
```

#### 修改密码（重要）
1. 登录后点击右上角用户名
2. 选择"修改密码"
3. 输入新密码
4. 确认修改

### 2. 功能模块导航

#### 左侧菜单
- **🖥️ 仪表盘**: 系统概览、快捷操作、服务管理
- **📁 文件管理**: 文件浏览、编辑、上传下载
- **💻 终端**: 命令行终端（多标签页）
- **📊 系统监控**: CPU、内存、磁盘、网络监控
- **⚙️ 进程管理**: 查看和管理系统进程
- **🌐 网站管理**: 创建和管理网站
- **🗄️ 数据库管理**: 数据库连接、SQL查询、数据管理
- **⏰ 任务中心**: 定时任务管理
- **🔧 软件管理**: 常用软件安装管理
- **🌍 浏览器管理**: 浏览器远程控制

### 3. 核心功能使用

#### 文件管理
1. 点击左侧菜单"文件管理"
2. 浏览文件和文件夹
3. 右键菜单：
   - 打开：进入文件夹
   - 编辑：修改文件内容（Monaco Editor）
   - 下载：下载文件到本地
   - 上传：上传本地文件到服务器
   - 压缩/解压：ZIP、TAR、TAR.GZ
   - 重命名：修改文件名

#### 终端管理
1. 点击左侧菜单"终端"
2. 点击"新建终端"按钮
3. 选择 Shell 类型（zsh/bash/fish）
4. 在终端中执行命令
5. 支持多标签页同时使用

#### 系统监控
1. 点击左侧菜单"系统监控"
2. 查看实时系统状态：
   - CPU 使用率图表
   - 内存使用率图表
   - 磁盘使用情况
   - 网络流量
3. 查看进程列表
4. 支持排序和筛选

#### 数据库管理
1. 点击左侧菜单"数据库管理"
2. 点击"添加数据库连接"
3. 填写连接信息：
   - 数据库类型：MySQL/PostgreSQL/MongoDB/Redis
   - 主机地址
   - 端口
   - 用户名
   - 密码
   - 数据库名
4. 测试连接
5. 保存连接
6. 执行 SQL 查询
7. 浏览和管理数据表

#### 服务管理（仪表盘）
1. 访问仪表盘页面
2. 在"服务管理"卡片中查看服务状态
3. 点击"重启"按钮重启服务：
   - 重启所有服务
   - 单独重启后端
   - 单独重启前端
4. 确认重启操作

## 常见问题

### 1. 端口被占用

#### 问题
```
Error: listen EADDRINUSE: address already in use :::3001
```

#### 解决方案
```bash
# 查找占用端口的进程
lsof -ti:3001

# 杀死进程
kill -9 <PID>

# 或修改端口（在 .env 文件中）
PORT=3002
```

### 2. 权限错误

#### 问题
```
Error: EACCES: permission denied
```

#### 解决方案
```bash
# 使用 sudo 启动（不推荐）
sudo npm run dev

# 或修复文件权限
chmod +x start.sh
```

### 3. 依赖安装失败

#### 问题
```
npm ERR! code MODULE_NOT_FOUND
```

#### 解决方案
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 4. 终端 PTY 权限错误

#### 问题
```
posix_spawnp failed: Operation not permitted
```

#### 解决方案
```bash
# 这个问题已在最新版本中修复
# 确保使用最新代码
git pull

# 重新安装依赖
cd backend
npm install

# 重启服务
./start.sh
```

### 5. 数据无法连接

#### 问题
数据库连接失败

#### 解决方案
```bash
# 检查数据库服务是否运行
# MySQL
brew services list | grep mysql

# PostgreSQL
brew services list | grep postgresql

# MongoDB
brew services list | grep mongodb-community

# Redis
brew services list | grep redis

# 启动数据库服务
brew services start mysql
```

### 6. 前端页面空白

#### 问题
访问页面后显示空白

#### 解决方案
```bash
# 1. 检查控制台错误（F12）
# 2. 检查后端服务是否运行
curl http://localhost:3001/api/system/summary

# 3. 清除浏览器缓存
# Cmd+Shift+Delete (Chrome)
# Cmd+Option+R (Safari)

# 4. 重新安装前端依赖
cd frontend
rm -rf node_modules
npm install
```

### 7. WebSocket 连接失败

#### 问题
终端、监控或浏览器控制无法连接

#### 解决方案
```bash
# 检查后端日志
cd backend
tail -f backend.log

# 检查端口是否正确
lsof -i :3001 -i :3002 -i :3003

# 重启后端服务
kill $(cat backend.pid)
./start.sh
```

## 维护管理

### 1. 日常维护

#### 查看服务状态
```bash
# 检查进程
ps aux | grep -E "vite|node.*backend" | grep -v grep

# 检查端口占用
lsof -i :3001 -i :5173
```

#### 查看日志
```bash
# 后端日志
tail -f backend/backend.log

# 前端日志
tail -f /tmp/frontend.log
```

#### 重启服务
```bash
# 使用启动脚本
./start.sh

# 或手动重启
kill $(cat backend.pid) $(cat frontend.pid)
./start.sh
```

### 2. 数据备份

#### 自动备份（推荐）
```bash
# 添加到 crontab
crontab -e

# 每天凌晨 3 点备份数据库
0 3 * * * cp ~/mac-panel/backend/data/db.json ~/backups/db-backup-$(date +\%Y%m%d).json
```

#### 手动备份
```bash
# 备份整个项目
tar -czf ~/backups/mac-panel-$(date +\%Y%m%d%H%M%S).tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  ~/mac-panel/
```

### 3. 更新项目

#### 更新代码
```bash
# 如果使用 Git
cd mac-panel
git pull

# 如果使用压缩包
# 解压新版本覆盖
```

#### 更新依赖
```bash
# 后端
cd backend
npm update

# 前端
cd frontend
npm update
```

### 4. 故障排查

#### 收集诊断信息
```bash
# 系统信息
sw_vers
uname -a

# Node.js 版本
node --version
npm --version

# 服务状态
ps aux | grep -E "vite|node.*backend" | grep -v grep

# 端口占用
lsof -i :3001 -i :5173

# 最近错误日志
tail -50 backend/backend.log
tail -50 /tmp/frontend.log
```

#### 重置所有服务
```bash
# 停止所有服务
pkill -f "node.*backend"
pkill -f vite

# 清理临时文件
rm -f backend.pid frontend.pid

# 重新启动
./start.sh
```

### 5. 性能优化

#### 清理系统缓存
```bash
# 清理 DNS 缓存
sudo dscacheutil -flushcache

# 清理系统日志
sudo periodic daily
```

#### 监控资源使用
```bash
# 查看内存使用
top -o mem

# 查看磁盘使用
df -h

# 查看进程资源使用
ps aux | sort -rk4 | head -10
```

## 生产环境部署

### 1. 使用 Nginx 反向代理

#### 安装 Nginx
```bash
brew install nginx
```

#### 配置 Nginx
```bash
# 编辑配置文件
sudo vi /usr/local/etc/nginx/nginx.conf
```

#### 示例配置
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /Users/yourname/mac-panel/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /ws/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

#### 重启 Nginx
```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo brew services restart nginx
```

### 2. 使用 PM2 进程管理

#### 安装 PM2
```bash
npm install -g pm2
```

#### 配置 PM2
```bash
cd mac-panel

# 创建 ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'mac-panel-backend',
      script: 'npm',
      args: 'run dev',
      cwd: './backend',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'mac-panel-frontend',
      script: 'npm',
      args: 'run preview',
      cwd: './frontend/dist',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF
```

#### 启动服务
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. 安全加固

#### 修改默认密码
```bash
# 1. 登录应用
# 2. 进入用户管理
# 3. 修改 admin 密码
```

#### 配置防火墙
```bash
# 仅允许必要端口
sudo /usr/libexec/ApplicationFirewall/socketfilterfw \
  /usr/libexec/ApplicationFirewall/socketfilterfw \
  --add 3001 # 后端 API
```

#### 启用 HTTPS（使用 Let's Encrypt）
```bash
# 安装 Certbot
brew install certbot

# 申请证书
sudo certbot certonly --standalone \
  -d your-domain.com

# 配置 Nginx 使用 SSL
```

## 故障排除

### 日志位置
- 后端日志：`backend/backend.log`
- 前端日志：`/tmp/frontend.log`
- 系统日志：`/var/log/system.log`

### 调试模式
```bash
# 后端调试（带日志）
cd backend
DEBUG=* npm run dev

# 前端调试
cd frontend
npm run dev
```

### 重置项目
```bash
# 1. 备份数据
cp backend/data/db.json ~/db-backup.json

# 2. 停止所有服务
pkill -f "node.*backend"
pkill -f vite

# 3. 重新安装依赖
cd backend && rm -rf node_modules && npm install
cd frontend && rm -rf node_modules && npm install

# 4. 恢复数据库
cp ~/db-backup.json backend/data/db.json

# 5. 重新启动
./start.sh
```

## 卸载

如果不再需要 Mac Panel，完全卸载：

### 1. 停止所有服务
```bash
pm2 delete all
# 或
pkill -f "node.*backend"
pkill -f vite
```

### 2. 删除项目文件
```bash
rm -rf ~/mac-panel
```

### 3. 卸载依赖
```bash
# 卸载 Node.js
# 通过官方安装程序卸载

# 卸载 Nginx（如果安装了）
brew uninstall nginx

# 卸载 PM2
npm uninstall -g pm2
```

## 附录

### A. 目录结构
```
mac-panel/
├── backend/           # 后端项目
│   ├── src/           # 源代码
│   ├── data/          # 数据库文件
│   ├── logs/          # 日志文件
│   └── package.json
├── frontend/          # 前端项目
│   ├── src/           # 源代码
│   ├── public/        # 静态资源
│   ├── package.json
│   └── dist/          # 构建产物
├── docs/              # 文档目录
├── AI_MEMORY/        # AI 记忆系统
├── backups/          # 备份目录
└── start.sh          # 启动脚本
```

### B. 默认端口配置
- 前端开发服务器：5173
- 后端 API 服务器：3001
- WebSocket 系统监控：3001/ws/system-stats
- WebSocket 终端：3002/ws/terminal
- WebSocket 浏览器：3003/ws/browser

### C. 环境变量参考
```bash
# 后端
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# 前端
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3003
```

### D. 有用的命令
```bash
# 查看端口占用
lsof -i :<port>

# 杀死进程
kill -9 <PID>

# 查看进程
ps aux | grep <process-name>

# 查看实时日志
tail -f <log-file>

# 后台运行
nohup <command> &
```

---

**文档版本**: 1.0
**更新时间**: 2026-03-06 11:17
**适用版本**: Mac Panel v2.7.0+
**支持平台**: macOS 10.15+
