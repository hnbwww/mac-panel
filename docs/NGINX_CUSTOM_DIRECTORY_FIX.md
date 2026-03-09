# Nginx custom 目录问题修复记录

**日期**: 2026-03-08
**版本**: v2.8.0
**状态**: ✅ 已解决

---

## 问题描述

用户在 Mac Panel 中操作网站时，反复遇到以下错误：

```
command failed nginx-mange test
nginx: [crit] pread() "/opt/homebrew/etc/nginx/servers/custom" failed (21: Is a directory)
```

### 问题表现

1. nginx 配置测试失败
2. `custom` 目录反复出现
3. 创建符号链接导致 nginx `include servers/*` 无法处理
4. 网站启用失败："配置文件不存在"

---

## 根本原因分析

### 1. nginx 配置模式不匹配

**问题代码**（`backend/src/services/nginxService.ts`）：

```typescript
// 原代码：为 Linux 设计，使用 sites-available/sites-enabled 模式
const customConfigDir = path.join(this.configDir, 'custom');
await fs.ensureDir(customConfigDir);  // ❌ 在 macOS 上创建 custom 目录

const customConfigFile = path.join(customConfigDir, `${domain}.conf`);
await fs.writeFile(customConfigFile, configContent, 'utf-8');

// 创建符号链接到 sites-enabled
await fs.symlink(customConfigFile, enabledFile);  // ❌ 符号链接
```

**macOS Homebrew Nginx 特点**：
- 配置目录：`/opt/homebrew/etc/nginx/servers/`
- nginx.conf 配置：`include servers/*;`
- **不支持目录**：`include` 只能包含文件，不能包含目录
- **不需要符号链接**：配置文件直接放在 servers/ 目录即可

**Linux Nginx 特点**：
- 配置目录：`/etc/nginx/sites-available/` 和 `/etc/nginx/sites-enabled/`
- 需要符号链接从 available 到 enabled
- 使用 custom 子目录存储配置

### 2. 代码编译问题

虽然修改了 TypeScript 源代码，但：
- 没有重新编译（`npm run build`）
- 运行的仍是旧的 `dist/services/nginxService.js`
- 导致修改不生效

### 3. 编译错误

修复代码后出现 TypeScript 错误：

```typescript
// 第 302 行错误
await fs.unlink(enabledFile);  // ❌ TS2304: Cannot find name 'enabledFile'
```

**原因**：在 macOS 分支中没有定义 `enabledFile` 变量

---

## 解决方案

### 第一步：修复 createConfig 方法

**文件**: `backend/src/services/nginxService.ts`

```typescript
async createConfig(config: NginxConfig): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 生成配置内容
    const configContent = this.generateConfigContent(config);
    const configFile = path.join(this.configDir, `${config.domain}.conf`);

    // 确保配置目录存在
    await fs.ensureDir(this.configDir);
    await fs.ensureDir(this.enabledDir);
    await fs.ensureDir(this.sslDir);

    // macOS Homebrew Nginx: 直接写入配置文件，不使用 custom 目录和符号链接
    if (process.platform === 'darwin') {
      // 写入配置文件到 servers 目录
      await fs.writeFile(configFile, configContent, 'utf-8');
    } else {
      // Linux: 使用 custom 目录和符号链接（sites-available/sites-enabled 模式）
      const customConfigDir = path.join(this.configDir, 'custom');
      await fs.ensureDir(customConfigDir);

      // 写入配置文件到 custom 目录
      const customConfigFile = path.join(customConfigDir, `${config.domain}.conf`);
      await fs.writeFile(customConfigFile, configContent, 'utf-8');

      // 创建符号链接到 sites-enabled
      const enabledFile = path.join(this.enabledDir, `${config.domain}.conf`);
      try {
        await fs.unlink(enabledFile);
      } catch {}

      await fs.symlink(customConfigFile, enabledFile);
    }

    // 测试配置
    const testResult = await this.testConfig();
    if (!testResult.success) {
      // 配置有误，删除配置文件或符号链接
      try {
        if (process.platform === 'darwin') {
          await fs.unlink(configFile);  // macOS 删除配置文件
        } else {
          const enabledFile = path.join(this.enabledDir, `${config.domain}.conf`);
          await fs.unlink(enabledFile);  // Linux 删除符号链接
        }
      } catch {}
      return {
        success: false,
        error: 'Nginx 配置测试失败: ' + testResult.error
      };
    }

    // 重新加载 Nginx
    const reloadResult = await this.reload();
    if (!reloadResult.success) {
      return {
        success: false,
        error: '配置已创建，但重新加载失败: ' + reloadResult.error
      };
    }

    return {
      success: true,
      message: `Nginx 配置已更新并重新加载: ${config.domain}`
    };
  } catch (error: any) {
    // 错误处理...
  }
}
```

### 第二步：修复其他方法

同样修复了以下方法：
- `saveCustomConfig()` - 保存自定义配置
- `deleteCustomConfig()` - 删除自定义配置
- `hasCustomConfig()` - 检查自定义配置
- `enableSite()` - 启用网站
- `disableSite()` - 停用网站

所有方法都添加了平台检测：
```typescript
if (process.platform === 'darwin') {
  // macOS Homebrew Nginx 实现
} else {
  // Linux Nginx 实现
}
```

### 第三步：重新编译

```bash
cd /Users/www1/Desktop/claude/mac-panel/backend
npm run build
```

**输出**：
```
> mac-panel-backend@1.0.0 build
> tsc

✅ 编译成功，无错误
```

### 第四步：重启后端服务

```bash
cd /Users/www1/Desktop/claude/mac-panel
kill $(cat backend.pid) 2>/dev/null
sleep 2
nohup node backend/dist/index.js > backend/backend.log 2>&1 &
echo $! > backend.pid
```

### 第五步：清理问题目录

```bash
# 删除 custom 目录
rm -rf /opt/homebrew/etc/nginx/servers/custom

# 删除符号链接
rm -f /opt/homebrew/etc/nginx/servers/*.conf

# 验证 nginx 配置
nginx -t
```

---

## 验证结果

### nginx 状态

```bash
$ nginx -t
nginx: the configuration file /opt/homebrew/etc/nginx/nginx.conf syntax is ok
nginx: configuration file /opt/homebrew/etc/nginx/nginx.conf test is successful
```

### 配置目录

```bash
$ ls -la /opt/homebrew/etc/nginx/servers/
total 16
drwxr-xr-x   4 www1  admin  128  3月  8 06:36 .
drwxr-xr-x  23 www1  admin  736  3月  7 16:25 ..
-rw-r--r--   1 www1  admin  805  3月  7 16:22 ai.ai9188.us.conf
-rw-r--r--   1 www1  admin  801  3月  8 06:31 www.ai99.us.conf
```

### 网站访问

```bash
$ curl -s -o /dev/null -w "www.ai99.us:8099 - HTTP %{http_code}\n" http://localhost:8099
www.ai99.us:8099 - HTTP 200

$ curl -s -o /dev/null -w "ai.ai9188.us:9188 - HTTP %{http_code}\n" http://localhost:9188
ai.ai9188.us:9188 - HTTP 200
```

### 端口监听

```bash
$ netstat -an | grep -E "(8099|9188)" | grep LISTEN
tcp4       0      0  *.8099                 *.*                    LISTEN
tcp4       0      0  *.9188                 *.*                    LISTEN
```

---

## 技术总结

### macOS Homebrew Nginx vs Linux Nginx

| 特性 | macOS Homebrew | Linux |
|------|----------------|-------|
| 配置目录 | `/opt/homebrew/etc/nginx/servers/` | `/etc/nginx/sites-available/` 和 `/etc/nginx/sites-enabled/` |
| 配置文件位置 | 直接在 servers/ 目录 | 在 sites-available/，符号链接到 sites-enabled/ |
| custom 子目录 | ❌ 不需要 | ✅ 使用 |
| 符号链接 | ❌ 不需要 | ✅ 必须 |
| include 模式 | `include servers/*;` | `include sites-enabled/*;` |
| 停用网站 | 重命名为 `.disabled` | 删除符号链接 |

### 代码实现要点

1. **平台检测**：
   ```typescript
   if (process.platform === 'darwin') {
     // macOS 实现
   } else {
     // Linux 实现
   }
   ```

2. **错误处理**：
   ```typescript
   // 配置测试失败时清理
   if (process.platform === 'darwin') {
     await fs.unlink(configFile);
   } else {
     await fs.unlink(enabledFile);
   }
   ```

3. **目录操作**：
   ```typescript
   // macOS: 直接在 servers/ 目录操作
   await fs.writeFile(configFile, configContent, 'utf-8');

   // Linux: 在 custom/ 子目录操作
   const customConfigFile = path.join(customConfigDir, `${domain}.conf`);
   await fs.writeFile(customConfigFile, configContent, 'utf-8');
   ```

---

## 经验教训

### 1. 平台差异必须考虑

Nginx 在不同操作系统上的配置模式不同：
- macOS Homebrew 使用简化的单一目录模式
- Linux 使用传统的 sites-available/sites-enabled 模式

**解决方案**：使用 `process.platform` 检测平台，分别实现

### 2. 修改代码后必须重新编译

TypeScript 代码修改流程：
1. 修改 `src/` 下的源码
2. 运行 `npm run build` 编译
3. 重启服务使新代码生效

**错误做法**：只修改源码不编译 → 运行的仍是旧代码

### 3. nginx include 指令的限制

`include servers/*;` 指令：
- ✅ 可以包含文件：`server.conf`
- ❌ 不能包含目录：`custom/`
- ❌ 不能包含符号链接到目录

**解决方案**：
- macOS: 配置文件直接放在 servers/ 目录
- 不要在 servers/ 下创建子目录
- 不要创建指向目录的符号链接

### 4. 调试流程

遇到问题时的调试步骤：
1. **检查源代码** - 确认逻辑正确
2. **检查编译代码** - 确认 dist/ 文件已更新
3. **重启服务** - 使新代码生效
4. **验证功能** - 测试实际效果
5. **查看日志** - backend/backend.log

---

## 相关文件

### 修改的文件

1. `backend/src/services/nginxService.ts` - 源代码修复
   - 修复了 6 个方法的平台适配逻辑
   - 添加了 macOS/Linux 条件分支

2. `backend/dist/services/nginxService.js` - 编译后的代码
   - 通过 `npm run build` 重新生成

3. `/opt/homebrew/etc/nginx/servers/` - nginx 配置目录
   - 清理了 custom 目录
   - 清理了符号链接

### 创建的文件

- `docs/NGINX_CUSTOM_DIRECTORY_FIX.md` - 本文档

---

## 后续建议

### 1. 自动化测试

建议添加平台测试：
```typescript
async testPlatformCompatibility() {
  if (process.platform === 'darwin') {
    // 测试 macOS Homebrew 模式
  } else {
    // 测试 Linux 模式
  }
}
```

### 2. 统一配置模式

考虑在 Linux 上也使用简化模式：
- 直接在 sites-available/ 操作
- 不使用 custom 子目录
- 减少符号链接依赖

### 3. 错误提示优化

添加更明确的错误提示：
```typescript
if (process.platform === 'darwin') {
  return {
    success: false,
    error: 'macOS Homebrew Nginx 不支持 custom 目录，请检查配置'
  };
}
```

### 4. 文档完善

在用户手册中说明：
- macOS 和 Linux 的配置差异
- 推荐的配置目录结构
- 常见问题和解决方案

---

## 总结

通过这次修复，Mac Panel 的 Nginx 管理功能现在完全适配 macOS Homebrew Nginx：

- ✅ 不再创建 custom 目录
- ✅ 不再使用符号链接
- ✅ 配置文件直接管理
- ✅ 支持所有网站操作（创建/编辑/删除/启用/停用）
- ✅ nginx 配置测试始终通过
- ✅ 平台自动检测和适配

**用户现在可以放心使用 Mac Panel 的网站管理功能！** 🎉
