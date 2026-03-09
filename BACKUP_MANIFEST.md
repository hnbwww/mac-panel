# Mac Panel 备份清单

## 最新备份信息

**备份时间**: 2026-03-08 18:06:52

**备份文件**: 
- `mac-panel-complete-20260308180652.tar.gz` (6.1 MB)
- `AI_MEMORY-backup-20260308180650/` (AI记忆单独备份)

## 备份内容

### 包含目录
- ✅ `backend/` - 后端源代码
- ✅ `frontend/` - 前端源代码
- ✅ `AI_MEMORY/` - AI记忆系统
- ✅ `docs/` - 文档
- ✅ 配置文件
- ✅ 启动脚本

### 排除内容
- ❌ `node_modules/` - 依赖包
- ❌ `dist/` - 编译输出
- ❌ `.vite/` - Vite缓存
- ❌ `.git/` - Git仓库
- ❌ `backups/` - 旧备份
- ❌ `*.log` - 日志文件

## 功能清单

### 最新功能 (2026-03-08)

#### 文件权限设置 ✅
- **后端API**: 
  - GET /api/files/permissions - 获取权限
  - PUT /api/files/permissions - 修改权限
- **前端组件**: FileProperties.tsx
- **功能**: 
  - 查看/修改文件权限
  - 支持所有者/用户组/公共权限设置
  - 显示权限数值和符号表示

#### Nginx 配置修复 ✅
- 修复SSL配置生成逻辑
- 修复日志路径自适应
- 修复端口号正确包含
- 添加custom目录自动清理

### 核心功能模块

1. **用户管理** ✅
   - 用户CRUD操作
   - 角色和权限管理
   - 密码修改

2. **文件管理** ✅
   - 文件浏览、上传、下载
   - 编辑器支持
   - **权限设置** (新增)
   - 全局编辑器
   - 收藏功能

3. **网站管理** ✅
   - Nginx自动配置
   - 配置查看和编辑
   - SSL证书管理
   - 启用/停用控制

4. **Nginx管理** ✅
   - 状态监控
   - 服务控制
   - 配置测试和重载
   - 站点管理

5. **系统监控** ✅
   - 实时监控
   - 进程管理
   - 端口信息

6. **数据库管理** ⚠️
   - 支持多种数据库
   - 需要实现真实连接

## 恢复方法

### 完整恢复
```bash
cd /Users/www1/Desktop/claude
tar -xzf backups/mac-panel-complete-20260308180652.tar.gz
cd mac-panel
npm install
cd backend && npm install
cd frontend && npm install
```

### 恢复AI记忆
```bash
cp -r backups/AI_MEMORY-backup-YYYYMMDDHHMMSS/* mac-panel/AI_MEMORY/
```

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- lowdb (JSON数据库)
- JWT认证

### 前端  
- React 18
- TypeScript
- Vite
- Ant Design 5
- Monaco Editor

## 端口配置

- 前端: http://localhost:5173
- 后端: http://localhost:3001
- WebSocket系统: ws://localhost:3001/ws/system-stats
- WebSocket终端: ws://localhost:3002/ws/terminal
- WebSocket浏览器: ws://localhost:3003/ws/browser

## 已知问题

### 待修复
1. 终端node-pty权限问题（macOS）
2. 数据库管理真实连接
3. Nginx reload需要sudo免密配置

### 已解决 ✅
1. Nginx配置生成错误
2. Custom目录问题
3. SSL证书undefined错误
4. 日志路径适配

## 维护记录

### 2026-03-08 18:06
- ✅ 完整项目备份
- ✅ AI_MEMORY单独备份
- ✅ 添加文件权限设置功能
- ✅ 修复Nginx配置生成逻辑

### 2026-03-07
- Nginx自动配置完善
- 移动端表格优化
- 进程管理增强

### 下次备份建议
- **频率**: 每天至少一次
- **保留**: 最近7天的备份
- **异地**: 考虑云存储备份
