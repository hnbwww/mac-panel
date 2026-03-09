# Nginx Custom 目录问题修复说明

## 问题描述

**错误信息**：
```
nginx: [crit] pread() "/opt/homebrew/etc/nginx/servers/custom" failed (21: Is a directory)
nginx: configuration file /opt/homebrew/etc/nginx/nginx.conf test failed
```

**原因**：
- macOS Homebrew Nginx 配置目录中出现了 `custom` 子目录
- `nginx include servers/*` 会尝试读取所有文件和目录
- 遇到目录时会报错 "Is a directory"

**macOS vs Linux 差异**：
- **macOS Homebrew Nginx**: 配置文件直接放在 `servers/` 目录，不使用 custom 目录
- **Linux Nginx**: 使用 `sites-available/` 和 `sites-enabled/` 目录，配合符号链接

## 问题来源

可能的原因：
1. **历史遗留代码**: 旧版本代码在 macOS 上错误创建了 custom 目录
2. **手动操作**: 用户手动创建或复制了 Linux 风格的配置结构
3. **配置同步**: 从 Linux 系统同步配置到 macOS

## 修复方案

### 1. 代码修复（已完成）

已修改 `backend/src/services/nginxService.ts`，在两个方法中添加自动清理逻辑：

**`createConfig()` 方法**：
```typescript
if (process.platform === 'darwin') {
  // 清理可能存在的旧 custom 目录（历史遗留）
  const customConfigDir = path.join(this.configDir, 'custom');
  try {
    await fs.remove(customConfigDir);
    console.log(`[NginxService] 已清理历史遗留的 custom 目录`);
  } catch (error) {
    // 目录不存在或无法删除，忽略
  }
  // 写入配置文件...
}
```

**`saveCustomConfig()` 方法**：同样的清理逻辑

### 2. 手动修复脚本

提供了两个脚本：

#### 检查脚本 `check-nginx-structure.sh`
```bash
./check-nginx-structure.sh
```

功能：
- 检查是否存在 custom 目录
- 检查符号链接
- 检查备份文件
- 测试 nginx 配置

#### 修复脚本 `fix-nginx-custom-dir-final.sh`
```bash
./fix-nginx-custom-dir-final.sh
```

功能：
- 删除 custom 目录
- 删除指向 custom 的符号链接
- 删除 .bak 备份文件
- 测试 nginx 配置
- 重新加载 nginx

### 3. 执行修复

**立即修复**：
```bash
cd /Users/www1/Desktop/claude/mac-panel
sudo ./fix-nginx-custom-dir-final.sh
```

**验证修复**：
```bash
./check-nginx-structure.sh
```

## 预防措施

### 已实施的防护

1. **代码层面**：
   - `createConfig()` 和 `saveCustomConfig()` 在 macOS 上自动清理 custom 目录
   - 确保每次创建配置时都检查并清理

2. **脚本层面**：
   - 提供检查脚本，定期检查目录结构
   - 提供修复脚本，一键清理问题

### 最佳实践

1. **备份配置**：
   - nginx 配置备份应存放在其他位置（如 `~/backups/nginx/`）
   - 不应放在 nginx 配置目录内

2. **编辑配置**：
   - 使用 Mac Panel 的 Nginx 管理页面编辑配置
   - 避免手动创建 custom 目录或符号链接

3. **跨平台注意**：
   - macOS 和 Linux 的 nginx 配置结构不同
   - 不要直接复制配置文件或目录结构

## 技术细节

### macOS Homebrew Nginx 配置结构

```
/opt/homebrew/etc/nginx/
├── nginx.conf              # 主配置文件
├── servers/                # 网站配置目录
│   ├── site1.conf         # 网站1配置
│   ├── site2.conf         # 网站2配置
│   └── site3.conf.disabled # 停用的网站
└── ssl/                    # SSL 证书目录
    ├── domain1/
    │   ├── cert.pem
    │   └── key.pem
    └── domain2/
        ├── cert.pem
        └── key.pem
```

### Linux Nginx 配置结构

```
/etc/nginx/
├── nginx.conf
├── sites-available/        # 可用站点
│   ├── site1.conf
│   ├── site2.conf
│   └── custom/            # 自定义配置子目录
│       └── site3.conf
└── sites-enabled/         # 已启用站点（符号链接）
    ├── site1.conf -> ../sites-available/site1.conf
    └── site2.conf -> ../sites-available/site2.conf
```

## 相关文件

- `backend/src/services/nginxService.ts` - Nginx 服务（已修复）
- `backend/src/routes/nginx.ts` - Nginx 路由
- `fix-nginx-custom-dir-final.sh` - 修复脚本
- `check-nginx-structure.sh` - 检查脚本
- `frontend/src/pages/NginxManagement.tsx` - Nginx 管理页面

## 总结

这个问题是由于 macOS 上出现了 Linux 风格的配置结构导致的。通过：
1. 修改代码自动清理历史遗留的 custom 目录
2. 提供手动修复和检查脚本
3. 添加文档说明最佳实践

可以彻底解决这个问题并防止再次发生。
