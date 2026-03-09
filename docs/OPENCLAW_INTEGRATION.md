# OpenClaw 集成指南

## 📋 概述

OpenClaw 已完全集成到 Mac Panel 的软件管理功能中。

## 🎯 功能特性

### 1. 软件管理界面

**位置**：Mac Panel → 软件管理 → 工具分类 → OpenClaw

**可用操作**：
- ✅ **修复**：一键修复 OpenClaw 配置问题
- ✅ **启动/停止/重启**：服务控制
- ✅ **查看状态**：实时状态监控
- ✅ **查看配置**：配置文件管理
- ✅ **查看日志**：日志查看

### 2. 修复功能

**用途**：
- 修复配置问题
- 修复权限问题
- 修复服务异常

**执行命令**：`openclaw doctor --fix`

**使用方法**：
1. 进入软件管理
2. 找到 OpenClaw
3. 点击"修复"按钮
4. 等待修复完成

### 3. 服务控制

**启动**：`openclaw start`
- 通过 launchctl 启动 OpenClaw Gateway

**停止**：`openclaw stop`
- 通过 launchctl 停止 OpenClaw Gateway

**重启**：`openclaw restart`
- 先停止再启动 OpenClaw Gateway

### 4. 健康检查

**API接口**：`GET /api/software/openclaw/health`

**检查项目**：
- ✅ 是否安装
- ✅ 进程是否运行
- ✅ 服务是否健康
- ✅ 配置文件是否存在
- ✅ 列出所有问题

**返回格式**：
```json
{
  "installed": true,
  "running": true,
  "healthy": true,
  "issues": []
}
```

## 🔧 命令对照表

| 面板操作 | 命令 | 说明 |
|---------|------|------|
| 安装 | `curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw/main/install.sh \| bash` | 一键安装 |
| 卸载 | `openclaw uninstall` | 完全卸载 |
| 启动 | `launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist` | 启动服务 |
| 停止 | `launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist` | 停止服务 |
| 重启 | `launchctl unload ... && launchctl load ...` | 重启服务 |
| 状态 | `openclaw status` | 查看状态 |
| 修复 | `openclaw doctor --fix` | 修复问题 |
| 版本 | `openclaw version` | 查看版本 |

## 📊 状态显示

| 状态 | 说明 |
|------|------|
| 🟢 运行中 | OpenClaw 进程正在运行 |
| 🔴 已停止 | OpenClaw 进程未运行 |
| ⚪ 未知 | 无法确定状态 |

## 🐛 故障排查

### 问题1：修复按钮不显示

**原因**：OpenClaw 未安装

**解决**：
1. 先安装 OpenClaw
2. 刷新软件列表

### 问题2：修复失败

**可能原因**：
- 权限不足
- 网络问题
- 配置文件损坏

**解决方法**：
1. 查看错误信息
2. 检查日志：`openclaw logs --follow`
3. 手动执行：`openclaw doctor --fix`

### 问题3：无法启动

**检查步骤**：
1. 确认已安装：`which openclaw`
2. 检查端口：`lsof -i :18789`
3. 查看日志：`tail -f ~/.openclaw/logs/gateway.log`

## 🔗 相关链接

- **Dashboard**: http://127.0.0.1:18789/
- **官方文档**: https://docs.openclaw.ai/
- **GitHub**: https://github.com/openclaw/openclaw

## 📝 配置文件

**主配置**：`~/.openclaw/config.json`

**LaunchAgent**：`~/Library/LaunchAgents/ai.openclaw.gateway.plist`

**日志目录**：`~/.openclaw/logs/`

**会话存储**：`~/.openclaw/agents/main/sessions/`

## 🎯 快速操作

### 修复 OpenClaw
```bash
# 方法1：在面板中
软件管理 → OpenClaw → 点击"修复"按钮

# 方法2：命令行
openclaw doctor --fix
```

### 重启 OpenClaw
```bash
# 方法1：在面板中
软件管理 → OpenClaw → 点击"重启"按钮

# 方法2：命令行
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist

# 方法3：使用 openclaw 命令
openclaw restart
```

### 查看状态
```bash
# 方法1：在面板中
软件管理 → 查看 OpenClaw 状态

# 方法2：命令行
openclaw status
```

---

**最后更新**：2026-03-07
**版本**：v1.0.0
