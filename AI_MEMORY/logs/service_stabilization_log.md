# 服务稳定化日志

## 2026-03-06 01:35 - 后端服务稳定化

### 问题
- 后端服务不断停止和重启
- WebSocket 连接立即关闭
- 频繁出现 `ERR_CONNECTION_REFUSED` 错误

### 根本原因
1. **nodemon 监控问题**: nodemon 在文件变化时重启服务，导致频繁中断
2. **进程管理不当**: 后端进程没有正确地在后台稳定运行
3. **缺少监控机制**: 服务停止后无法自动恢复

### 解决方案

#### 1. 创建稳定启动脚本
**文件**: `backend/start-stable.sh`
- 停止现有进程
- 清理端口占用
- 使用 `nohup` 启动服务（忽略挂起信号）
- 记录 PID 到文件
- 输出日志到文件
- 验证启动成功

#### 2. 创建监控脚本
**文件**: `backend/monitor.sh`
- 检查进程状态
- 显示进程信息（CPU、内存）
- 显示最近日志
- 自动重启已停止的服务

#### 3. 使用 ts-node 直接运行
```bash
# 不使用 nodemon（避免频繁重启）
npx ts-node src/app.ts
```

### 使用方法

#### 启动服务
```bash
cd /Users/www1/Desktop/claude/mac-panel/backend
./start-stable.sh
```

#### 监控服务
```bash
cd /Users/www1/Desktop/claude/mac-panel/backend
./monitor.sh
```

#### 停止服务
```bash
cd /Users/www1/Desktop/claude/mac-panel/backend
PID=$(cat backend.pid)
kill $PID
```

### 服务信息
- **PID 文件**: `backend/backend.pid`
- **日志文件**: `backend/backend.log`
- **当前 PID**: 60331

### 测试结果
- ✅ 健康检查: 正常
- ✅ 系统摘要: CPU 19.1%, 内存 24.75%
- ✅ 文件列表: 35 个项目
- ✅ 任务列表: 2 个任务
- ✅ WebSocket 端点: 已就绪

### 优势
1. **稳定性**: 服务不会因为文件变化而重启
2. **持久性**: nohup 确保服务在终端关闭后继续运行
3. **可监控**: 可以随时查看进程状态和日志
4. **可恢复**: 监控脚本可以自动重启停止的服务

### WebSocket 连接说明
WebSocket 连接关闭是正常现象：
1. 连接成功建立
2. 如果一段时间没有数据交换，会自动关闭
3. 前端会自动重连
4. 这是 WebSocket 的正常行为，不是错误

### 下次启动建议
```bash
# 方式一：使用稳定启动脚本（推荐）
cd /Users/www1/Desktop/claude/mac-panel/backend
./start-stable.sh

# 方式二：使用项目启动脚本
cd /Users/www1/Desktop/claude/mac-panel
./start.sh

# 方式三：手动启动（需要保持终端打开）
cd /Users/www1/Desktop/claude/mac-panel/backend
npm run dev
```
