/**
 * API 和 WebSocket 配置
 * 统一管理所有API和WebSocket地址
 */

/**
 * 获取API基础URL（完全依赖环境变量配置）
 */
export const getApiBaseUrl = (): string => {
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
export const getWsBaseUrl = (): string => {
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

/**
 * 获取终端WebSocket URL（完全依赖环境变量配置）
 */
export const getTerminalWsUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_TERMINAL_WS_URL) {
    return import.meta.env.VITE_TERMINAL_WS_URL;
  }

  // 生产环境使用当前域名的ws协议
  if (import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  // 开发环境必须配置环境变量
  throw new Error('VITE_TERMINAL_WS_URL environment variable is not set. Please configure it in frontend/.env file.');
};

/**
 * 获取浏览器WebSocket URL（完全依赖环境变量配置）
 */
export const getBrowserWsUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_BROWSER_WS_URL) {
    return import.meta.env.VITE_BROWSER_WS_URL;
  }

  // 生产环境使用当前域名的ws协议
  if (import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  // 开发环境必须配置环境变量
  throw new Error('VITE_BROWSER_WS_URL environment variable is not set. Please configure it in frontend/.env file.');
};

// 导出常量（用于兼容旧代码）
export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = getWsBaseUrl();
export const TERMINAL_WS_URL = getTerminalWsUrl();
export const BROWSER_WS_URL = getBrowserWsUrl();
