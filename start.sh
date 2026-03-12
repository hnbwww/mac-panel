#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 启动 Mac Panel..."

# 停止现有服务
if [ -f "$PROJECT_DIR/backend/backend.pid" ]; then
    kill $(cat "$PROJECT_DIR/backend/backend.pid") 2>/dev/null || true
    rm -f "$PROJECT_DIR/backend/backend.pid"
fi
pkill -f "mac-panel/backend.*app.js" || true

# 启动后端
cd "$PROJECT_DIR/backend"
mkdir -p logs
export NODE_ENV=production
nohup node dist/app.js > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

sleep 2

if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Mac Panel 已启动"
    # 获取本机 IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
echo "📱 访问地址:"
echo "   本地: http://localhost:5188"
echo "   局域网: http://$LOCAL_IP:5188"
else
    echo "❌ 启动失败，请检查日志"
    cat logs/backend.log
    exit 1
fi
