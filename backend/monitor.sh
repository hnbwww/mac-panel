#!/bin/bash

# Mac Panel 后端服务监控脚本

BACKEND_DIR="/Users/www1/Desktop/claude/mac-panel/backend"
PID_FILE="$BACKEND_DIR/backend.pid"
LOG_FILE="$BACKEND_DIR/backend.log"

echo "🔍 后端服务监控"
echo "=================="
echo ""

# 检查进程状态
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ 进程状态: 运行中 (PID: $PID)"

        # 显示进程信息
        echo ""
        echo "进程信息:"
        ps -p $PID -o pid,ppid,%cpu,%mem,etime,command
        echo ""

        # 显示内存使用
        RSS=$(ps -p $PID -o rss=)
        RSS_MB=$((RSS / 1024 / 1024))
        echo "内存使用: ${RSS_MB}MB"
        echo ""

        # 显示最近的日志
        echo "最近的日志 (最后20行):"
        echo "────────────────────────────────"
        tail -20 "$LOG_FILE"
    else
        echo "❌ 进程未运行 (PID: $PID)"
        echo ""
        echo "正在重启服务..."
        cd "$BACKEND_DIR"
        ./start-stable.sh
    fi
else
    echo "❌ PID 文件不存在"
    echo ""
    echo "正在启动服务..."
    cd "$BACKEND_DIR"
    ./start-stable.sh
fi

echo ""
echo "=================="
echo "✅ 监控完成"
