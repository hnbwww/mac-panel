# Nginx 自动配置指南

## 📋 概述

本指南将帮助你配置 Mac Panel，使其能够自动管理 Nginx 配置，包括：
- ✅ 自动生成网站配置
- ✅ 支持自定义端口号（如9188）
- ✅ 自动测试配置语法
- ✅ 自动重新加载 Nginx
- ✅ 启用/停用网站

## 🔧 一键配置（推荐）

### 步骤 1：运行自动配置脚本

打开终端，执行以下命令：

```bash
cd /Users/www1/Desktop/claude/mac-panel
sudo ./setup-nginx-auto.sh
```

脚本将自动完成以下操作：
1. ✅ 修改 `/opt/homebrew/etc/nginx/servers` 目录权限
2. ✅ 修改 `/opt/homebrew/var/run/nginx.pid` 文件权限
3. ✅ 修改 `/opt/homebrew/var/log/nginx` 日志目录权限
4. ✅ 创建 `nginx-manage` 管理脚本
5. ✅ 测试并重新加载 Nginx

### 步骤 2：验证配置

```bash
# 检查配置目录权限
ls -la /opt/homebrew/etc/nginx/servers/

# 测试 Nginx 配置
sudo nginx -t

# 查看 Nginx 状态
brew services list | grep nginx
```

## 🎯 使用方法

### 创建网站（自动生成配置）

1. 在 Mac Panel 中访问「网站管理」
2. 点击「添加网站」
3. 填写信息：
   - **域名**：`ai.ai9188.us`
   - **类型**：静态网站
   - **端口**：`9188` ⚠️ 这里可以指定任意端口
   - **根目录**：`/Users/www1/www/wwwroot/ai.ai9188.us`
4. 点击「保存」

**配置将自动生成并重载 Nginx！**

### 生成的 Nginx 配置示例

```nginx
server {
    listen 0.0.0.0:9188;  # ✅ 使用你指定的端口
    server_name ai.ai9188.us;

    root /Users/www1/www/wwwroot/ai.ai9188.us;
    index index.html index.htm;

    access_log /opt/homebrew/var/log/nginx/ai.ai9188.us-access.log;
    error_log /opt/homebrew/var/log/nginx/ai.ai9188.us-error.log;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 禁止访问隐藏文件
    location ~ /\.ht {
        deny all;
    }

    # 缓存静态资源
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 测试访问

```bash
# 本地测试
curl http://localhost:9188

# 局域网测试
curl http://192.168.0.77:9188

# 浏览器访问
open http://localhost:9188
open http://192.168.0.77:9188
```

## 🔍 故障排查

### 问题 1：配置未生成

**检查开发模式设置**：
```bash
# 查看当前环境变量
cat backend/.env | grep NODE_ENV

# 应该显示：NODE_ENV=production
# 如果是 development，需要修改
```

**修改为生产模式**：
```bash
cd backend
vim .env
# 将 NODE_ENV=development 改为 NODE_ENV=production

# 重启后端服务
pm2 restart backend
# 或
npm run restart
```

### 问题 2：权限不足

**重新运行配置脚本**：
```bash
cd /Users/www1/Desktop/claude/mac-panel
sudo ./setup-nginx-auto.sh
```

**手动修复权限**：
```bash
# 修改 servers 目录权限
sudo chown -R $USER:admin /opt/homebrew/etc/nginx/servers/
sudo chmod 755 /opt/homebrew/etc/nginx/servers/

# 修改日志目录权限
sudo chown -R $USER:admin /opt/homebrew/var/log/nginx/

# 修改 PID 文件权限
sudo chown $USER:admin /opt/homebrew/var/run/nginx.pid
sudo chmod 644 /opt/homebrew/var/run/nginx.pid
```

### 问题 3：端口被占用

**检查端口占用**：
```bash
lsof -i :9188
```

**停止占用进程**：
```bash
kill -9 <PID>
```

### 问题 4：Nginx 配置测试失败

**查看错误信息**：
```bash
sudo nginx -t
```

**查看错误日志**：
```bash
tail -f /opt/homebrew/var/log/nginx/error.log
```

**查看网站错误日志**：
```bash
tail -f /opt/homebrew/var/log/nginx/ai.ai9188.us-error.log
```

## 📊 配置目录结构

```
/opt/homebrew/etc/nginx/
├── nginx.conf              # 主配置文件
├── mime.types              # MIME 类型定义
├── servers/                # 网站配置目录 ✅ 可写
│   ├── ai.ai9188.us.conf   # 网站1配置
│   ├── www.example.com.conf # 网站2配置
│   └── ...
└── ssl/                    # SSL 证书目录

/opt/homebrew/var/log/nginx/
├── access.log              # 全局访问日志
├── error.log               # 全局错误日志
├── ai.ai9188.us-access.log # 网站访问日志
└── ai.ai9188.us-error.log  # 网站错误日志
```

## 🎯 管理命令

### 使用 nginx-manage 脚本

```bash
# 测试配置
nginx-manage test

# 重新加载
nginx-manage reload

# 重启服务
nginx-manage restart

# 启动服务
nginx-manage start

# 停止服务
nginx-manage stop
```

### 直接使用 nginx 命令

```bash
# 测试配置
sudo nginx -t

# 重新加载
sudo nginx -s reload

# 停止
sudo nginx -s stop

# 退出
sudo nginx -s quit
```

### 使用 Homebrew 服务管理

```bash
# 启动
brew services start nginx

# 停止
brew services stop nginx

# 重启
brew services restart nginx

# 查看状态
brew services list | grep nginx
```

## 🔐 安全建议

1. **文件权限**
   - 配置文件：`644` (rw-r--r--)
   - SSL 私钥：`600` (rw-------)
   - 目录：`755` (rwxr-xr-x)

2. **访问控制**
   - 只开放必要的端口
   - 使用防火墙限制访问
   - 定期更新 Nginx 版本

3. **日志监控**
   - 定期检查错误日志
   - 监控访问日志异常
   - 设置日志轮转

## 📚 相关文档

- [Nginx 官方文档](http://nginx.org/en/docs/)
- [Homebrew Nginx](https://formulae.brew.sh/formula/nginx)
- [Mac Panel 使用指南](./README.md)

## 🆘 获取帮助

如果遇到问题：

1. 查看 Nginx 错误日志
2. 查看 Mac Panel 后端日志：`backend/backend.log`
3. 查看浏览器控制台错误
4. 提交 Issue：[GitHub Issues](https://github.com/your-repo/issues)

---

**最后更新**：2026-03-07
**版本**：v1.0.0
