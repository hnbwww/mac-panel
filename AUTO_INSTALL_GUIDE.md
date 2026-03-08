# Mac Panel 全自动安装指南

## 🚀 快速开始

### 一键安装（推荐）

```bash
# 克隆项目
git clone https://github.com/HYweb3/mac-panel.git
cd mac-panel

# 运行安装脚本
chmod +x install.sh
./install.sh
```

**就这么简单！** 脚本会自动完成所有配置。

## 📋 系统要求

- **操作系统**: macOS 12.0 或更高版本
- **处理器**: Intel 或 Apple Silicon (M1/M2/M3)
- **内存**: 至少 4GB RAM (推荐 8GB+)
- **磁盘空间**: 至少 2GB 可用空间
- **网络**: 需要互联网连接（用于下载依赖）
- **权限**: 需要管理员权限（sudo）

## 🔧 安装过程详解

### 自动化安装流程

`install.sh` 脚本会自动执行以下步骤：

1. **系统检查**
   - ✅ 检查 macOS 版本
   - ✅ 检查管理员权限
   - ✅ 检查网络连接

2. **环境准备**
   - 📦 安装 Homebrew（如果未安装）
   - 📦 安装 Node.js 18+ LTS
   - 📦 安装必要工具（git, curl, jq 等）

3. **项目部署**
   - 📥 从 GitHub 克隆项目
   - 📦 安装后端依赖
   - 📦 安装前端依赖
   - 🔨 构建前后端项目

4. **配置初始化**
   - ⚙️ 配置环境变量
   - 💾 初始化数据库
   - 🔐 配置文件权限
   - 🌐 检测本机IP地址

5. **服务启动**
   - 🚀 启动后端服务
   - ✅ 验证服务状态
   - 🎯 创建管理脚本

## 📱 访问地址

安装完成后，可以通过以下地址访问：

### 本地访问
```
http://localhost:3001
```

### 局域网访问
```
http://[你的IP地址]:3001
```

**查看本机IP**:
```bash
ipconfig getifaddr en0
```

## 🔑 默认账号

```
用户名: admin
密码: admin123
```

**⚠️ 重要**: 首次登录后请立即修改密码！

## ⚡ 管理命令

安装完成后，可以使用以下命令管理服务：

```bash
# 启动服务
mac-panel start

# 停止服务
mac-panel stop

# 重启服务
mac-panel restart

# 查看状态
mac-panel status

# 查看日志
mac-panel logs

# 更新版本
mac-panel update
```

## 🔍 故障排除

### 问题 1: 权限错误

**错误信息**: `Permission denied`

**解决方案**:
```bash
# 确保脚本有执行权限
chmod +x install.sh

# 使用 sudo 运行
sudo ./install.sh
```

### 问题 2: Homebrew 安装失败

**错误信息**: `Homebrew installation failed`

**解决方案**:
```bash
# 手动安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装完成后重新运行安装脚本
./install.sh
```

### 问题 3: Node.js 版本过低

**错误信息**: `Node.js version too old`

**解决方案**:
```bash
# 安装最新版 Node.js
brew install node@18

# 链接到系统
brew link --overwrite node@18

# 重新运行安装脚本
./install.sh
```

### 问题 4: 端口被占用

**错误信息**: `Port 3001 already in use`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -ti :3001

# 停止该进程
kill -9 $(lsof -ti :3001)

# 或者修改端口
# 编辑 backend/.env 文件
# PORT=3002
```

### 问题 5: 服务无法启动

**错误信息**: `Service failed to start`

**解决方案**:
```bash
# 查看详细日志
mac-panel logs

# 手动启动后端查看错误
cd /opt/mac-panel/backend
node dist/app.js

# 常见问题:
# - 端口占用 → 修改端口配置
# - 依赖缺失 → 重新运行 npm install
# - 权限问题 → 检查文件权限
```

## 🔄 更新项目

### 自动更新

```bash
# 使用管理命令更新
mac-panel update
```

### 手动更新

```bash
# 进入项目目录
cd /opt/mac-panel

# 拉取最新代码
git pull

# 安装新依赖
cd backend && npm install
cd ../frontend && npm install

# 重新构建
cd backend && npm run build
cd ../frontend && npm run build

# 重启服务
mac-panel restart
```

## 🗑️ 卸载项目

```bash
# 停止服务
mac-panel stop

# 删除项目目录
sudo rm -rf /opt/mac-panel

# 删除管理脚本
sudo rm /usr/local/bin/mac-panel

# 删除配置文件（可选）
sudo rm -rf ~/.mac-panel
```

## 📚 进阶配置

### 修改默认端口

编辑 `/opt/mac-panel/backend/.env`:

```env
# 修改后端端口
PORT=3002

# 修改前端端口（如果需要）
FRONTEND_PORT=5174
```

### 配置 HTTPS

1. 使用 Nginx 反向代理
2. 配置 SSL 证书
3. 修改前端 API 地址

详细配置请参考 [NGINX_LAN_SETUP.md](./NGINX_LAN_SETUP.md)

### 配置防火墙

```bash
# 添加端口到防火墙
/usr/libexec/ApplicationFirewall/socketfilterfw --add /opt/mac-panel/backend/dist/app.js
/usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /opt/mac-panel/backend/dist/app.js
```

### 配置开机自启

创建 LaunchAgent 服务：

```bash
# 创建 plist 文件
sudo nano /Library/LaunchAgents/com.macpanel.plist
```

内容：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.macpanel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/opt/mac-panel/backend/dist/app.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/opt/mac-panel/backend</string>
</dict>
</plist>
```

加载服务：
```bash
sudo launchctl load /Library/LaunchAgents/com.macpanel.plist
```

## 🌐 局域网访问配置

### 允许外部访问

编辑 `/opt/mac-panel/backend/.env`:

```env
# 添加你的局域网IP或使用通配符
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.0.77,0.0.0.0
```

### 查看局域网IP

```bash
# 查看所有网络接口的IP
ifconfig | grep "inet "

# 或者
ipconfig getifaddr en0
```

## 💾 数据备份

### 自动备份

```bash
# 创建备份脚本
cat > /opt/mac-panel/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/mac-panel/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# 备份数据库
cp /opt/mac-panel/backend/data/db.json "$BACKUP_DIR/db_$DATE.json"

# 保留最近7天的备份
find "$BACKUP_DIR" -name "db_*.json" -mtime +7 -delete

echo "✅ Backup completed: db_$DATE.json"
EOF

chmod +x /opt/mac-panel/backup.sh

# 添加到定时任务（每天凌晨2点备份）
crontab -e
# 添加这一行:
# 0 2 * * * /opt/mac-panel/backup.sh
```

### 手动备份

```bash
# 备份数据库
cp /opt/mac-panel/backend/data/db.json ~/mac-panel-backup-$(date +%Y%m%d).json

# 备份整个项目
cd /opt/mac-panel
tar -czf ~/mac-panel-full-backup-$(date +%Y%m%d).tar.gz .
```

## 📞 技术支持

- **GitHub Issues**: https://github.com/HYweb3/mac-panel/issues
- **文档**: 查看 README.md 和其他 .md 文档
- **日志**: 使用 `mac-panel logs` 查看详细日志

## 🎯 下一步

安装完成后，建议：

1. ✅ **修改默认密码**
   - 登录后立即修改管理员密码

2. ✅ **配置软件源**
   - 检查软件管理功能
   - 更新软件检测状态

3. ✅ **测试各项功能**
   - 系统监控
   - 软件安装
   - 文件管理
   - 终端控制

4. ✅ **配置网络访问**
   - 设置局域网访问
   - 配置防火墙规则

5. ✅ **设置自动备份**
   - 配置定时备份
   - 确保数据安全

---

**享受 Mac Panel 带来的便捷！** 🚀
