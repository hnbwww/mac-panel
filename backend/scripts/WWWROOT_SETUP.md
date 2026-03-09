# 网站根目录设置指南

## 问题

Mac Panel 需要在 `/www/wwwroot` 目录下创建网站。默认情况下，普通用户无法在 `/www` 目录下创建文件。

## 解决方案

### 方法 1：使用初始化脚本（推荐）

运行以下命令来初始化网站根目录：

```bash
cd /Users/www1/Desktop/claude/mac-panel/backend/scripts
sudo bash init-wwwroot.sh
```

脚本将自动：
- 创建 `/www/wwwroot` 目录
- 设置正确的权限 (755)
- 将目录所有者设置为当前用户

### 方法 2：手动创建目录

如果你想手动创建，运行以下命令：

```bash
# 创建目录
sudo mkdir -p /www/wwwroot

# 设置权限
sudo chmod 755 /www /www/wwwroot

# 设置所有者（将 YOUR_USERNAME 替换为你的用户名）
sudo chown -R YOUR_USERNAME:staff /www
```

### 方法 3：使用符号链接

如果你不想使用 `/www` 目录，可以创建符号链接到你的用户目录：

```bash
# 创建用户目录下的 wwwroot
mkdir -p ~/wwwroot

# 创建符号链接
sudo ln -s ~/wwwroot /www
```

## 验证

设置完成后，验证目录是否正确：

```bash
ls -la /www/
```

你应该看到：
```
drwxr-xr-x  3 YOUR_USERNAME  staff   96  ...  wwwroot
```

## 常见问题

### Q: 为什么需要 sudo？
A: `/www` 是系统根目录下的路径，需要管理员权限才能创建。

### Q: 网站可以创建在其他位置吗？
A: 可以！在创建网站时，你可以自定义根目录路径。

### Q: 如何修改默认路径？
A: 你可以在网站管理中手动指定任意路径，如 `~/sites/mywebsite`。

## 权限说明

- **755**: 所有者可读写执行，组和其他用户可读执行
- **staff**: macOS 上用户的默认组
- 这确保 Web 服务器（Nginx）可以读取网站文件

## 故障排除

如果创建网站时仍然遇到权限错误：

1. 检查目录权限：`ls -la /www/wwwroot`
2. 检查所有者：确保所有者是你的用户
3. 重新运行初始化脚本
4. 查看后端日志获取详细错误信息
