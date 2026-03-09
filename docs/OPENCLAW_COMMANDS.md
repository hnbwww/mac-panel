# OpenClaw 重启命令说明

## 🎯 正确的重启方法

OpenClaw 使用 macOS LaunchAgent 管理，没有内置的 restart 命令。

### 方法1：手动重启（推荐）

```bash
# 1. 停止服务
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist

# 2. 启动服务  
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

### 方法2：一键重启脚本

```bash
# 创建重启脚本
cat > /usr/local/bin/openclaw-restart << 'SCRIPT'
#!/bin/bash
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>/dev/null
sleep 1
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist
echo "✅ OpenClaw 已重启"
SCRIPT

chmod +x /usr/local/bin/openclaw-restart

# 使用
openclaw-restart
```

### 方法3：在 Mac Panel 中

```
软件管理 → OpenClaw → 点击"重启"按钮
```

面板会自动执行正确的 launchctl 命令。

## 📋 所有可用命令

### 启动
```bash
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

### 停止
```bash
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

### 重启
```bash
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist && \
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

### 状态
```bash
openclaw status
# 或
launchctl list | grep openclaw
```

## ⚠️ 注意事项

1. **没有 openclaw restart 命令**
   - 不要使用 `openclaw restart`
   - 该命令不存在，会报错

2. **必须使用 launchctl**
   - OpenClaw 通过 LaunchAgent 管理
   - 使用 launchctl 控制服务生命周期

3. **权限要求**
   - launchctl 不需要 sudo
   - 用户级别的 LaunchAgent

## 🔧 配置文件位置

- **LaunchAgent**: `~/Library/LaunchAgents/ai.openclaw.gateway.plist`
- **配置文件**: `~/.openclaw/config.json`
- **日志文件**: `~/.openclaw/logs/gateway.log`
- **PID文件**: 自动管理
