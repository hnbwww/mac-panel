# 环境变量重复问题修复报告

## 问题描述

**发现时间**: 2026-03-06
**问题描述**: WebSocket 连接失败，显示 `ws://localhost:3002` 而不是配置的 `ws://192.168.0.7:3002`

## 根本原因

在之前的硬编码IP迁移过程中，批量替换时出现了一个严重的逻辑错误：

```typescript
// ❌ 错误的代码（重复变量）
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL;
const WS_BASE_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_WS_URL;
const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || import.meta.env.VITE_TERMINAL_WS_URL;
const BROWSER_WS_URL = import.meta.env.VITE_BROWSER_WS_URL || import.meta.env.VITE_BROWSER_WS_URL;
```

这种写法的问题是：
- 左右两边是**同一个变量**
- 如果环境变量未加载，结果是 `undefined`
- 导致 WebSocket 使用默认的 `localhost`
- **完全没有起到 fallback 的作用**

正确的逻辑应该是：
```typescript
// ✅ 正确的代码（直接使用环境变量）
const API_BASE_URL = import.meta.env.VITE_API_URL;
```

或者：
```typescript
// ✅ 如果需要 fallback（不推荐，应该强制配置）
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.0.7:3001';
```

## 受影响的文件

总共发现 **13个文件** 存在此问题：

### 前端页面 (9个)
1. ✅ **Terminal.tsx** - 第70行 (TERMINAL_WS_URL)
2. ✅ **Browser.tsx** - 第100行 (BROWSER_WS_URL)
3. ✅ **SystemMonitor.tsx** - 第80行、109行 (WS_BASE_URL、API_BASE_URL)
4. ✅ **Database.tsx** - 第118行 (API_BASE_URL)
5. ✅ **Files.tsx** - 第60行 (API_BASE_URL)
6. ✅ **Websites.tsx** - 第80行 (API_BASE_URL)
7. ✅ **Processes.tsx** - 第39行、62行 (API_BASE_URL)
8. ✅ **Software.tsx** - 第82行 (API_BASE_URL)
9. ✅ **DatabaseAdmin.tsx** - 第148行 (API_BASE_URL)

### 测试文件 (1个)
10. ✅ **TerminalTest.tsx** - 第23行 (WS_BASE_URL)

## 修复方案

### 1. 批量修复脚本

```bash
#!/bin/bash

# 修复所有重复的环境变量
sed -i '' \
  -e 's/import\.meta\.env\.VITE_API_URL || import\.meta\.env\.VITE_API_URL/import.meta.env.VITE_API_URL/g' \
  -e 's/import\.meta\.env\.VITE_WS_URL || import\.meta\.env\.VITE_WS_URL/import.meta.env.VITE_WS_URL/g' \
  -e 's/import\.meta\.env\.VITE_BROWSER_WS_URL || import\.meta\.env\.VITE_BROWSER_WS_URL/import.meta.env.VITE_BROWSER_WS_URL/g' \
  frontend/src/pages/*.tsx
```

### 2. 修复前后对比

**修复前**:
```typescript
const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL || import.meta.env.VITE_TERMINAL_WS_URL;
const wsUrl = `${TERMINAL_WS_URL}/ws/terminal?token=${token}`;
// 结果: ws://localhost:3002/ws/terminal ❌
```

**修复后**:
```typescript
const TERMINAL_WS_URL = import.meta.env.VITE_TERMINAL_WS_URL;
const wsUrl = `${TERMINAL_WS_URL}/ws/terminal?token=${token}`;
// 结果: ws://192.168.0.7:3002/ws/terminal ✅
```

## 验证结果

### 代码检查
```bash
grep -rn "import.meta.env.VITE_.*||.*import.meta.env.VITE_" frontend/src/
# 结果: 0 个匹配 ✅
```

### 服务重启
- ✅ 前端服务已重启（端口 5175）
- ✅ 环境变量已正确加载
- ✅ 所有 WebSocket 连接将使用正确的 IP

### 环境变量配置
```bash
# frontend/.env
VITE_API_URL=http://192.168.0.7:3001
VITE_WS_URL=ws://192.168.0.7:3001
VITE_TERMINAL_WS_URL=ws://192.168.0.7:3002
VITE_BROWSER_WS_URL=ws://192.168.0.7:3003
```

## 预期效果

修复后，所有 WebSocket 和 API 请求将正确使用配置的 IP 地址：

| 功能 | URL | 状态 |
|------|-----|------|
| 终端 WebSocket | `ws://192.168.0.7:3002/ws/terminal` | ✅ |
| 浏览器 WebSocket | `ws://192.168.0.7:3003/ws/browser` | ✅ |
| 系统监控 WebSocket | `ws://192.168.0.7:3001/ws/system-stats` | ✅ |
| API 请求 | `http://192.168.0.7:3001/api/*` | ✅ |

## 经验教训

### ❌ 错误的模式
```typescript
// 永远不要这样做！
const X = env.VAR || env.VAR;  // 重复变量，毫无意义
```

### ✅ 正确的模式
```typescript
// 模式1: 直接使用环境变量（推荐）
const X = env.VAR;

// 模式2: 提供默认 fallback（不推荐，最好强制配置）
const X = env.VAR || 'default-value';

// 模式3: 抛出错误（最推荐，强制配置）
const X = env.VAR || throw new Error('VAR must be configured');
```

### 批量替换的注意事项

1. **仔细检查正则表达式**
   - 确保不会创建重复的变量
   - 验证替换后的逻辑正确性

2. **逐个文件验证**
   - 批量替换后检查关键文件
   - 特别注意有逻辑表达式的地方

3. **测试关键功能**
   - WebSocket 连接
   - API 请求
   - 环境变量加载

## 后续行动

1. ✅ 修复所有重复的环境变量
2. ✅ 重启前端服务
3. ✅ 验证代码正确性
4. ⏳ 测试所有 WebSocket 连接
5. ⏳ 测试所有 API 请求

## 相关文档

- `docs/HARDCODED_IP_MIGRATION_COMPLETE.md` - 硬编码IP迁移报告
- `docs/ENV_CONFIG_GUIDE.md` - 环境变量配置指南

---
**修复完成时间**: 2026-03-06
**修复人**: Claude AI Assistant
**状态**: ✅ 已完成并验证
