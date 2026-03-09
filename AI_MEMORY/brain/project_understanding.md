# Mac Panel 项目架构理解

## 项目概述
Mac Panel 是一个类似宝塔面板的服务器管理系统，使用 React + TypeScript + Express 构建。

## 技术栈

### 后端
- **框架**: Express + TypeScript
- **数据库**: lowdb (JSON 文件数据库)
- **认证**: JWT + bcrypt
- **系统信息**: systeminformation
- **终端**: node-pty
- **WebSocket**: ws
- **定时任务**: node-cron

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **UI库**: Ant Design 5.x
- **图表**: @ant-design/charts
- **终端**: xterm.js
- **状态管理**: Zustand
- **路由**: React Router

## 项目结构

```
mac-panel/
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── routes/         # API路由
│   │   ├── services/       # 业务逻辑
│   │   ├── middlewares/    # 中间件
│   │   └── app.ts          # 应用入口
│   ├── data/               # 数据库文件
│   │   └── db.json         # lowdb数据文件
│   └── package.json
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # 通用组件
│   │   ├── store/         # 状态管理
│   │   └── config/        # 配置文件
│   └── package.json
├── docs/                   # 文档
├── AI_MEMORY/             # AI记忆系统
└── start.sh              # 启动脚本
```

## 核心功能模块

### 1. 认证和权限系统
- JWT token 认证
- 基于角色的权限控制（RBAC）
- 三种角色：admin（管理员）、user（普通用户）、viewer（只读用户）
- 审计日志记录

### 2. 用户管理（2026-03-06 新增）
- **路由**: `/api/users`
- **功能**:
  - GET `/api/users` - 获取所有用户
  - POST `/api/users` - 创建用户
  - PUT `/api/users/:id` - 更新用户
  - DELETE `/api/users/:id` - 删除用户
  - POST `/api/users/:id/reset-password` - 重置密码
  - GET `/api/users/roles/all` - 获取所有角色
- **前端页面**: `/users` - 用户管理界面
- **特性**:
  - 用户列表展示（表格）
  - 添加/编辑用户
  - 删除用户（带二次确认）
  - 重置用户密码
  - 用户状态管理（启用/禁用）
  - 角色分配
  - 统计卡片（总用户数、启用用户、禁用用户）
- **修改密码**: 用户头像下拉菜单中的"修改密码"选项
  - 需要验证旧密码
  - 新密码至少6个字符
  - 修改成功后强制重新登录

### 3. 文件管理
- 文件浏览、上传、下载
- 文件编辑、删除、重命名
- 权限管理
- 压缩/解压
- 全局编辑器（2026-03-06 新增）
  - 复用 Editor.tsx 组件
  - 支持 globalMode 模式
  - 可最小化到浮动按钮
  - 支持多文件编辑
  - 跨页面持久化
  - GlobalEditorContext 状态管理

### 4. 终端管理
- 多标签页支持
- node-pty 伪终端
- 支持 zsh/bash/fish
- WebSocket 实时通信

### 5. 系统监控
- CPU、内存、磁盘、网络实时监控
- 进程列表管理（2026-03-07 增强）
  - 进程 PID、名称、用户、状态
  - CPU 和内存使用率
  - **端口信息显示**（使用 lsof 获取监听端口）
  - **完整命令行路径**（使用 ps 获取完整命令）
  - 进程排序（按 CPU/内存）
  - 进程搜索（名称/命令/路径）
  - 进程终止功能
  - 统计卡片（总进程数、高CPU/高内存进程）
- 图表可视化
- WebSocket 实时推送

### 6. 数据库管理
- 支持 MySQL、PostgreSQL、MongoDB、Redis
- SQL 查询执行
- 表数据浏览
- 数据编辑

### 7. 网站管理
- 静态网站托管
- 反向代理配置
- SSL 证书管理
- **Nginx 自动配置（2026-03-07 增强）**
  - 创建网站时自动生成 Nginx 配置
  - 更新网站时自动重新生成配置
  - 删除网站时自动删除配置
  - SSL 配置时自动更新 Nginx
  - 配置测试和平滑重载
  - 开发环境自动跳过 Nginx 配置
  - **网站配置查看和编辑（2026-03-07 新增）**
    - 每个网站显示当前 Nginx 配置
    - 支持查看、编辑、恢复默认配置
    - 配置测试和自动重载
    - 开发环境跳过实际 Nginx 操作
  - **网站启用/停用控制（2026-03-07 新增）**
    - Switch 开关控制网站启用状态
    - 站点列表显示配置状态（未配置/已配置未启用/已启用）
    - 启用/停用操作实时反馈
  - **UI 样式统一（2026-03-07 完善）**
    - 域名列：图标 + 链接（可点击）
    - 类型列：彩色 Tag 标签
    - 路径列：图标 + 省略显示
    - 端口列：纯文本
    - SSL 列：Tag + 图标
    - 操作列：文字按钮（配置/编辑/SSL）

### 8. 软件管理
- 支持 12 种软件安装
- Nginx、MySQL、Redis、MongoDB 等

### 9. 任务中心
- 定时任务配置（Cron 表达式）
- 任务执行历史
- 告警通知

### 10. 浏览器管理
- CDP 远程控制
- 实时画面流
- Tab 管理

### 11. 仪表盘（2026-03-06 完善）
- 真实系统信息显示
  - CPU 使用率
  - 内存使用率
  - 磁盘使用率
  - 系统运行时间
  - 主机名、操作系统、架构
  - CPU 型号和核心数
  - 总内存容量
- 快捷操作宫格设计
  - 6 个宫格，独特渐变色
  - 大图标 + 文字标签
  - 悬停效果和平滑动画
- 服务管理功能
  - 实时监控前后端服务状态
  - 重启所有/单独重启按钮
  - 重启确认对话框
- 响应式设计
  - 手机版（≤768px）：单列布局
  - 平板版（769px-1024px）：2列布局
  - 电脑版（≥1025px）：3列布局

### 12. 操作日志
- 完整的审计日志
- 用户操作记录
- 登录失败记录
- 日志查询和筛选

## 路径自适应设计（重要）

### 后端动态路径
```typescript
const projectRoot = path.resolve(__dirname, '../..');
const pidFile = path.join(projectRoot, 'backend.pid');
const logFile = path.join(projectRoot, 'backend/backend.log');
```

### 前端智能 API 地址获取
```typescript
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;  // 环境变量优先
  }
  if (import.meta.env.PROD) {
    return window.location.origin;  // 生产环境使用相对路径
  }
  return 'http://localhost:3001';  // 开发环境默认
};
```

### 特点
- 支持任意部署目录
- 支持任意操作系统（macOS/Linux/Windows）
- 环境自适应（开发/生产/测试）

## 数据库结构

### db.json 结构
```json
{
  "users": [],        // 用户数据
  "roles": [],        // 角色数据
  "operation_logs": [],  // 操作日志
  "scheduled_tasks": [],  // 定时任务
  "task_executions": [],  // 任务执行记录
  "notifications": [],    // 通知
  "websites": [],      // 网站配置
  "databases": [],     // 数据库连接配置
  "settings": {}       // 系统设置
}
```

### 默认账户
- **用户名**: admin
- **密码**: admin123
- **角色**: 管理员（所有权限）

## 服务端口配置

### 开发环境
- **前端**: http://localhost:5173 (Vite)
- **后端**: http://localhost:3001 (Express)
- **WebSocket系统监控**: ws://localhost:3001/ws/system-stats
- **WebSocket终端**: ws://localhost:3002/ws/terminal
- **WebSocket浏览器**: ws://localhost:3003/ws/browser

### 生产环境
- 使用环境变量 `VITE_API_URL` 和 `VITE_WS_URL`
- 使用 Nginx 反向代理（推荐）

## 网络配置（公网访问）

### 当前局域网配置
- **服务IP**: 192.168.0.77
- **前端**: http://192.168.0.77:5173
- **后端**: http://192.168.0.77:3001
- **WebSocket**: ws://192.168.0.77:3001

### 环境变量配置
1. 前端 `frontend/.env`:
```bash
VITE_API_URL=http://192.168.0.77:3001
VITE_WS_URL=ws://192.168.0.77:3001
VITE_TERMINAL_WS_URL=ws://192.168.0.77:3002
VITE_BROWSER_WS_URL=ws://192.168.0.77:3003
```

2. 后端 `backend/.env`:
```bash
PORT=3001
JWT_SECRET=your-strong-secret-key
NODE_ENV=production
ALLOWED_HOSTS=localhost,127.0.0.1,192.168.0.77
```

### Nginx 反向代理（推荐生产环境）
- 统一 80/443 端口访问
- 启用 HTTPS
- WebSocket 代理配置
- 详见 `docs/NETWORK_CONFIGURATION.md`

## 关键文件说明

### 后端核心文件
1. `backend/src/app.ts` - 应用入口，路由注册
2. `backend/src/routes/auth.ts` - 认证路由
3. `backend/src/routes/users.ts` - 用户管理路由
4. `backend/src/routes/system.ts` - 系统信息和监控
5. `backend/src/routes/nginx.ts` - Nginx 管理路由（2026-03-07 新增）
6. `backend/src/services/database.ts` - 数据库服务
7. `backend/src/services/systemInfoService.ts` - 系统信息服务
8. `backend/src/services/nginxService.ts` - Nginx 管理服务（2026-03-07 新增）
9. `backend/src/services/websiteService.ts` - 网站管理服务（已更新）

### 前端核心文件
1. `frontend/src/App.tsx` - 应用入口，路由配置
2. `frontend/src/components/Layout.tsx` - 主布局，侧边栏菜单
3. `frontend/src/pages/Dashboard.tsx` - 仪表盘页面
4. `frontend/src/pages/Users.tsx` - 用户管理页面
5. `frontend/src/pages/NginxManagement.tsx` - Nginx 管理页面（2026-03-07 新增）
   - Nginx 状态监控（运行状态、版本、PID、站点数）
   - 服务控制（启动、停止、重启、重载、测试）
   - 站点列表（域名、类型、端口、SSL、配置状态、根目录）
   - 站点启用/停用 Switch 控制
   - 配置查看和编辑（支持自定义配置和恢复默认）
   - 自动刷新（每5秒）
   - 操作确认对话框
   - 使用说明文档
   - **移动端优化（2026-03-07 15:45）**
     - 表格水平滚动支持 (`scroll={{ x: 'max-content' }}`)
     - 移动端隐藏"启用状态"和"操作"列 (`responsive: ['md', 'lg', 'xl', 'xxl']`)
     - 响应式断点：<768px 隐藏非必要列
6. `frontend/src/pages/Websites.tsx` - 网站管理页面（2026-03-07 增强）
   - 网站列表展示（域名、类型、端口、SSL、路径）
   - 网站启用/停用 Switch 控制
   - Nginx 配置查看和编辑
   - **移动端优化（2026-03-07 15:45）**
     - 移动端隐藏"启用状态"和"操作"列
     - 与 Nginx 管理页面保持一致的响应式体验
   - 添加/编辑/删除网站
   - SSL 证书配置
   - UI 样式与 Nginx 管理页面统一
7. `frontend/src/store/index.ts` - Zustand 状态管理
8. `frontend/src/config/index.ts` - API 配置

## 重要文档

1. `docs/MAC_DEPLOYMENT_GUIDE.md` - Mac 部署完整指南
2. `docs/NETWORK_CONFIGURATION.md` - 网络配置指南（公网访问）
3. `docs/adaptive-paths.md` - 路径自适应详细说明

## 最新更新（2026-03-07 14:58）

### 项目备份完成 ✅
- ✅ 完整项目备份: mac-panel-backup-all-20260307_145739.tar.gz (938 MB)
  - 排除 node_modules, .git, dist, .vite
  - 包含所有源代码、配置、AI_MEMORY
- ✅ AI_MEMORY 单独备份: AI_MEMORY-backup-20260307_145754/
- ✅ 备份清单文档: BACKUP_MANIFEST.md
- ✅ 备份位置: ~/Desktop/claude/

## 最新更新（2026-03-07 16:00）

### Nginx 端口配置修复和自动化 ✅
**问题修复**:
- ✅ nginx配置生成时端口被忽略（写死80端口）
  - 修改 `generateStaticConfig`、`generatePHPConfig`、`generateJavaConfig`、`generateProxyConfig`
  - 所有配置现在使用 `config.port` 参数
  - 支持自定义端口号（如9188）
- ✅ 开发模式跳过nginx配置问题
  - 后端环境变量从 development 改为 production
  - 配置文件现在可以正常生成
- ✅ 权限问题解决方案
  - 创建 `setup-nginx-auto.sh` 自动配置脚本
  - 创建 `nginx-manage` 管理脚本
  - 前端添加权限配置提示

**新增文件**:
- ✅ `setup-nginx-auto.sh` - 一键配置nginx权限脚本
- ✅ `NGINX_AUTO_SETUP.md` - 完整配置和使用文档

**修改文件**:
- `backend/src/services/nginxService.ts` - 支持自定义端口
  - 所有 `listen 0.0.0.0:80` 改为 `listen 0.0.0.0:${config.port}`
  - `reload()` 方法支持开发模式检测
  - `testConfig()` 方法支持管理脚本
- `backend/.env` - NODE_ENV 改为 production
- `frontend/src/pages/NginxManagement.tsx` - 添加权限配置提示

**功能特性**:
- ✅ 网站创建时自动生成nginx配置
- ✅ 支持任意端口号（不再是写死的80/443）
- ✅ 配置测试和平滑重载
- ✅ 权限自动配置脚本
- ✅ 完整的故障排查文档

**技术实现**:
- nginx配置模板动态化（使用变量而非硬编码）
- 权限管理脚本（一键设置可写权限）
- 开发/生产环境分离
- 配置验证和错误处理

## 最新更新（2026-03-08）

### 软件管理 - Claude Code 支持 ✅
**新增功能**:
- ✅ 添加 Claude Code 到软件列表
- ✅ npm 全局安装支持
- ✅ 自动状态检测和版本识别
- ✅ 一键安装/卸载功能

**技术实现**:
- 软件定义：claude-code
- 安装命令：`npm install -g @anthropic-ai/claude-code`
- 卸载命令：`npm uninstall -g @anthropic-ai/claude-code`
- 状态检测：`npm list -g` + `claude --version`
- 分类：工具类

**修改文件**:
- ✅ `backend/src/services/softwareService.ts` - 添加 Claude Code 支持和状态检测

## 最新更新（2026-03-08）

### 安装脚本优化 ✅
**优化内容**:
- ✅ 配置变量统一放在文件开头
  - PANEL_USER - 用户名（支持命令行参数）
  - PROJECT_DIR - 安装目录
  - BACKEND_PORT - 后端端口
  - FRONTEND_PORT - 前端端口
- ✅ 支持命令行参数指定用户名
  - `sudo ./install.sh` - 使用默认用户名 macpanel
  - `sudo ./install.sh myuser` - 使用自定义用户名
- ✅ 所有硬编码用户名替换为变量引用
- ✅ 安装时显示配置信息
- ✅ 完成信息包含配置详情

**使用示例**:
```bash
# 使用默认配置
sudo ./install.sh

# 自定义用户名
sudo ./install.sh myuser

# 修改脚本开头变量
# PANEL_USER="customuser"
# PROJECT_DIR="/opt/mac-panel"
# BACKEND_PORT=3001
# FRONTEND_PORT=5173
```

**修改文件**:
- ✅ `install.sh` - 变量化、参数化、优化显示

### 编辑器快捷键支持 ✅
**功能实现**:
- ✅ Ctrl+S / Cmd+S 快速保存
- ✅ Esc 快速关闭编辑器
- ✅ 界面显示快捷键提示
- ✅ 保存按钮显示快捷键

**技术实现**:
- 使用 useEffect 监听键盘事件
- 检测 Ctrl/Cmd + S 组合键
- 跨平台支持（Windows/Mac/Linux）

**修改文件**:
- ✅ `frontend/src/pages/Files.tsx` - 添加快捷键处理

## 最新更新（2026-03-08）

### 用户引导系统（首次登录向导）✅
**功能实现**:
- ✅ 创建 WelcomeWizard 组件 - 4步骤引导流程
  - 欢迎页：系统功能介绍
  - 安全建议：密码、防火墙、备份、更新提醒
  - 系统检查：自动检测服务状态
  - 快速开始：常用操作说明
- ✅ 创建 WelcomeChecker 组件 - 自动检测和显示引导
- ✅ 后端API：welcome-completed 和 welcome-status 端点
- ✅ 数据库扩展：UserData 接口添加 welcome_completed 字段
- ✅ App.tsx 集成：ProtectedRoute 中包装 WelcomeChecker

**技术特性**:
- 美观的 UI 设计（Ant Design Steps、Card、Progress）
- 系统健康检查（后端、前端、Nginx、数据库）
- 状态持久化到数据库
- 仅首次登录显示
- 无缝集成现有认证流程

**修改文件**:
- ✅ `frontend/src/pages/Welcome.tsx` - 新建（364行）
- ✅ `frontend/src/components/WelcomeChecker.tsx` - 新建（59行）
- ✅ `frontend/src/App.tsx` - 集成 WelcomeChecker
- ✅ `backend/src/routes/users.ts` - 添加引导状态API
- ✅ `backend/src/services/database.ts` - 添加 welcome_completed 字段

**用户体验**:
- 首次登录自动弹出引导向导
- 清晰的步骤指示
- 实时系统检查反馈
- 完成后自动跳转面板首页

## 最新更新（2026-03-07）

### Nginx 自动配置功能 ✅
**后端实现**:
- ✅ 创建 `backend/src/services/nginxService.ts` - Nginx 管理服务
  - Nginx 安装检测和版本获取
  - Nginx 状态监控（运行状态、PID）
  - Nginx 服务控制（启动、停止、重启、重载）
  - Nginx 配置测试（nginx -t）
  - Nginx 配置文件生成（支持静态/PHP/Java/代理）
  - Nginx SSL 配置（自动重定向 HTTPS）
  - SSL 证书保存和权限管理
  - 站点列表获取（已启用/可用站点）
  - 开发环境自动跳过配置
- ✅ 创建 `backend/src/routes/nginx.ts` - Nginx 管理路由
  - GET /api/nginx/status - 获取 Nginx 状态
  - POST /api/nginx/start - 启动 Nginx
  - POST /api/nginx/stop - 停止 Nginx
  - POST /api/nginx/restart - 重启 Nginx
  - POST /api/nginx/reload - 重新加载配置
  - POST /api/nginx/test - 测试配置
  - GET /api/nginx/sites - 获取站点列表
- ✅ 更新 `backend/src/services/websiteService.ts`
  - 使用 nginxService 生成配置
  - 新增 updateNginxConfig 方法
  - 新增 updateSSLConfig 方法
  - 删除旧的 generateNginxConfig 方法
- ✅ 更新 `backend/src/routes/websites.ts`
  - 更新网站时自动重新生成 Nginx 配置
  - SSL 配置时自动更新 Nginx 并重载

**前端实现**:
- ✅ 创建 `frontend/src/pages/NginxManagement.tsx` - Nginx 管理页面
  - Nginx 状态卡片（运行状态、版本、PID、站点数）
  - 服务控制按钮（启动、停止、重启、重载、测试）
  - 站点列表表格（显示已启用/未启用状态）
  - 使用说明文档
  - 自动刷新（每5秒）
  - 操作确认对话框
- ✅ 更新 `frontend/src/App.tsx` - 添加 /nginx 路由
- ✅ 更新 `frontend/src/components/Layout.tsx` - 添加"Nginx管理"菜单项

**功能特性**:
- ✅ 添加网站时自动生成 Nginx 配置并重载
- ✅ 更新网站时自动重新生成配置并重载
- ✅ 删除网站时自动删除配置并重载
- ✅ SSL 配置时自动启用 HTTPS 并重定向
- ✅ 配置测试失败时自动回滚
- ✅ 平滑重载（不中断服务）
- ✅ 开发环境自动跳过
- ✅ 完善的错误处理和权限检查

**技术实现**:
- 使用 fs-extra 操作文件和符号链接
- 使用 execAsync 执行系统命令
- 配置模板生成（支持多种网站类型）
- SSL 证书权限管理（chmod 600）
- Gzip 压缩配置
- 静态资源缓存配置
- WebSocket 代理支持
- 自定义请求头支持

## 最新更新（2026-03-06）

### 用户管理功能
- ✅ 完整的用户 CRUD 操作
- ✅ 角色管理和权限分配
- ✅ 密码重置功能
- ✅ 用户状态管理（启用/禁用）
- ✅ 修改密码功能（用户自己修改）
- ✅ 用户统计展示
- ✅ 防止删除/修改自己的安全机制

### 网络配置
- ✅ 环境变量示例文件（`.env.example`）
- ✅ 公网访问配置文档
- ✅ Nginx 反向代理配置示例

## 已知问题和解决方案

1. **远程登录 URL 问题**
   - 问题：前端尝试连接 `localhost:3001` 而非公网IP
   - 解决：设置 `VITE_API_URL` 环境变量
   - 文档：`docs/NETWORK_CONFIGURATION.md`

2. **终端权限问题（macOS）**
   - 问题：node-pty 权限失败
   - 状态：待修复

3. **Nginx 配置备份文件问题（2026-03-08 解决）**
   - 问题：nginx `include servers/*` 会包含 `.bak` 备份文件
   - 现象：SSL 证书错误 "cannot load certificate '/opt/homebrew/etc/nginx/undefined'"
   - 原因：备份文件包含错误的 SSL 配置 `ssl_certificate undefined;`
   - 解决：删除 `.bak` 备份文件或移出 nginx 配置目录
   - 经验：nginx 配置目录不应包含备份文件，备份应存放在其他位置

## 版本信息
- **当前版本**: v2.8.0
- **状态**: ✅ 生产可用
- **最后更新**: 2026-03-07
- **最新配置**: 服务IP已从 192.168.0.7 更改为 192.168.0.77
- **最新功能**: Nginx 自动配置和管理功能

## 开发规范

1. **提交前必须**：
   - 更新 AI_MEMORY
   - 测试功能
   - 备份数据库

2. **代码规范**：
   - TypeScript 严格模式
   - 使用 async/await
   - 错误处理
   - 日志记录

3. **安全性**：
   - 所有 API 需要认证
   - 权限检查
   - SQL 注入防护（使用参数化查询）
   - XSS 防护

## 下一步计划

1. 修复终端 node-pty 权限问题
2. 实现数据库管理真实连接
3. 系统监控增强（告警功能）
4. 性能优化
5. 单元测试

## 最新更新（2026-03-08 19:30）

### 操作管理功能 ✅
**新增页面**: 操作管理（Settings）

**功能1: Yolo 快捷启动**
- 为 Claude Code CLI 添加快捷命令
- 配置命令：`alias yolo="claude --dangerously-skip-permissions"`
- 添加到 ~/.zshrc
- 支持一键启用/禁用
- 自动检测配置状态

**功能2: Claude Code 配置**
- 一键创建 CLAUDE.md 文件
- 自动创建 AI_MEMORY 目录结构
  - brain/ - 项目理解
  - progress/ - 当前进度
  - logs/ - 工作日志
- 配置自动记忆规则
  - 启动时读取 AI_MEMORY
  - 执行前自动备份
  - 执行后更新认知、进度、日志

**后端API**:
- `GET /api/settings` - 获取设置
- `POST /api/settings/yolo` - 配置 yolo
- `POST /api/settings/claude-md` - 创建 CLAUDE.md
- `GET /api/settings/yolo/status` - 查询状态

**前端页面**:
- `Settings.tsx` - 操作管理页面
- 卡片式布局
- 实时状态显示
- 安全提示

**修改文件**:
- ✅ `backend/src/routes/settings.ts` - 新建（320行）
- ✅ `backend/src/app.ts` - 注册 settings 路由
- ✅ `frontend/src/pages/Settings.tsx` - 新建（280行）
- ✅ `frontend/src/App.tsx` - 添加路由
- ✅ `frontend/src/components/Layout.tsx` - 添加菜单

**使用方法**:
1. 进入"操作管理"页面
2. Yolo：点击开关启用，在终端执行 `source ~/.zshrc`，输入 `yolo` 测试
3. CLAUDE.md：输入项目路径，点击创建按钮

**安全提示**:
- Yolo 命令跳过权限检查，仅用于开发环境
- 生产环境应使用完整的 claude 命令

## 最新更新（2026-03-09 01:30）

### 网络一键安装系统 ✅
**功能实现**:
- ✅ 创建 web-install.sh 独立网络安装脚本（472行）
- ✅ 支持从 GitHub 直接下载安装：`curl -fsSL https://raw.githubusercontent.com/hnbwww/mac-panel/master/web-install.sh | sudo bash`
- ✅ 完整的全自动安装流程
- ✅ 项目已上传到 GitHub 公开仓库
- ✅ 更新 AUTO_INSTALL_GUIDE.md 突出一键安装

**GitHub 仓库信息**:
- **仓库地址**: https://github.com/hnbwww/mac-panel
- **所有者**: hnbwww
- **状态**: 公开仓库
- **文件数**: 205+ 文件
- **代码行数**: 84,000+ 行

**网络一键安装功能**:
```bash
# 单命令安装（从网络下载并自动安装所有依赖）
curl -fsSL https://raw.githubusercontent.com/hnbwww/mac-panel/master/web-install.sh | sudo bash
```

**web-install.sh 特性**:
- ✅ 完全独立运行（无需本地文件）
- ✅ 自动检测和安装 Homebrew
- ✅ 自动安装 Node.js 18+ LTS
- ✅ 自动安装 git 等必要工具
- ✅ 从 GitHub 克隆项目
- ✅ 创建服务用户（macpanel）
- ✅ 配置文件权限和 sudoers
- ✅ 构建前后端项目
- ✅ 初始化数据库
- ✅ 配置环境变量（自动检测本机IP）
- ✅ 创建管理命令（mac-panel）
- ✅ 启动服务并验证

**安装文档**:
- ✅ `AUTO_INSTALL_GUIDE.md` - 更新为突显网络一键安装
- ✅ `INSTALL_CHECKLIST.md` - 396行详细检查清单
- ✅ `web-install.sh` - 472行独立安装脚本

**修改文件**:
- ✅ `web-install.sh` - 新建（472行）
- ✅ `AUTO_INSTALL_GUIDE.md` - 更新（突出网络安装）
- ✅ GitHub 仓库 - 创建并推送所有代码

**用户价值**:
- 🚀 **极简安装**: 一条命令完成所有安装
- 📦 **自动依赖**: 自动安装 Homebrew、Node.js、git
- 🌐 **网络分发**: 直接从 GitHub 下载最新版本
- 🔄 **易更新**: 使用 git pull 或 mac-panel update
- 📚 **完整文档**: 多种安装方法和详细指南
