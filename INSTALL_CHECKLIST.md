# Mac Panel 安装检查清单

## 📋 安装前检查

### 系统要求
- [ ] macOS 版本 12.0 或更高
- [ ] 至少 4GB 内存（推荐 8GB+）
- [ ] 至少 2GB 可用磁盘空间
- [ ] 稳定的网络连接
- [ ] 管理员权限（sudo）

### 快速检查命令
```bash
# 检查 macOS 版本
sw_vers -productVersion

# 检查可用磁盘空间
df -h / | tail -1

# 检查内存
sysctl hw.memsize

# 检查网络
ping -c 3 github.com

# 检查管理员权限
sudo -v
```

## 🚀 安装步骤

### 第一步：获取项目
```bash
# 方式1: 从 GitHub 克隆（推荐）
git clone https://github.com/HYweb3/mac-panel.git
cd mac-panel

# 方式2: 从 GitHub 下载压缩包
# 访问 https://github.com/HYweb3/mac-panel
# 下载并解压到目标目录
```

### 第二步：运行安装脚本
```bash
# 添加执行权限
chmod +x install.sh

# 运行安装（需要管理员权限）
sudo ./install.sh
```

### 第三步：验证安装
```bash
# 检查服务状态
mac-panel status

# 访问 Web 界面
# 浏览器打开: http://localhost:3001
# 或: http://[你的IP]:3001
```

## ✅ 安装成功验证

### 服务状态检查
```bash
# 1. 检查后端服务
mac-panel status

# 2. 检查进程
ps aux | grep "mac-panel/backend.*app.js"

# 3. 检查端口
lsof -ti :3001

# 4. 检查日志
mac-panel logs
```

### Web 界面检查
- [ ] 能够访问 http://localhost:3001
- [ ] 能够看到登录界面
- [ ] 能够使用默认账号登录（admin/admin123）
- [ ] 能够看到主控面板
- [ ] 系统监控数据正常显示

### 功能验证
- [ ] 系统监控：CPU、内存、磁盘、网络正常
- [ ] 软件管理：能看到软件列表
- [ ] 文件管理：能浏览文件
- [ ] 终端：能打开终端
- [ ] 设置：能修改设置

## 🛠️ 故障排除检查清单

### 安装失败检查
```bash
# 1. 检查脚本权限
ls -la install.sh
# 应该显示: -rwxr-xr-x (755)

# 2. 检查管理员权限
sudo -v
# 应该显示: sudo: effective uid=0

# 3. 检查网络连接
ping -c 3 github.com
# 应该有回复

# 4. 检查磁盘空间
df -h /
# Available 应该 > 2GB
```

### 服务启动失败检查
```bash
# 1. 查看详细日志
cat /opt/mac-panel/backend/backend.log

# 2. 检查端口占用
lsof -ti :3001
# 如果有输出，说明端口被占用

# 3. 检查进程
ps aux | grep "node.*app.js"

# 4. 手动启动测试
cd /opt/mac-panel/backend
node dist/app.js
```

### 用户创建失败检查
```bash
# 1. 检查用户是否存在
id macpanel

# 2. 检查 admin 组成员
dscl . list /Groups | grep admin

# 3. 手动创建用户
sudo sysadminctl -addUser macpanel -fullName "Mac Panel User" -admin
```

### 权限问题检查
```bash
# 1. 检查项目目录权限
ls -la /opt/mac-panel/

# 2. 检查数据目录权限
ls -la /opt/mac-panel/backend/data/

# 3. 检查 sudoers 配置
sudo cat /etc/sudoers.d/mac-panel

# 4. 验证 sudoers 语法
sudo visudo -c -f /etc/sudoers.d/mac-panel
```

## 🔧 常见问题解决

### 问题 1: Homebrew 安装失败
```bash
# 手动安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 添加到 PATH
eval "$(/opt/homebrew/bin/brew shellenv)"

# 验证安装
brew --version
```

### 问题 2: Node.js 安装失败
```bash
# 安装特定版本
brew install node@18

# 链接到系统
brew link node@18

# 验证安装
node --version
npm --version
```

### 问题 3: 端口被占用
```bash
# 查找占用端口的进程
lsof -ti :3001

# 停止该进程
kill -9 $(lsof -ti :3001)

# 或者修改端口
# 编辑 /opt/mac-panel/backend/.env
# PORT=3002
```

### 问题 4: 权限被拒绝
```bash
# 修复项目目录权限
sudo chown -R macpanel:staff /opt/mac-panel
sudo chmod -R 755 /opt/mac-panel
sudo chmod 775 /opt/mac-panel/backend/data
```

### 问题 5: 服务无法启动
```bash
# 停止所有相关服务
mac-panel stop

# 清理 PID 文件
rm -f /opt/mac-panel/backend/backend.pid

# 重新启动
mac-panel start

# 检查日志
mac-panel logs
```

## 📱 局域网访问设置

### 查找本机 IP
```bash
# 方法1: 使用 ipconfig
ipconfig getifaddr en0

# 方法2: 使用 ifconfig
ifconfig | grep "inet " | grep -v 127.0.0.1

# 方法3: 查看所有网络接口
ifconfig -a | grep "inet "
```

### 配置允许外部访问
```bash
# 编辑后端环境配置
sudo nano /opt/mac-panel/backend/.env

# 修改 ALLOWED_HOSTS，添加你的 IP
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.x.x

# 重启服务
mac-panel restart
```

### 防火墙配置
```bash
# 启用防火墙
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# 添加端口规则
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add 3001

# 验证规则
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps
```

## 🎯 安装后推荐设置

### 1. 修改默认密码
- 登录后立即修改管理员密码
- 密码强度要求：至少8位，包含字母、数字、特殊字符

### 2. 配置自动备份
```bash
# 创建备份脚本
cat > ~/mac-panel-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /opt/mac-panel/backend/data/db.json ~/mac-panel-backup-$DATE.json
echo "✅ Backup completed: mac-panel-backup-$DATE.json"
EOF

chmod +x ~/mac-panel-backup.sh

# 添加到定时任务（可选）
crontab -e
# 添加: 0 2 * * * ~/mac-panel-backup.sh
```

### 3. 配置开机自启
```bash
# 创建 LaunchAgent
sudo nano ~/Library/LaunchAgents/com.macpanel.plist

# 重载服务
launchctl load ~/Library/LaunchAgents/com.macpanel.plist
```

### 4. 测试核心功能
- [ ] 安装一个软件（如 nginx）
- [ ] 创建一个简单的网站
- [ ] 查看系统监控数据
- [ ] 使用终端执行命令

## 📞 获取帮助

### 查看日志
```bash
# 实时日志
mac-panel logs

# 完整日志
cat /opt/mac-panel/backend/backend.log

# 错误日志
grep -i error /opt/mac-panel/backend/backend.log
```

### 重装或卸载
```bash
# 更新到最新版本
mac-panel update

# 完全重装
sudo ./install.sh

# 卸载
mac-panel stop
sudo rm -rf /opt/mac-panel
sudo rm /usr/local/bin/mac-panel
sudo rm /etc/sudoers.d/mac-panel
```

### 社区支持
- **GitHub Issues**: https://github.com/HYweb3/mac-panel/issues
- **文档**: 查看项目 README.md 和其他文档文件
- **日志**: 使用 `mac-panel logs` 获取详细信息

## ✅ 安装成功标志

当你看到以下所有项都为 ✅ 时，说明安装成功：

- [ ] ✅ 脚本执行无错误
- [ ] ✅ 所有依赖安装完成
- [ ] ✅ macpanel 用户创建成功
- [ ] ✅ 文件权限配置正确
- [ ] ✅ sudoers 配置正确
- [ ] ✅ 后端服务启动成功
- [ ] ✅ Web 界面可以访问
- [ ] ✅ 默认账号可以登录
- [ ] ✅ 管理命令可以正常使用
- [ ] ✅ 系统监控数据正常显示

**🎊 恭喜！你现在可以开始使用 Mac Panel 了！**
