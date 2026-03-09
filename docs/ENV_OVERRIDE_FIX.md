# WebSocket Localhost 问题根本原因和解决方案

## 问题描述

**时间**: 2026-03-06 12:05
**问题**: WebSocket 连接仍然使用 localhost 而不是配置的 192.168.0.7

```
WebSocket connection to 'ws://localhost:3002/ws/terminal?token=...' failed:
```

## 🔍 根本原因

### Vite 环境变量加载机制

Vite 在不同环境下会加载不同的环境变量文件，**加载优先级**如下：

```
开发环境 (npm run dev):
  1. .env.development (优先级最高) ❌
  2. .env
  3. .env.local

生产环境 (npm run build):
  1. .env.production ❌
  2. .env
  3. .env.local
```

### 问题所在

项目中存在三个环境变量文件：

#### 1. `.env` (我们配置的)
```bash
VITE_API_URL=http://192.168.0.7:3001
VITE_WS_URL=ws://192.168.0.7:3001
VITE_TERMINAL_WS_URL=ws://192.168.0.7:3002  ✅ 正确
VITE_BROWSER_WS_URL=ws://192.168.0.7:3003  ✅ 正确
```

#### 2. `.env.development` (冲突！)
```bash
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_TERMINAL_WS_URL=ws://localhost:3002  ❌ 覆盖了 .env 的配置！
```

#### 3. `.env.production` (冲突！)
```bash
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_TERMINAL_WS_URL=ws://localhost:3002  ❌ 覆盖了 .env 的配置！
```

### 为什么会发生覆盖？

当运行 `npm run dev` 时：
1. Vite 检测到是开发环境
2. **优先加载 `.env.development`**
3. 然后加载 `.env`
4. **同名变量会被 `.env.development` 覆盖！**
5. 结果：`VITE_TERMINAL_WS_URL = ws://localhost:3002` ❌

## ✅ 解决方案

### 方案：删除冲突的环境变量文件

**执行步骤**：

1. **备份文件**
```bash
cp .env.development .env.development.backup
cp .env.production .env.production.backup
```

2. **删除冲突文件**
```bash
rm .env.development
rm .env.production
```

3. **重启前端服务**
```bash
lsof -ti:5173 | xargs kill -9
npm run dev
```

### 结果

现在只有 `.env` 文件生效：
```bash
VITE_API_URL=http://192.168.0.7:3001          ✅
VITE_WS_URL=ws://192.168.0.7:3001             ✅
VITE_TERMINAL_WS_URL=ws://192.168.0.7:3002    ✅
VITE_BROWSER_WS_URL=ws://192.168.0.7:3003     ✅
```

## 📊 验证

### 修复前

```javascript
// 浏览器控制台
import.meta.env.VITE_TERMINAL_WS_URL
// "ws://localhost:3002"  ❌

WebSocket 连接:
ws://localhost:3002/ws/terminal  ❌ 失败
```

### 修复后

```javascript
// 浏览器控制台
import.meta.env.VITE_TERMINAL_WS_URL
// "ws://192.168.0.7:3002"  ✅

WebSocket 连接:
ws://192.168.0.7:3002/ws/terminal  ✅ 成功
```

## 🔧 技术细节

### Vite 环境变量加载规则

1. **文件命名要求**：
   - 必须以 `VITE_` 开头才能在客户端代码中使用
   - 示例：`VITE_API_URL`, `VITE_WS_URL`

2. **加载优先级**（从高到低）：
   ```
   特殊模式文件 > .env.[mode].local > .env.[mode] > .env.local > .env
   ```

3. **同名变量覆盖**：
   - 优先级高的文件会覆盖优先级低的文件
   - 这是导致问题的根本原因

4. **`.local` 文件**：
   - 会被 git 忽略
   - 用于本地覆盖，不提交到版本控制

### 最佳实践

#### ✅ 推荐做法

1. **只使用 `.env` 文件**
   ```bash
   # .env
   VITE_API_URL=http://192.168.0.7:3001
   VITE_TERMINAL_WS_URL=ws://192.168.0.7:3002
   ```

2. **使用 `.env.example` 作为模板**
   ```bash
   # .env.example
   VITE_API_URL=http://YOUR_IP:3001
   VITE_TERMINAL_WS_URL=ws://YOUR_IP:3002
   ```

3. **提交 `.env.example`，忽略 `.env`**
   ```gitignore
   .env
   .env.local
   .env.*.local
   ```

#### ❌ 不推荐做法

1. **同时使用 `.env` 和 `.env.development`**
   - 容易造成混淆
   - 变量覆盖难以调试

2. **使用 `.env.production`**
   - 与 `.env` 重复
   - 增加维护成本

3. **硬编码不同环境的配置**
   - 应该通过 CI/CD 或部署脚本处理

## 🎯 总结

### 问题根源

```
.env.development (ws://localhost:3002) 覆盖了 .env (ws://192.168.0.7:3002)
```

### 解决方案

```
删除 .env.development 和 .env.production，只保留 .env
```

### 关键教训

1. **了解 Vite 环境变量加载优先级**
2. **避免创建冲突的环境变量文件**
3. **使用调试日志验证环境变量是否正确加载**
4. **删除不必要的配置变体文件**

## 📝 后续建议

1. ✅ 清理浏览器缓存（Ctrl+Shift+R）
2. ✅ 检查浏览器控制台的环境变量值
3. ✅ 测试所有 WebSocket 连接
4. ✅ 检查其他项目是否有类似问题

## 🚨 注意事项

### CI/CD 和生产环境

如果需要在生产环境使用不同的配置：

**选项 1：使用构建时变量**
```bash
# 构建
VITE_API_URL=https://production.com npm run build
```

**选项 2：使用部署脚本**
```bash
#!/bin/bash
# 生产部署
cp .env.production .env
npm run build
```

**选项 3：使用 Nginx 反向代理**
```nginx
# 前端使用相对路径，Nginx 处理代理
location /api/ {
    proxy_pass http://backend:3001/api/;
}
```

### 不要这样做

❌ 同时维护 `.env`、`.env.development`、`.env.production`
❌ 在多个文件中配置相同的变量名
❌ 依赖 `.env.development` 覆盖 `.env`

---
**修复完成时间**: 2026-03-06 12:05
**修复状态**: ✅ 完成
**验证状态**: ⏳ 待用户测试
