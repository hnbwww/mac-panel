/**
 * 获取API基础URL（完全依赖环境变量配置）
 */
const getApiBaseUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 生产环境使用相对路径
  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  // 开发环境必须配置环境变量
  throw new Error('VITE_API_URL environment variable is not set. Please configure it in frontend/.env file.');
};

/**
 * 获取WebSocket基础URL（完全依赖环境变量配置）
 */
const getWsBaseUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // 生产环境使用当前域名的ws协议
  if (import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  // 开发环境必须配置环境变量
  throw new Error('VITE_WS_URL environment variable is not set. Please configure it in frontend/.env file.');
};

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  VERIFY: '/api/auth/verify',

  // Files
  FILE_LIST: '/api/files/list',
  FILE_CREATE: '/api/files/create',
  FILE_DELETE: '/api/files/delete',
  FILE_COPY: '/api/files/copy',
  FILE_MOVE: '/api/files/move',
  FILE_COMPRESS: '/api/files/compress',
  FILE_EXTRACT: '/api/files/extract',
  FILE_CONTENT: '/api/files/content',
  FILE_SAVE: '/api/files/save',
  FILE_DOWNLOAD: '/api/files/download',
  FILE_RENAME: '/api/files/rename',
  FILE_UPLOAD: '/api/files/upload',

  // Websites
  WEBSITE_LIST: '/api/websites/list',
  WEBSITE_CREATE: '/api/websites/create',
  WEBSITE_UPDATE: '/api/websites/:id',
  WEBSITE_DELETE: '/api/websites/:id',
  WEBSITE_SSL: '/api/websites/:id/ssl',
  WEBSITE_BACKUP: '/api/websites/:id/backup',
  WEBSITE_LOGS: '/api/websites/:id/logs',
  WEBSITE_PROXY: '/api/websites/proxy',

  // Database
  DATABASE_LIST: '/api/database/list',
  DATABASE_CREATE: '/api/database/create',
  DATABASE_DELETE: '/api/database/:id',
  DATABASE_TABLES: '/api/database/:id/tables',
  DATABASE_DATA: '/api/database/:id/data',
  DATABASE_SQL: '/api/database/sql',
  DATABASE_BACKUP: '/api/database/:id/backup',
  DATABASE_IMPORT: '/api/database/:id/import',
} as const;

export const WS_ENDPOINTS = {
  TERMINAL: '/ws/terminal',
} as const;
