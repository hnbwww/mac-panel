#!/bin/bash

################################################################################
# Mac Panel 全自动安装脚本 v3.0
# 支持 macOS 12.0+
# 从 GitHub 克隆并全自动安装配置
# 使用方法: ./install.sh
################################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 全局变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/opt/mac-panel"
GITHUB_REPO="https://github.com/HYweb3/mac-panel.git"
GITHUB_BACKUP="https://gitee.com/hyweb3/mac-panel.git"

# 进度条
PROGRESS_WIDTH=50
current_progress=0

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}🚀 $1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error_msg() {
    echo -e "${RED}❌ $1${NC}"
}

# 显示进度条
show_progress() {
    local current=$1
    local total=$2
    local message=$3

    if [ $total -gt 0 ]; then
        local percent=$((current * 100 / total))
        local filled=$((PROGRESS_WIDTH * current / total))
        local empty=$((PROGRESS_WIDTH - filled))

        printf "\r${BLUE}[%3d%%]${NC} ["
        printf "%${filled}s" | tr ' ' '='
        printf "%${empty}s" | tr ' ' ' '
        printf "] %s" "$message"
    fi
}

# 检查是否需要sudo
check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        if ! command -v sudo &> /dev/null; then
            log_error "需要 sudo 权限，但系统未安装 sudo"
            exit 1
        fi

        # 检查sudo权限
        if ! sudo -n true 2>/dev/null; then
            log_warn "需要管理员权限，请输入密码："
            sudo true || exit 1
        fi
        log_success "sudo 权限已获取"
    fi
}

# 检查macOS版本
check_macos_version() {
    log_step "检查系统版本"

    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "此脚本仅支持 macOS 系统"
        exit 1
    fi

    MACOS_VERSION=$(sw_vers -productVersion)
    MACOS_MAJOR=$(echo "$MACOS_VERSION" | cut -d. -f1)
    MACOS_MINOR=$(echo "$MACOS_VERSION" | cut -d. -f2)

    log_info "检测到 macOS 版本: $MACOS_VERSION"

    if [ "$MACOS_MAJOR" -lt 12 ]; then
        log_error "需要 macOS 12.0 或更高版本"
        exit 1
    fi

    log_success "系统版本检查通过"
}

# 检查并安装Homebrew
check_homebrew() {
    log_step "检查 Homebrew"

    if ! command -v brew &> /dev/null; then
        log_info "📦 Homebrew 未安装，正在安装..."

        # 使用非交互式安装
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/null

        if [ $? -eq 0 ]; then
            # 添加到PATH
            if [[ -x "/opt/homebrew/bin/brew" ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
                log_success "Homebrew 安装成功"
            else
                log_error "Homebrew 安装失败"
                exit 1
            fi
        else
            log_error "Homebrew 安装失败"
            exit 1
        fi
    else
        log_success "Homebrew 已安装: $(brew --version | head -1)"
        # 更新 Homebrew
        log_info "更新 Homebrew..."
        brew update > /dev/null 2>&1 || true
    fi

    # 确保 Homebrew 在 PATH 中
    if [[ -x "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
}

# 安装必要的工具
install_required_tools() {
    log_step "安装必要工具"

    local tools=("git" "curl" "wget" "jq" "pv")
    local total=${#tools[@]}
    local current=0

    for tool in "${tools[@]}"; do
        ((current++))
        show_progress $current $total "检查/安装 $tool..."

        if ! command -v "$tool" &> /dev/null; then
            case "$tool" in
                "git")
                    brew install git > /dev/null 2>&1
                    ;;
                "curl")
                    # macOS自带curl
                    ;;
                "wget")
                    brew install wget > /dev/null 2>&1
                    ;;
                "jq")
                    brew install jq > /dev/null 2>&1
                    ;;
                "pv")
                    brew install pv > /dev/null 2>&1
                    ;;
            esac
        fi
    done

    printf "\n"
    log_success "必要工具已就绪"
}

# 安装Node.js
install_nodejs() {
    log_step "安装 Node.js"

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(node --version | cut -d. -f1 | cut -d'v' -f2)
        log_info "Node.js 已安装: $NODE_VERSION"

        if [ "$NODE_MAJOR" -lt 18 ]; then
            log_warn "Node.js 版本过低，正在更新到最新 LTS 版本..."
            brew reinstall node@18 > /dev/null 2>&1 || brew install node@18 > /dev/null 2>&1
            brew link --overwrite node@18 > /dev/null 2>&1 || true
            log_success "Node.js 已更新"
        else
            log_success "Node.js 版本满足要求"
        fi
    else
        log_info "📦 正在安装 Node.js LTS 版本..."
        brew install node@18 > /dev/null 2>&1 || brew install node > /dev/null 2>&1

        if [ $? -eq 0 ]; then
            log_success "Node.js 安装成功: $(node --version)"
        else
            log_error "Node.js 安装失败"
            exit 1
        fi
    fi

    # 配置npm
    log_info "配置 npm 镜像源..."
    npm config set registry https://registry.npmmirror.com > /dev/null 2>&1 || true
    npm config set fund false > /dev/null 2>&1 || true
    log_success "npm 配置完成"
}

# 创建专用用户
create_user() {
    log_step "创建 Mac Panel 服务用户"

    USERNAME="macpanel"

    if id "$USERNAME" &>/dev/null; then
        log_info "用户 $USERNAME 已存在"

        # 检查用户是否在 admin 组
        if groups "$USERNAME" | grep -q admin; then
            log_success "用户已在 admin 组"
        else
            log_info "将用户添加到 admin 组..."
            sudo dseditgroup -o edit -t "$USERNAME" admin
            log_success "用户已添加到 admin 组"
        fi
    else
        log_info "创建专用用户: $USERNAME"

        # 生成随机密码
        PASSWORD=$(openssl rand -base64 16)

        # 创建用户
        sudo sysadminctl -addUser "$USERNAME" \
            -fullName "Mac Panel Service User" \
            -password "$PASSWORD" \
            -admin 2>/dev/null || {
            log_warn "sysadminctl 创建用户失败，尝试使用 dscl..."

            # 备用方法：使用 dscl
            sudo dscl . create /Users/"$USERNAME"
            sudo dscl . create /Users/"$USERNAME" RealName "Mac Panel Service User"
            sudo dscl . create /Users/"$USERNAME" passwd "$PASSWORD"
            sudo dscl . create /Users/"$USERNAME" PrimaryGroupID 80
            sudo dscl . create /Users/"$USERNAME" UniqueID 500
            sudo dscl . create /Users/"$USERNAME" UserShell /bin/bash
            sudo dscl . create /Users/"$USERNAME" NFSHomeDirectory /Users/"$USERNAME"

            # 创建家目录
            sudo mkdir -p /Users/"$USERNAME"
            sudo chown "$USERNAME":/Users/"$USERNAME"

            # 添加到 admin 组
            sudo dseditgroup -o edit -a "$USERNAME" admin
        }

        if [ $? -eq 0 ]; then
            log_success "用户 $USERNAME 创建成功"
            log_warn "密码: $PASSWORD (请妥善保管)"
        else
            log_error "用户创建失败"
            exit 1
        fi
    fi

    log_success "服务用户配置完成"
}

# 克隆或更新项目
clone_or_update_project() {
    log_step "获取项目代码"

    # 检查是在项目目录中运行还是全新安装
    if [ -f "$SCRIPT_DIR/backend/package.json" ]; then
        log_info "检测到项目目录，使用本地代码"
        PROJECT_DIR="$SCRIPT_DIR"
        log_success "使用项目目录: $PROJECT_DIR"
        return
    fi

    # 全新安装
    if [ -d "$PROJECT_DIR" ]; then
        log_warn "项目目录已存在: $PROJECT_DIR"
        read -p "是否删除并重新安装? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "删除旧目录..."
            sudo rm -rf "$PROJECT_DIR"
        else
            log_error "安装已取消"
            exit 1
        fi
    fi

    log_info "📥 正在从 GitHub 克隆项目..."

    # 尝试从GitHub克隆
    if git clone "$GITHUB_REPO" "$PROJECT_DIR" 2>/dev/null; then
        log_success "项目克隆成功"
    else
        log_warn "GitHub 克隆失败，尝试备用源..."
        if git clone "$GITHUB_BACKUP" "$PROJECT_DIR" 2>/dev/null; then
            log_success "项目克隆成功（备用源）"
        else
            log_error "项目克隆失败，请检查网络连接"
            exit 1
        fi
    fi

    cd "$PROJECT_DIR"
}

# 安装项目依赖
install_project_dependencies() {
    log_step "安装项目依赖"

    cd "$PROJECT_DIR"

    # 检查并安装后端依赖
    log_info "📦 安装后端依赖..."
    if [ -f "backend/package.json" ]; then
        cd backend
        npm install --production=false > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            log_success "后端依赖安装完成"
        else
            log_error "后端依赖安装失败"
            exit 1
        fi
        cd ..
    fi

    # 构建后端
    log_info "🔨 构建后端..."
    cd backend
    npm run build > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_success "后端构建完成"
    else
        log_error "后端构建失败"
        exit 1
    fi
    cd ..

    # 安装前端依赖
    log_info "📦 安装前端依赖..."
    if [ -f "frontend/package.json" ]; then
        cd frontend
        npm install > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            log_success "前端依赖安装完成"
        else
            log_error "前端依赖安装失败"
            exit 1
        fi
        cd ..
    fi

    # 构建前端
    log_info "🔨 构建前端..."
    cd frontend
    npm run build > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_success "前端构建完成"
    else
        log_error "前端构建失败"
        exit 1
    fi
    cd ..

    log_success "项目依赖安装完成"
}

# 配置环境变量
setup_environment() {
    log_step "配置环境变量"

    cd "$PROJECT_DIR"

    # 检查是否存在.env文件
    if [ ! -f "backend/.env" ]; then
        log_info "创建后端环境配置..."

        # 获取本机IP
        LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

        cat > backend/.env << EOF
# Mac Panel Backend Configuration
NODE_ENV=production
PORT=3001
FRONTEND_PORT=5173

# 允许的主机（添加你的局域网IP）
ALLOWED_HOSTS=localhost,127.0.0.1,$LOCAL_IP

# 数据库配置（自动生成）
DB_PATH=./data/db.json

# 日志级别
LOG_LEVEL=info

# 其他配置
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
EOF

        log_success "环境配置已创建"
    else
        log_info "环境配置已存在，跳过"
    fi

    # 前端环境配置
    if [ ! -f "frontend/.env" ]; then
        log_info "创建前端环境配置..."

        cat > frontend/.env << EOF
# Mac Panel Frontend Configuration
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_TERMINAL_WS_URL=ws://localhost:3002/ws/terminal
VITE_BROWSER_WS_URL=ws://localhost:3003/ws/browser
EOF

        log_success "前端环境配置已创建"
    fi
}

# 初始化数据库
init_database() {
    log_step "初始化数据库"

    cd "$PROJECT_DIR/backend"

    # 创建数据目录
    mkdir -p data
    mkdir -p data/backups
    mkdir -p data/uploads

    # 检查数据库文件是否存在
    if [ ! -f "data/db.json" ]; then
        log_info "创建数据库文件..."
        cat > data/db.json << EOF
{
  "users": [],
  "websites": [],
  "software_configs": [],
  "tasks": [],
  "notifications": [],
  "settings": {}
}
EOF
        log_success "数据库文件已创建"
    else
        log_info "数据库文件已存在"
    fi

    log_success "数据库初始化完成"
}

# 配置权限
setup_permissions() {
    log_step "配置文件权限"

    cd "$PROJECT_DIR"
    USERNAME="macpanel"

    # 设置项目目录所有者
    if id "$USERNAME" &>/dev/null; then
        log_info "设置项目目录所有者为 $USERNAME..."
        sudo chown -R "$USERNAME":staff "$PROJECT_DIR"
    else
        log_warn "用户 $USERNAME 不存在，使用当前用户"
    fi

    # 设置权限
    chmod -R 755 .

    # 数据目录需要写权限
    chmod 775 backend/data
    chmod 644 backend/data/*.json 2>/dev/null || true

    # 日志目录
    mkdir -p backend/logs
    chmod 775 backend/logs

    # 上传目录
    mkdir -p backend/uploads
    chmod 775 backend/uploads

    # 确保脚本可执行
    find . -name "*.sh" -type f -exec chmod +x {} \;

    log_success "权限配置完成"
}

# 配置sudo免密
setup_sudoers() {
    log_step "配置 Sudoers 免密"

    SUDOERS_FILE="/etc/sudoers.d/mac-panel"
    USERNAME="macpanel"

    # 检查用户是否存在
    if ! id "$USERNAME" &>/dev/null; then
        log_warn "用户 $USERNAME 不存在，跳过 sudoers 配置"
        return
    fi

    log_info "创建 sudoers 配置..."

    # 创建sudoers配置文件
    sudo tee "$SUDOERS_FILE" > /dev/null << EOF
# Mac Panel Sudoers Configuration
# 允许 macpanel 用户管理系统服务
# 生成时间: $(date)

# 服务管理
$USERNAME ALL=(ALL) NOPASSWD: /bin/launchctl kickstart -k gui/$(id -u $USERNAME) com.github.macpanel.backend
$USERNAME ALL=(ALL) NOPASSWD: /bin/launchctl kickstart -k gui/$(id -u $USERNAME) com.github.macpanel.frontend

# Nginx 管理
$USERNAME ALL=(ALL) NOPASSWD: /opt/homebrew/bin/nginx -s *
$USERNAME ALL=(ALL) NOPASSWD: /opt/homebrew/sbin/nginx -s *
$USERNAME ALL=(ALL) NOPASSWD: /usr/local/bin/nginx

# 软件管理 (brew services)
$USERNAME ALL=(ALL) NOPASSWD: /opt/homebrew/bin/brew services *
$USERNAME ALL=(ALL) NOPASSWD: /usr/local/bin/brew services *

# 网站管理
$USERNAME ALL=(ALL) NOPASSWD: /bin/mkdir -p /Users/*/wwwroot
$USERNAME ALL=(ALL) NOPASSWD: /bin/chown -R *:staff /Users/*/wwwroot

# 系统监控
$USERNAME ALL=(ALL) NOPASSWD: /usr/bin/ps
$USERNAME ALL=(ALL) NOPASSWD: /usr/bin/kill *
$USERNAME ALL=(ALL) NOPASSWD: /bin/df
$USERNAME ALL=(ALL) NOPASSWD: /usr/bin/netstat
$USERNAME ALL=(ALL) NOPASSWD: /sbin/ifconfig

# 文件权限
$USERNAME ALL=(ALL) NOPASSWD: /bin/chmod -R 755 /Users/*/wwwroot
$USERNAME ALL=(ALL) NOPASSWD: /usr/sbin/chown *
EOF

    # 设置正确的权限
    sudo chmod 440 "$SUDOERS_FILE"

    # 验证sudoers文件语法
    if sudo visudo -c -f "$SUDOERS_FILE" > /dev/null 2>&1; then
        log_success "Sudoers 配置完成"
    else
        log_error "Sudoers 配置语法错误"
        sudo rm -f "$SUDOERS_FILE"
        exit 1
    fi
}

# 创建启动脚本
create_launch_scripts() {
    log_step "创建启动脚本"

    PROJECT_DIR="/opt/mac-panel"

    # 创建后端启动脚本
    cat > "$PROJECT_DIR/start-backend.sh" << 'EOF'
#!/bin/bash
cd "$PROJECT_DIR/backend"
export NODE_ENV=production
nohup node dist/app.js > "$PROJECT_DIR/backend/backend.log" 2>&1 &
echo $! > "$PROJECT_DIR/backend/backend.pid"
EOF

    # 创建启动脚本
    cat > "$PROJECT_DIR/start.sh" << 'EOF'
#!/bin/bash
# Mac Panel 快速启动脚本

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 启动 Mac Panel..."

# 停止现有服务
if [ -f "$PROJECT_DIR/backend/backend.pid" ]; then
    kill $(cat "$PROJECT_DIR/backend/backend.pid") 2>/dev/null || true
fi
pkill -f "mac-panel/backend.*app.js" || true

# 启动后端
cd "$PROJECT_DIR/backend"
export NODE_ENV=production
nohup node dist/app.js > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

sleep 2

# 检查服务状态
if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Mac Panel 已启动"
    echo "📱 访问地址: http://localhost:3001"
else
    echo "❌ 启动失败，请检查日志"
    cat backend.log
    exit 1
fi
EOF

    chmod +x "$PROJECT_DIR/start-backend.sh"
    chmod +x "$PROJECT_DIR/start.sh"

    log_success "启动脚本已创建"
}

# 配置防火墙
configure_firewall() {
    log_step "配置防火墙"

    # 检查防火墙是否开启
    if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -q "enabled: 1"; then
        log_info "防火墙已启用，添加端口规则..."

        # 添加端口规则
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/nginx 2>/dev/null || true
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add 3001 2>/dev/null || true
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add 5173 2>/dev/null || true

        # 允许传入连接
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on 2>/dev/null || true

        log_success "防火墙规则已添加"
    else
        log_info "防火墙未启用，跳过配置"
        log_warn "如需启用防火墙，请运行: /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on"
    fi
}


# 停止现有服务
stop_existing_services() {
    log_step "停止现有服务"

    # 停止后端
    if pgrep -f "mac-panel/backend.*app.js" > /dev/null; then
        log_info "停止现有后端服务..."
        pkill -f "mac-panel/backend.*app.js" || true
        sleep 1
    fi

    # 停止前端
    if pgrep -f "mac-panel/frontend.*5175" > /dev/null; then
        log_info "停止现有前端服务..."
        pkill -f "mac-panel/frontend.*5175" || true
        sleep 1
    fi

    log_success "现有服务已停止"
}

# 启动服务
start_services() {
    log_step "启动服务"

    cd "$PROJECT_DIR/backend"

    # 启动后端
    log_info "🚀 启动后端服务..."
    export NODE_ENV=production
    nohup node dist/app.js > backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > backend.pid

    sleep 3

    # 检查后端
    if curl -s http://localhost:3001/health > /dev/null; then
        log_success "后端服务启动成功"
    else
        log_error "后端服务启动失败"
        tail -20 backend.log
        exit 1
    fi

    log_success "服务启动完成"
}

# 测试服务
test_services() {
    log_step "测试服务连接"

    # 测试后端API
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        log_success "后端API测试通过"
    else
        log_warn "后端API测试失败"
    fi

    # 显示访问地址
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
}

# 创建管理脚本
create_management_scripts() {
    log_step "创建管理脚本"

    BIN_DIR="/usr/local/bin"

    # 创建管理脚本
    cat > "$BIN_DIR/mac-panel" << EOF
#!/bin/bash
# Mac Panel 管理工具

PROJECT_DIR="$PROJECT_DIR"
ACTION="\$1"

case "\$ACTION" in
    start)
        echo "🚀 启动 Mac Panel..."
        cd "\$PROJECT_DIR/backend"
        export NODE_ENV=production
        nohup node dist/app.js > backend.log 2>&1 &
        echo \$! > backend.pid
        echo "✅ Mac Panel 已启动"
        echo "📱 访问地址: http://localhost:3001"
        ;;

    stop)
        echo "⏹️  停止 Mac Panel..."
        if [ -f "\$PROJECT_DIR/backend/backend.pid" ]; then
            PID=\$(cat "\$PROJECT_DIR/backend/backend.pid")
            kill \$PID 2>/dev/null || true
            rm -f "\$PROJECT_DIR/backend/backend.pid"
        fi
        pkill -f "mac-panel/backend.*app.js" || true
        echo "✅ Mac Panel 已停止"
        ;;

    restart)
        echo "🔄 重启 Mac Panel..."
        \$0 stop
        sleep 2
        \$0 start
        ;;

    status)
        echo "📊 Mac Panel 状态:"
        echo ""
        if pgrep -f "mac-panel/backend.*app.js" > /dev/null; then
            echo "✅ 服务: 运行中"
            echo "   PID: \$(pgrep -f 'mac-panel/backend.*app.js' | head -1)"
            echo "   访问: http://localhost:3001"
        else
            echo "❌ 服务: 未运行"
        fi
        ;;

    logs)
        echo "📝 最新日志:"
        tail -50 "\$PROJECT_DIR/backend/backend.log"
        ;;

    update)
        echo "🔄 更新 Mac Panel..."
        cd "\$PROJECT_DIR"
        git pull
        cd backend && npm install && npm run build
        \$0 restart
        echo "✅ 更新完成"
        ;;

    *)
        echo "Mac Panel 管理工具 v3.0"
        echo ""
        echo "用法: mac-panel {start|stop|restart|status|logs|update}"
        echo ""
        echo "命令:"
        echo "  start   - 启动服务"
        echo "  stop    - 停止服务"
        echo "  restart - 重启服务"
        echo "  status  - 查看状态"
        echo "  logs    - 查看日志"
        echo "  update  - 更新版本"
        ;;
esac
EOF

    chmod +x "$BIN_DIR/mac-panel"

    log_success "管理脚本已创建"
    log_info "使用 'mac-panel start' 启动服务"
}

# 显示安装完成信息
show_completion() {
    local LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     🎉 Mac Panel 安装成功！            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📱 访问地址：${NC}"
    echo -e "   ${BLUE}本地: http://localhost:3001${NC}"
    echo -e "   ${BLUE}局域网: http://$LOCAL_IP:3001${NC}"
    echo ""
    echo -e "${CYAN}🔑 默认管理员账号：${NC}"
    echo -e "   ${YELLOW}用户名: admin${NC}"
    echo -e "   ${YELLOW}密码: admin123${NC}"
    echo ""
    echo -e "${CYAN}⚡ 管理命令：${NC}"
    echo -e "   ${BLUE}mac-panel start${NC}   - 启动服务"
    echo -e "   ${BLUE}mac-panel stop${NC}    - 停止服务"
    echo -e "   ${BLUE}mac-panel restart${NC} - 重启服务"
    echo -e "   ${BLUE}mac-panel status${NC}  - 查看状态"
    echo -e "   ${BLUE}mac-panel logs${NC}    - 查看日志"
    echo ""
    echo -e "${YELLOW}⚠️  重要提示：${NC}"
    echo -e "   1. ${RED}首次登录后请立即修改密码${NC}"
    echo -e "   2. 访问地址: ${BLUE}http://$LOCAL_IP:3001${NC}"
    echo -e "   3. 详细文档: 查看 README.md"
    echo ""
    echo -e "${PURPLE}📚 功能特性：${NC}"
    echo -e "   ✅ 软件管理 (41款软件)"
    echo -e "   ✅ 系统监控"
    echo -e "   ✅ 网站管理"
    echo -e "   ✅ 数据库管理"
    echo -e "   ✅ 终端控制"
    echo -e "   ✅ 浏览器控制"
    echo -e "   ✅ 文件管理"
    echo ""
    echo -e "${GREEN}🚀 开始使用: mac-panel start${NC}"
    echo ""
}

# 安装前检查
pre_install_check() {
    log_step "安装前检查"

    # 检查磁盘空间
    AVAILABLE_SPACE=$(df / | tail -1 | awk '{print $4}')
    REQUIRED_SPACE=2097152 # 2GB in KB

    if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
        log_error "磁盘空间不足，至少需要 2GB 可用空间"
        exit 1
    fi

    log_success "磁盘空间检查通过"

    # 检查网络连接
    if ! ping -c 1 github.com > /dev/null 2>&1; then
        log_warn "无法连接到 GitHub，可能会影响项目克隆"
        log_info "如果克隆失败，请检查网络连接"
    else
        log_success "网络连接正常"
    fi

    # 检查是否有冲突的服务
    if pgrep -f "backend.*app.js" > /dev/null; then
        log_warn "检测到现有 Mac Panel 服务"
        read -p "是否停止现有服务并继续安装? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pkill -f "backend.*app.js" || true
            log_success "现有服务已停止"
        else
            log_error "安装已取消"
            exit 1
        fi
    fi
}

# 主函数
main() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Mac Panel 全自动安装脚本 v3.0       ║${NC}"
    echo -e "${BLUE}║   支持 macOS 12.0+                    ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""

    # 安装流程
    pre_install_check
    check_sudo
    check_macos_version
    check_homebrew
    install_required_tools
    install_nodejs
    create_user
    clone_or_update_project
    install_project_dependencies
    setup_environment
    init_database
    setup_permissions
    setup_sudoers
    create_launch_scripts
    configure_firewall
    stop_existing_services
    start_services
    test_services
    create_management_scripts
    show_completion

    echo -e "${GREEN}安装完成！享受 Mac Panel 带来的便捷！🎊${NC}"
}

# 运行主函数
main "$@"
