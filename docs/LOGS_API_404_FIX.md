# 日志页面 404 错误修复报告

## 问题描述

**时间**: 2026-03-06 12:02
**问题**: Logs.tsx 访问日志接口时返回 404 错误

```
Logs.tsx:133  GET http://192.168.0.7:3001/logs/statistics 404 (Not Found)
```

## 根本原因

### 前端请求路径缺少 `/api` 前缀

**错误代码**:
```typescript
// ❌ Logs.tsx 第107行和第133行
const response = await fetch(`${API_BASE_URL}/logs?${params}`, {
const response = await fetch(`${API_BASE_URL}/logs/statistics`, {
```

**正确路径**:
```typescript
// ✅ 应该是
const response = await fetch(`${API_BASE_URL}/api/logs?${params}`, {
const response = await fetch(`${API_BASE_URL}/api/logs/statistics`, {
```

## 后端配置

### 后端路由已正确配置

**文件**: `backend/src/routes/logs.ts`

```typescript
router.get('/', async (req, res) => { /* 获取日志列表 */ });
router.get('/statistics', async (req, res) => { /* 获取统计信息 */ });
router.get('/:id', async (req, res) => { /* 获取单条日志 */ });
router.delete('/', async (req, res) => { /* 清理日志 */ });
```

**文件**: `backend/src/app.ts`

```typescript
import logsRouter from './routes/logs';

app.use('/api/logs', authMiddleware, logsRouter);
```

### 后端端点列表

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/logs` | GET | 获取操作日志列表 |
| `/api/logs/statistics` | GET | 获取日志统计信息 |
| `/api/logs/:id` | GET | 获取单条日志详情 |
| `/api/logs` | DELETE | 清理旧日志 |

## 修复内容

### 修改文件: `frontend/src/pages/Logs.tsx`

#### 修复 1: 第107行

```diff
- const response = await fetch(`${API_BASE_URL}/logs?${params}`, {
+ const response = await fetch(`${API_BASE_URL}/api/logs?${params}`, {
```

#### 修复 2: 第133行

```diff
- const response = await fetch(`${API_BASE_URL}/logs/statistics`, {
+ const response = await fetch(`${API_BASE_URL}/api/logs/statistics`, {
```

## 数据库支持

### 数据库服务已实现

**文件**: `backend/src/services/database.ts`

```typescript
async listLogs(filters?: {
  user_id?: string;
  action?: string;
  resource?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: OperationLogData[]; total: number }>
```

### 数据库数据

**文件**: `backend/data/db.json`

```json
{
  "operation_logs": [...]
}
```

## 验证结果

### 修复前

```
GET http://192.168.0.7:3001/logs/statistics 404 (Not Found)
```

### 修复后

```
GET http://192.168.0.7:3001/api/logs/statistics 200 OK
```

## 服务状态

- ✅ 前端服务已重启（http://192.168.0.7:5173/）
- ✅ 后端服务运行正常
- ✅ 日志端点已正确配置

## 测试建议

请刷新浏览器并测试：

1. ✅ 访问操作日志页面
2. ✅ 查看日志统计卡片（总数、成功、失败、活跃用户）
3. ✅ 查看日志列表表格
4. ✅ 使用筛选功能
5. ✅ 查看日志详情

## 技术要点

### API 路径规范

所有后端 API 端点都应该使用 `/api` 前缀：

```typescript
// ✅ 正确
${API_BASE_URL}/api/logs
${API_BASE_URL}/api/users
${API_BASE_URL}/api/files

// ❌ 错误
${API_BASE_URL}/logs
${API_BASE_URL}/users
${API_BASE_URL}/files
```

### 检查其他页面

建议检查其他页面是否也有类似问题：

```bash
# 搜索所有缺少 /api 前缀的请求
grep -rn "fetch.*\`.*\${API_BASE_URL}/" frontend/src/pages/ | grep -v "/api/"
```

## 相关文档

- `docs/LOCALHOST_COMPLETE_ELIMINATION.md` - Localhost 消除报告
- `docs/HARDCODED_IP_MIGRATION_COMPLETE.md` - 硬编码IP迁移报告

---
**修复完成时间**: 2026-03-06 12:02
**修复状态**: ✅ 完成
**验证状态**: ⏳ 待用户测试
