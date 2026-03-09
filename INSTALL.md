# Mac Panel 安装指南1

## 目录

- [系统要求](#系统要求)
- [快速安装](#快速安装)
- [详细安装](#详细安装)
- [配置](#配置)
- [启动和停止](#启动和停止)
- [访问](#访问)
- [卸载](#卸载)
- [常见问题](#常见问题)

---

## 系统要求

### 硬件要求
- **处理器**: Apple Silicon (M1/M2/M3) 或 Intel
- **内存**: 最低 4GB，推荐 8GB+
- **磁盘**: 最低 10GB 可用空间

### 软件要求
- **操作系统**: macOS 12.0 Monterey 或更高版本
- **Xcode Command Line Tools**: 用于编译依赖

### 网络要求
- 互联网连接（安装依赖需要）
- 如果使用防火墙，需开放端口：3001, 5173

---

## 快速安装

### 方法一：一键安装（推荐）

```bash
# 1. 下载项目
git clone https://github.com/yourusername/mac-panel.git
cd mac-panel

# 2. 运行安装脚本
sudo ./install.sh

# 3. 等待安装完成，自动启动服务
```

**安装脚本会自动完成**：
- ✅ 检查系统版本
- ✅ 安装 Homebrew
- ✅ 安装 Node.js 18+
- ✅ 创建专用用户
- ✅ 配置权限
- ✅ 安装依赖
- ✅ 启动服务

---

## 详细安装

### 步骤 1: 准备工作

#### 1.1 安装 Xcode Command Line Tools

```bash
xcode-select --install
```

#### 1.2 检查系统版本

```bash
sw_vers -productVersion
```

确保版本为 12.0 或更高。

### 步骤 2: 安装 Homebrew

如果未安装 Homebrew：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

验证安装：

```bash
brew --version
```

### 步骤 3: 安装 Node.js

```bash
# 安装 Node.js 18 LTS
brew install node

# 验证安装
node --version   # 应显示 v18.x.x 或更高
npm --version
```

### 步骤 4: 克隆项目

```bash
# 使用 HTTPS
git clone https://github.com/yourusername/mac-panel.git

# 或使用 SSH（需配置密钥）
git clone git@github.com:yourusername/mac-panel.git

cd mac-panel
```

### 步骤 5: 安装依赖

#### 5.1 后端依赖

```bash
cd backend
npm install
```

#### 5.2 前端依赖

```bash
cd ../frontend
npm install
```

#### 5.3 构建前端

```bash
npm run build
```

### 步骤 6: 配置环境

#### 6.1 创建环境变量

**后端 (`backend/.env`)**:

```bash
PORT=3001
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
ALLOWED_HOSTS=localhost,127.0.0.1
```

**前端 (`frontend/.env`)**:

```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_TERMINAL_WS_URL=ws://localhost:3002
VITE_BROWSER_WS_URL=ws://localhost:3003
```

#### 6.2 初始化数据库

数据库会在首次启动时自动创建，默认管理员账号：
- **用户名**: admin
- **密码**: admin123

### 步骤 7: 启动服务

**使用管理命令**（推荐）：

```bash
sudo cp mac-panel /usr/local/bin/
sudo chmod +x /usr/local/bin/mac-panel
mac-panel start
```

**或手动启动**：

```bash
# 启动后端
cd backend
export NODE_ENV=production
nohup node dist/app.js > backend.log 2>&1 &
echo $! > backend.pid

# 启动前端
cd frontend/dist
nohup python3 -m http.server 5173 > frontend.log 2>&1 &
echo $! > frontend.pid
```

---

## 配置

### 网络配置

#### 局域网访问

**前端配置** (`frontend/.env`):

```bash
VITE_API_URL=http://192.168.x.x:3001
VITE_WS_URL=ws://192.168.x.x:3001
```

**后端配置** (`backend/.env`):

```bash
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.x.x
```

#### 公网访问

1. **配置路由器**：
   - 端口映射：3001 → 内网IP:3001
   - 端口映射：5173 → 内网IP:5173

2. **使用 Nginx 反向代理**（推荐）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Nginx 配置

#### 安装 Nginx

```bash
brew install nginx
```

#### 配置 sudoers

```bash
sudo visudo
```

添加：

```
# Mac Panel Nginx 管理
www1 ALL=(ALL) NOPASSWD: /usr/local/bin/nginx-manage
www1 ALL=(ALL) NOPASSWD: /opt/homebrew/bin/nginx -s reload
```

---

## 启动和停止

### 使用管理命令

```bash
# 启动所有服务
mac-panel start

# 停止所有服务
mac-panel stop

# 重启所有服务
mac-panel restart

# 查看服务状态
mac-panel status

# 查看后端日志
mac-panel logs
```

### 手动控制

```bash
# 查看进程
ps aux | grep "node\|python3" | grep -v grep

# 停止后端
kill $(cat backend/backend.pid)

# 停止前端
kill $(cat frontend/frontend.pid)
```

### 开机自启动

#### 方法一：LaunchAgent（推荐）

创建 `~/Library/LaunchAgents/com.github.macpanel.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>Label</key>
        <string>com.github.macpanel.backend</string>
        <key>ProgramArguments</key>
        <array>
            <string>/opt/mac-panel/backend/start-backend.sh</string>
        </array>
        <key>RunAtLoad</key>
        <true/>
        <key>KeepAlive</key>
        <true/>
    </dict>
</plist>
```

加载服务：

```bash
launchctl load ~/Library/LaunchAgents/com.github.macpanel.plist
launchctl start com.github.macpanel.backend
```

---

## 访问

### 本地访问

安装完成后，在浏览器中打开：

- **前端界面**: http://localhost:5173
- **后端 API**: http://localhost:3001

### 局域网访问

确保防火墙允许端口 3001 和 5173：

```bash
# 查看防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 如果防火墙已启用，添加端口规则
/usr/libexec/ApplicationFirewall/socketfilterfw --add 3001
/usr/libexec/ApplicationFirewall/socketfilterfw --add 5173
```

### 首次登录

1. 访问 http://localhost:5173
2. 使用默认账号登录：
   - 用户名: **admin**
   - 密码: **admin123**
3. 登录后立即修改密码

---

## 卸载

### 完全卸载

```bash
# 1. 停止服务
mac-panel stop

# 2. 删除用户（如果创建了专用用户）
sudo sysadminctl -deleteUser macpanel

# 3. 删除项目目录
sudo rm -rf /opt/mac-panel

# 4. 删除管理命令
sudo rm /usr/local/bin/mac-panel

# 5. 删除 sudoers 配置
sudo rm /etc/sudoers.d/mac-panel

# 6. 删除 LaunchAgent（如果配置了）
launchctl unload ~/Library/LaunchAgents/com.github.macpanel.plist
rm ~/Library/LaunchAgents/com.github.macpanel.plist
```

---

## 常见问题

### Q1: 安装时提示 "Permission denied"

**A**: 使用 sudo 运行安装脚本：

```bash
sudo ./install.sh
```

### Q2: Node.js 版本过低

**A**: 使用 Homebrew 安装最新版本：

```bash
brew reinstall node
```

### Q3: 端口被占用

**A**: 检查并终止占用端口的进程：

```bash
# 查看 3001 端口
lsof -i :3001

# 查看 5173 端口
lsof -i :5173

# 终止进程
kill -9 <PID>
```

### Q4: 前端无法连接后端

**A**: 检查后端服务状态：

```bash
mac-panel status
curl http://localhost:3001/api/system/info
```

确保后端 `.env` 文件配置正确。

### Q5: 文件上传失败

**A**: 检查目录权限：

```bash
# 进入项目目录
cd /opt/mac-panel

# 设置数据目录权限
chmod 775 backend/data
```

### Q6: Nginx 配置测试失败

**A**: 检查配置目录权限：

```bash
sudo ./fix-nginx-permissions.sh
```

### Q7: 如何修改默认密码？

**A**:
1. 登录后，点击右上角用户头像
2. 选择"修改密码"
3. 输入旧密码和新密码
4. 点击"确定"

### Q8: 如何更新到最新版本？

**A**:
```bash
cd /opt/mac-panel
git pull
mac-panel update
```

或使用管理命令：

```bash
mac-panel update
```

---

## 技术支持

### 日志位置

- **后端日志**: `/opt/mac-panel/backend/backend.log`
- **前端日志**: `/opt/mac-panel/frontend/frontend.log`
- **进程 ID**:
  - 后端: `/opt/mac-panel/backend/backend.pid`
  - 前端: `/opt/mac-panel/frontend/frontend.pid`

### 查看日志

```bash
# 使用管理命令
mac-panel logs

# 或直接查看
tail -f /opt/mac-panel/backend/backend.log
tail -f /opt/mac-panel/frontend/frontend.log
```

### 联系方式

- **GitHub**: https://github.com/yourusername/mac-panel/issues
- **Email**: support@example.com

---

## 下一步

安装完成后，建议您：

1. ✅ **修改默认密码** - 保护系统安全
2. ✅ **配置 SSL 证书** - 启用 HTTPS
3. ✅ **设置防火墙** - 限制入站访问
4. ✅ **定期备份** - 备份数据和配置
5. ✅ **查看文档** - 了解所有功能

---

**版本**: v2.8.1
**更新日期**: 2026-03-08
**维护**: Mac Panel Team
