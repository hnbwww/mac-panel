import React, { useState, useEffect } from 'react';
import WelcomeWizard from '../pages/Welcome';
import axios from 'axios';

interface WelcomeCheckerProps {
  children: React.ReactNode;
}

const WelcomeChecker: React.FC<WelcomeCheckerProps> = ({ children }) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const token = localStorage.getItem('token');

  useEffect(() => {
    const checkWelcomeStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/users/welcome-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.data.welcome_completed) {
          setShowWelcome(true);
        }
      } catch (error) {
        console.error('检查欢迎状态失败:', error);
        // 如果API失败，默认不显示欢迎向导
      } finally {
        setLoading(false);
      }
    };

    // 只在根路径检查欢迎状态
    if (window.location.pathname === '/' || window.location.pathname === '/dashboard') {
      checkWelcomeStatus();
    } else {
      setLoading(false);
    }
  }, []);

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
  };

  if (loading) {
    return null; // 或者显示一个加载指示器
  }

  if (showWelcome) {
    return <WelcomeWizard onComplete={handleWelcomeComplete} />;
  }

  return <>{children}</>;
};

export default WelcomeChecker;
