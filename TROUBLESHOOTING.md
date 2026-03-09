# Mac Panel 故障排查指南

## 目录

- [安装问题](#安装问题)
- [启动问题](#启动问题)
- [网络问题](#网络问题)
- [权限问题](#权限问题)
- [功能问题](#功能问题)
- [性能问题](#性能问题)
- [卸载问题](#卸载问题)

---

## 安装问题

### 问题 1.1: "sudo: command not found"

**症状**: 运行 `sudo ./install.sh` 时提示找不到 sudo 命令

**原因**: 当前用户不在管理员组

**解决方案**:

```bash
# 1. 检查当前用户
whoami

# 2. 检查是否在 admin 组
groups
```

如果不在 admin 组：

```bash
# 系统偏好设置 -> 用户与组 -> 当前用户
# 右键 -> 选项 -> 允许用户管理这台电脑
```

---

### 问题 1.2: "Homebrew 安装失败"

**症状**: Homebrew 安装过程中断或报错

**原因**: 网络问题或证书问题

**解决方案**:

```bash
# 方法1: 使用国内镜像
/bin/bash -c "$(curl -fsSL https://gitee.io/ineo6/homebrew-install/raw/master/install.sh)"

# 方法2: 手动下载安装脚本
curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o install.sh
sudo install.sh
```

**验证安装**:

```bash
brew --version
brew doctor
```

---

### 问题 1.3: Node.js 安装失败

**症状**: `brew install node` 失败

**解决方案**:

```bash
# 更新 Homebrew
brew update
brew upgrade

# 清理缓存
brew cleanup

# 重新安装
brew reinstall node
```

---

### 问题 1.4: "npm install" 失败

**症状**: 运行 `npm install` 时报错

**原因**: 网络问题或依赖冲突

**解决方案**:

```bash
# 方法1: 清除缓存
npm cache clean --force

# 方法2: 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 方法3: 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

---

## 启动问题

### 问题 2.1: 后端启动失败

**症状**: 运行 `mac-panel start` 后，后端无法访问

**排查步骤**:

```bash
# 1. 检查进程
mac-panel status

# 2. 查看后端日志
tail -50 /opt/mac-panel/backend/backend.log

# 3. 检查端口占用
lsof -i :3001

# 4. 手动启动测试
cd /opt/mac-panel/backend
export NODE_ENV=production
node dist/app.js
```

**常见错误**:

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| `EADDRINUSE` | 端口被占用 | 终止占用进程 |
| `EACCES` | 权限不足 | 使用 sudo 启动 |
| `Cannot find module` | 依赖未安装 | 运行 `npm install` |
| `Invalid JWT_SECRET` | 环境变量未设置 | 检查 `.env` 文件 |

---

### 问题 2.2: 前端启动失败

**症状**: 访问 http://localhost:5173 无法打开

**排查步骤**:

```bash
# 1. 检查前端进程
ps aux | grep "http.server 5173"

# 2. 查看前端日志
tail -50 /opt/mac-panel/frontend/frontend.log

# 3. 检查端口
lsof -i :5173

# 4. 手动启动测试
cd /opt/mac-panel/frontend/dist
python3 -m http.server 5173
```

**解决方案**:

```bash
# 如果前端未构建
cd /opt/mac-panel/frontend
npm run build

# 如果端口被占用
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

---

### 问题 2.3: 服务启动后自动停止

**症状**: 启动后进程立即退出

**排查步骤**:

```bash
# 1. 查看退出码
echo $?

# 2. 查看详细错误
node dist/app.js

# 3. 检查环境变量
cat backend/.env

# 4. 查看系统日志
log show --predicate 'process == "node"' --last 10m
```

**常见原因**:
- 数据库文件损坏
- 环境变量配置错误
- 端口冲突
- 依赖包版本不兼容

---

## 网络问题

### 问题 3.1: 前端无法连接后端

**症状**: 前端页面显示 "网络错误" 或 "无法连接到服务器"

**排查步骤**:

```bash
# 1. 检查后端服务
curl http://localhost:3001/api/system/info

# 2. 检查前端环境变量
cat frontend/.env | grep VITE_API_URL

# 3. 检查防火墙
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 4. 测试网络连通性
ping -c 3 localhost
telnet localhost 3001
```

**解决方案**:

```bash
# 确保 .env 配置正确
VITE_API_URL=http://localhost:3001

# 重启前端服务
mac-panel restart
```

---

### 问题 3.2: 局域网无法访问

**症状**: 局域网其他设备无法访问面板

**原因**: 防火墙阻止或未配置允许的主机

**解决方案**:

```bash
# 1. 检查防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 2. 如果防火墙开启，添加端口规则
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add 3001
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add 5173

# 3. 检查后端 ALLOWED_HOSTS
cat /opt/mac-panel/backend/.env | grep ALLOWED_HOSTS

# 应包含局域网IP，如:
# ALLOWED_HOSTS=localhost,127.0.0.1,192.168.0.77

# 4. 重启服务
mac-panel restart
```

---

### 问题 3.3: WebSocket 连接失败

**症状**: 终端、系统监控等功能无法使用

**排查步骤**:

```bash
# 1. 检查 WebSocket 进程
ps aux | grep -E "ws://|websocket"

# 2. 检查端口
lsof -i :3002
lsof -i :3003

# 3. 查看 WebSocket 配置
cat frontend/.env | grep WS_URL
```

**解决方案**:

```bash
# 确保环境变量正确
VITE_TERMINAL_WS_URL=ws://localhost:3002/ws/terminal
VITE_BROWSER_WS_URL=ws://localhost:3003/ws/browser
```

---

## 权限问题

### 问题 4.1: "Permission denied" 错误

**症状**: 文件操作时报错权限不足

**解决方案**:

```bash
# 1. 检查当前用户
whoami

# 2. 检查文件所有者
ls -la /opt/mac-panel

# 3. 修改权限
sudo chown -R $USER:staff /opt/mac-panel
sudo chmod -R 755 /opt/mac-panel
```

---

### 问题 4.2: Nginx reload 失败

**症状**: 保存 Nginx 配置时提示权限错误

**原因**: nginx reload 需要 sudo 权限

**解决方案**:

```bash
# 1. 配置 sudoers
sudo visudo

# 添加以下内容:
www1 ALL=(ALL) NOPASSWD: /usr/local/bin/nginx-manage
www1 ALL=(ALL) NOPASSWD: /opt/homebrew/bin/nginx -s reload

# 2. 测试
sudo nginx-manage reload
```

---

### 问题 4.3: 无法编辑系统文件

**症状**: 无法编辑 /etc/hosts 等系统文件

**解决方案**:

```bash
# 使用 sudo 编辑
sudo nano /etc/hosts

# 或修改文件权限
sudo chmod 666 /etc/hosts
```

---

## 功能问题

### 问题 5.1: 终端无法使用

**症状**: 终端页面显示错误或无法连接

**排查步骤**:

```bash
# 1. 检查 node-pty 是否安装
cd /opt/mac-panel/backend
npm list node-pty

# 2. 检查 WebSocket 服务
ps aux | grep "ws/terminal"

# 3. 查看 WebSocket 配置
cat frontend/.env | grep TERMINAL_WS_URL
```

**解决方案**:

```bash
# 重新安装依赖
cd /opt/mac-panel/backend
npm install node-pty --save

# 重启服务
mac-panel restart
```

---

### 问题 5.2: 文件上传失败

**症状**: 上传文件时提示错误

**排查步骤**:

```bash
# 1. 检查目标目录权限
ls -la /opt/mac-panel/backend/data

# 2. 检查磁盘空间
df -h

# 3. 查看上传日志
tail -50 /opt/mac-panel/backend/backend.log | grep upload
```

**解决方案**:

```bash
# 设置正确的权限
chmod 775 /opt/mac-panel/backend/data

# 如果使用 www1 用户
sudo chown -R www1:staff /opt/mac-panel/backend/data
```

---

### 问题 5.3: 数据库连接失败

**症状**: 数据库管理页面显示连接错误

**原因**: 数据库未安装或配置错误

**解决方案**:

```bash
# 检查 MySQL 是否安装
brew list mysql

# 如果未安装，安装 MySQL
brew install mysql
brew services start mysql

# 设置 root 密码
mysql_secure_installation

# 测试连接
mysql -u root -p
```

---

## 性能问题

### 问题 6.1: 页面加载缓慢

**症状**: 前端页面加载很慢

**解决方案**:

```bash
# 1. 清除浏览器缓存
# 浏览器设置 -> 清除浏览数据

# 2. 检查网络速度
ping -c 5 8.8.8.8

# 3. 检查服务状态
mac-panel status

# 4. 优化前端构建
cd /opt/mac-panel/frontend
npm run build
```

---

### 问题 6.2: 后端响应慢

**症状**: API 请求响应时间长

**排查步骤**:

```bash
# 1. 检查系统资源
top -o cpu

# 2. 查看后端日志
tail -f /opt/mac-panel/backend/backend.log

# 3. 检查数据库性能
# 如果使用 MySQL
mysql -u root -p -e "SHOW PROCESSLIST;"
```

---

## 卸载问题

### 问题 7.1: 无法停止服务

**症状**: `mac-panel stop` 无效

**解决方案**:

```bash
# 强制终止进程
pkill -9 -f "backend/dist/app.js"
pkill -9 -f "http.server 5173"

# 或使用 PID
kill -9 $(cat /opt/mac-panel/backend/backend.pid)
kill -9 $(cat /opt/mac-panel/frontend/frontend.pid)
```

---

### 问题 7.2: 无法删除项目目录

**症状**: `rm -rf /opt/mac-panel` 提示权限不足

**解决方案**:

```bash
# 停止所有服务
mac-panel stop

# 强制删除
sudo rm -rf /opt/mac-panel
```

---

## 获取帮助

### 日志位置

- **后端日志**: `/opt/mac-panel/backend/backend.log`
- **前端日志**: `/opt/mac-panel/frontend/frontend.log`
- **Nginx 日志**: `/opt/homebrew/var/log/nginx/`

### 收集诊断信息

创建诊断脚本：

```bash
cat > diagnose.sh << 'EOF'
#!/bin/bash

echo "=== Mac Panel 诊断信息 ==="
echo ""

echo "系统信息:"
sw_vers -productVersion
echo ""

echo "Node.js 版本:"
node --version
npm --version
echo ""

echo "服务状态:"
ps aux | grep -E "node|python3" | grep -v grep
echo ""

echo "端口占用:"
lsof -i :3001 || echo "3001 端口空闲"
lsof -i :5173 || echo "5173 端口空闲"
echo ""

echo "后端日志 (最后20行):"
tail -20 /opt/mac-panel/backend/backend.log
echo ""

echo "磁盘使用:"
df -h
EOF

chmod +x diagnose.sh
./diagnose.sh
```

---

## 紧急救援

### 完全重置

如果所有方法都失败，执行完全重置：

```bash
# 1. 停止所有服务
sudo pkill -9 -f "node|python3"

# 2. 备份数据
cp -r /opt/mac-panel/backend/data ~/mac-panel-data-backup

# 3. 删除项目
sudo rm -rf /opt/mac-panel

# 4. 重新安装
git clone https://github.com/yourusername/mac-panel.git
cd mac-panel
sudo ./install.sh

# 5. 恢复数据
cp -r ~/mac-panel-data-backup/* /opt/mac-panel/backend/data/
```

---

**版本**: v2.8.1
**更新日期**: 2026-03-08
**维护**: Mac Panel Team
