# Nginx 局域网访问配置指南

## 问题描述
- Nginx 修改配置时提示"需要管理员权限"
- 网站无法通过局域网 IP (192.168.0.77) 访问

## 解决方案

### 第一步：运行 Nginx 初始化脚本

此脚本会创建必要的目录并设置正确的权限：

```bash
cd /Users/www1/Desktop/claude/mac-panel
sudo ./setup-nginx.sh
```

脚本会自动完成：
- ✅ 创建 SSL 证书目录
- ✅ 创建自定义配置目录
- ✅ 设置正确的目录权限
- ✅ 检查 Nginx 主配置

### 第二步：验证配置

```bash
# 检查 Nginx 配置是否正确
sudo nginx -t

# 如果配置测试通过，重新加载 Nginx
sudo nginx -s reload
# 或使用 brew services
brew services reload nginx
```

### 第三步：测试局域网访问

1. **在服务器上测试**：
```bash
curl http://192.168.0.77:8080
# 或
curl http://localhost:8080
```

2. **在局域网其他设备上测试**：
   - 手机/电脑浏览器访问：`http://192.168.0.77:8080`
   - 或使用您的域名

### 第四步：防火墙配置

确保防火墙允许 80 和 443 端口访问：

```bash
# macOS 查看防火墙状态
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 如果防火墙开启，需要允许 Nginx 接受入站连接
# 系统偏好设置 -> 安全性与隐私 -> 防火墙 -> 防火墙选项
# 添加 nginx 或允许入站连接
```

### 第五步：验证网站配置

在 Mac Panel 的 Nginx 管理页面检查：

1. **查看站点配置**：
   - 访问 http://192.168.0.77:5173/nginx
   - 查看站点列表
   - 点击"查看配置"检查配置内容

2. **确认配置正确**：
   ```nginx
   server {
       listen 0.0.0.0:80;  # 确保监听所有接口
       server_name your-domain.com;
       ...
   }
   ```

3. **启用站点**：
   - 确保站点开关为"启用"状态
   - 如果未启用，点击开关启用站点

## 常见问题

### 1. 端口 80 被占用

**问题**：Nginx 默认监听 8080 端口而不是 80 端口

**解决**：修改 Nginx 主配置文件

```bash
sudo nano /opt/homebrew/etc/nginx/nginx.conf
```

找到并修改：
```nginx
listen 8080;
```
改为：
```nginx
listen 80;
```

然后重启 Nginx：
```bash
brew services restart nginx
```

### 2. 权限不足

**问题**：保存配置时提示"需要管理员权限"

**解决**：
```bash
# 确保 servers 目录属于当前用户
sudo chown -R $(whoami):admin /opt/homebrew/etc/nginx/servers

# 确保 ssl 目录存在且有正确权限
sudo mkdir -p /opt/homebrew/etc/nginx/ssl
sudo chown -R $(whoami):admin /opt/homebrew/etc/nginx/ssl
```

### 3. 仍然无法访问

**检查清单**：
- [ ] Nginx 服务是否运行：`ps aux | grep nginx`
- [ ] 端口是否监听：`netstat -an | grep :80`
- [ ] 防火墙是否允许：系统偏好设置检查
- [ ] 网站配置是否启用：Mac Panel 检查
- [ ] 网站根目录是否存在：`ls -la /path/to/root`
- [ ] 日志是否有错误：`tail -f /var/log/nginx/error.log`

### 4. macOS Homebrew Nginx 特殊配置

Homebrew Nginx 配置文件位置：
- 主配置：`/opt/homebrew/etc/nginx/nginx.conf`
- 站点配置：`/opt/homebrew/etc/nginx/servers/`
- SSL 证书：`/opt/homebrew/etc/nginx/ssl/`
- 日志文件：`/var/log/nginx/`

## 技术细节

### 监听地址说明

修改前（只监听本地）：
```nginx
listen 80;
```

修改后（监听所有接口）：
```nginx
listen 0.0.0.0:80;
```

这样配置后，Nginx 会监听所有网络接口，包括：
- 127.0.0.1 (本地回环)
- 192.168.0.77 (局域网 IP)
- 其他任何网络接口

### 系统服务管理

**macOS (Homebrew)**：
```bash
# 启动
brew services start nginx

# 停止
brew services stop nginx

# 重启
brew services restart nginx

# 查看状态
brew services list
```

**Linux (systemctl)**：
```bash
# 启动
sudo systemctl start nginx

# 停止
sudo systemctl stop nginx

# 重启
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx
```

## 开发环境说明

当前系统配置为：
- 前端：http://192.168.0.77:5173
- 后端：http://192.168.0.77:3001
- Nginx：http://192.168.0.77:80 (或 8080)

在开发模式下，Nginx 配置操作会被跳过，但仍会生成配置文件供参考。

## 联系支持

如果以上步骤无法解决问题，请提供以下信息：
1. Nginx 版本：`nginx -v`
2. 错误日志：`tail -50 /var/log/nginx/error.log`
3. 系统版本：`sw_vers`
4. 网络配置：`ifconfig | grep inet`
