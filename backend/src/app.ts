import express, { Application } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';

// Routes
import filesRouter from './routes/files';
import websitesRouter from './routes/websites';
import databaseRouter from './routes/database';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import systemRouter, { setupSystemStatsWebSocket } from './routes/system';
import tasksRouter from './routes/tasks';
import notificationsRouter from './routes/notifications';
import softwareRouter from './routes/software';
import dashboardRouter from './routes/dashboard';
import browserRouter from './routes/browser';
import terminalLogsRouter from './routes/terminalLogs';
import logsRouter from './routes/logs';
import nginxRouter from './routes/nginx';
import settingsRouter from './routes/settings';

// Middleware
import { errorHandler } from './middlewares/errorHandler';
import { authMiddleware } from './middlewares/auth';
import { auditLog } from './middlewares/auditLog';

// Services
import { handleTerminalConnection } from './services/terminalService';
import { handleBrowserConnection } from './services/browserService';
import { systemInfoService } from './services/systemInfoService';
import { taskScheduler } from './services/taskScheduler';
import { db } from './services/database';
import { errorLogger, setupGlobalErrorHandlers } from './utils/errorLogger';
import { initializeDefaultSoftware } from './services/softwareInit';
import { addAdditionalSoftware } from './services/additionalSoftware';
import { enhanceSoftwareDetection } from './services/detectionEnhancer';
import { fixServerDatabaseConfigs } from './services/fixServerDatabaseConfigs';

dotenv.config({ path: path.resolve(__dirname, '.env') });

// 设置全局错误处理
setupGlobalErrorHandlers();

const app: Application = express();
const server = createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

// 增加服务器超时时间以支持大文件上传
server.timeout = 10 * 60 * 1000; // 10 分钟
server.keepAliveTimeout = 10 * 60 * 1000; // 10 分钟
server.headersTimeout = 11 * 60 * 1000; // 11 分钟（略长于 keepAliveTimeout）

// CORS configuration - 允许所有来源
app.use(cors({
  origin: function (origin, callback) {
    // 允许没有 origin 的请求（比如移动应用或Postman）
    if (!origin) return callback(null, true);
    // 允许所有来源
    return callback(null, true);
  },
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Audit logging middleware (after body parser, before routes)
app.use(auditLog);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mac Panel Backend is running' });
});

// Public routes
app.use('/api/auth', authRouter);

// Protected routes (require authentication)
app.use('/api/files', authMiddleware, filesRouter);
app.use('/api/websites', authMiddleware, websitesRouter);
app.use('/api/database', authMiddleware, databaseRouter);
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/system', authMiddleware, systemRouter);
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/notifications', authMiddleware, notificationsRouter);
app.use('/api/software', authMiddleware, softwareRouter);
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/browser', authMiddleware, browserRouter);
app.use('/api/terminal-logs', authMiddleware, terminalLogsRouter);
app.use('/api/logs', authMiddleware, logsRouter);
app.use('/api/nginx', authMiddleware, nginxRouter);
app.use('/api/settings', authMiddleware, settingsRouter);

// WebSocket for terminal - 使用独立的HTTP服务器避免冲突
const terminalHttpServer = createServer((req, res) => {
  // 只处理WebSocket升级请求
  res.writeHead(426); // Upgrade Required
  res.end('WebSocket connection required');
});

const terminalWss = new WebSocketServer({
  server: terminalHttpServer,
  path: '/ws/terminal',
  perMessageDeflate: false,
  skipUTF8Validation: false
});

terminalWss.on('connection', (ws, req) => {
  console.log('[Terminal WS] New connection attempt from', req.socket.remoteAddress);
  handleTerminalConnection(ws, req);
});

terminalWss.on('error', (error) => {
  console.error('[Terminal WS] Server error:', error);
});

// WebSocket for browser - 使用独立的HTTP服务器避免冲突
const browserHttpServer = createServer((req, res) => {
  // 只处理WebSocket升级请求
  res.writeHead(426); // Upgrade Required
  res.end('WebSocket connection required');
});

const browserWss = new WebSocketServer({
  server: browserHttpServer,
  path: '/ws/browser'
});

browserWss.on('connection', (ws, req) => {
  console.log('[Browser WS] New connection attempt');
  handleBrowserConnection(ws, req);
});

browserWss.on('error', (error) => {
  console.error('[Browser WS] Server error:', error);
});

// WebSocket for system stats
const systemWss = new WebSocketServer({ server, path: '/ws/system-stats' });
setupSystemStatsWebSocket(systemWss);

// Error handling middleware
app.use(errorHandler);

// Initialize and start server
async function startServer() {
  try {
    // 确保数据库已初始化
    await db.listUsers();

    // 初始化默认软件配置
    await initializeDefaultSoftware();

    // 添加额外的推荐软件
    await addAdditionalSoftware();

    // 增强软件检测能力
    await enhanceSoftwareDetection();

    // 修复服务器和数据库软件的配置
    await fixServerDatabaseConfigs();

    // 初始化任务调度器
    await taskScheduler.initialize();

    // Start broadcasting system stats
    systemInfoService.startBroadcasting(1000); // 每秒更新一次

    // Start server - bind to all interfaces for public access
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Mac Panel Backend running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Accessible from network (0.0.0.0)`);

      // Terminal WebSocket服务器监听不同端口
      const TERMINAL_PORT = 3002;
      terminalHttpServer.listen(TERMINAL_PORT, '0.0.0.0', () => {
        console.log(`   - Terminal: ws://0.0.0.0:${TERMINAL_PORT}/ws/terminal`);
      });

      // Browser WebSocket服务器监听不同端口
      const BROWSER_PORT = 3003;
      browserHttpServer.listen(BROWSER_PORT, '0.0.0.0', () => {
        console.log(`   - Browser: ws://0.0.0.0:${BROWSER_PORT}/ws/browser`);
      });

      console.log(`🔌 WebSocket endpoints:`);
      console.log(`   - System Stats: ws://0.0.0.0:${PORT}/ws/system-stats`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
