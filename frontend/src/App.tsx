import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from './store';
import { GlobalEditorProvider } from './context/GlobalEditorContext';
import AppLayout from './components/Layout';
import WelcomeChecker from './components/WelcomeChecker';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Files from './pages/Files';
import Terminal from './pages/Terminal';
import TerminalTestPage from './pages/TerminalTest';
import Websites from './pages/Websites';
import Database from './pages/Database';
import DatabaseAdmin from './pages/DatabaseAdmin';
import Software from './pages/Software';
import SoftwareAdmin from './pages/SoftwareAdmin';
import SystemMonitor from './pages/SystemMonitor';
import ProcessesPage from './pages/Processes';
import TasksPage from './pages/Tasks';
import BrowserPage from './pages/Browser';
import LogsPage from './pages/Logs';
import UsersPage from './pages/Users';
import OnlineEditor from './pages/Editor';
import NginxManagement from './pages/NginxManagement';
import SettingsPage from './pages/Settings';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <WelcomeChecker>{children}</WelcomeChecker>;
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <GlobalEditorProvider>
        <AntdApp>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/files"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                    <Files />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/terminal"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                    <Terminal />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/terminal-test"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                    <TerminalTestPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/websites"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Websites />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/database"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Database />
                  </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/database-admin"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <DatabaseAdmin />
                  </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/software"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Software />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/software-admin"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SoftwareAdmin />
                    </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/monitor"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SystemMonitor />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/processes"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                    <ProcessesPage />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                    <TasksPage />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/browser"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                    <BrowserPage />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/logs"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <LogsPage />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <UsersPage />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/editor"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                    <OnlineEditor />
                  </AppLayout>
                </ProtectedRoute>
                }
              />
              <Route
                path="/nginx"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <NginxManagement />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SettingsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
            {/* 全局编辑器 - 始终显示 */}
            <OnlineEditor globalMode />
          </BrowserRouter>
        </AntdApp>
      </GlobalEditorProvider>
    </ConfigProvider>
  );
}

export default App;
