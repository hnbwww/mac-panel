#!/bin/bash

################################################################################
# Mac Panel 网络一键安装脚本 v3.0
# 可以直接从网络下载并运行
# 使用方法: curl -fsSL https://raw.githubusercontent.com/HYweb3/mac-panel/master/web-install.sh | sudo bash
################################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 全局变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="/opt/mac-panel"
GITHUB_REPO="https://github.com/HYweb3/mac-panel.git"
GITHUB_RAW="https://raw.githubusercontent.com/HYweb3/mac-panel/master"

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

# 检查sudo权限
check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        if ! command -v sudo &> /dev/null; then
            log_error "需要管理员权限，但系统未安装 sudo"
            exit 1
        fi
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

    log_info "检测到 macOS 版本: $MACOS_VERSION"

    if [ "$MACOS_MAJOR" -lt 12 ]; then
        log_error "需要 macOS 12.0 或更高版本"
        exit 1
    fi

    log_success "系统版本检查通过"
}

# 安装Homebrew
install_homebrew() {
    log_step "检查 Homebrew"

    if ! command -v brew &> /dev/null; then
        log_info "📦 正在安装 Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        if [[ -x "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
            log_success "Homebrew 安装成功"
        else
            log_error "Homebrew 安装失败"
            exit 1
        fi
    else
        log_success "Homebrew 已安装: $(brew --version | head -1)"
        brew update > /dev/null 2>&1 || true
    fi
}

# 安装Node.js
install_nodejs() {
    log_step "安装 Node.js"

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(node --version | cut -d. -f1 | cut -d'v' -f2)
        log_info "Node.js 已安装: $NODE_VERSION"

        if [ "$NODE_MAJOR" -lt 18 ]; then
            log_info "正在更新 Node.js..."
            brew reinstall node@18 > /dev/null 2>&1 || brew install node@18 > /dev/null 2>&1
            brew link --overwrite node@18 > /dev/null 2>&1 || true
            log_success "Node.js 已更新"
        else
            log_success "Node.js 版本满足要求"
        fi
    else
        log_info "📦 正在安装 Node.js..."
        brew install node@18 > /dev/null 2>&1 || brew install node > /dev/null 2>&1
        log_success "Node.js 安装成功: $(node --version)"
    fi

    # 配置npm
    npm config set registry https://registry.npmmirror.com > /dev/null 2>&1 || true
    npm config set fund false > /dev/null 2>&1 || true
}

# 创建用户
create_user() {
    log_step "创建服务用户"

    USERNAME="macpanel"

    if id "$USERNAME" &>/dev/null; then
        log_info "用户 $USERNAME 已存在"
        if groups "$USERNAME" | grep -q admin; then
            log_success "用户已在 admin 组"
        else
            sudo dseditgroup -o edit -t "$USERNAME" admin
            log_success "用户已添加到 admin 组"
        fi
    else
        log_info "创建用户: $USERNAME"
        PASSWORD=$(openssl rand -base64 16)

        sudo sysadminctl -addUser "$USERNAME" \
            -fullName "Mac Panel Service User" \
            -password "$PASSWORD" \
            -admin 2>/dev/null || {
            # 备用方法
            sudo dscl . create /Users/"$USERNAME"
            sudo dscl . create /Users/"$USERNAME" RealName "Mac Panel Service User"
            sudo dscl . create /Users/"$USERNAME" passwd "$PASSWORD"
            sudo dscl . create /Users/"$USERNAME" PrimaryGroupID 80
            sudo dscl . create /Users/"$USERNAME" UniqueID 500
            sudo dscl . create /Users/"$USERNAME" UserShell /bin/bash
            sudo dscl . create /Users/"$USERNAME" NFSHomeDirectory /Users/"$USERNAME"
            sudo mkdir -p /Users/"$USERNAME"
            sudo chown "$USERNAME":/Users/"$USERNAME"
            sudo dseditgroup -o edit -a "$USERNAME" admin
        }

        log_success "用户创建成功"
    fi
}

# 克隆项目
clone_project() {
    log_step "下载 Mac Panel 项目"

    # 检查git
    if ! command -v git &> /dev/null; then
        log_info "安装 git..."
        brew install git > /dev/null 2>&1
    fi

    # 克隆项目
    if [ -d "$PROJECT_DIR" ]; then
        log_warn "项目目录已存在"
        read -p "是否删除并重新安装? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf "$PROJECT_DIR"
        else
            log_error "安装已取消"
            exit 1
        fi
    fi

    log_info "📥 正在从 GitHub 克隆项目..."
    if git clone "$GITHUB_REPO" "$PROJECT_DIR" 2>/dev/null; then
        log_success "项目克隆成功"
    else
        log_error "项目克隆失败"
        exit 1
    fi

    cd "$PROJECT_DIR"
}

# 安装依赖并构建
install_and_build() {
    log_step "安装依赖并构建"

    # 安装后端依赖
    log_info "📦 安装后端依赖..."
    cd "$PROJECT_DIR/backend"
    npm install --production=false > /dev/null 2>&1
    log_success "后端依赖安装完成"

    # 构建后端
    log_info "🔨 构建后端..."
    npm run build > /dev/null 2>&1
    log_success "后端构建完成"

    # 安装前端依赖
    log_info "📦 安装前端依赖..."
    cd "$PROJECT_DIR/frontend"
    npm install > /dev/null 2>&1
    log_success "前端依赖安装完成"

    # 构建前端
    log_info "🔨 构建前端..."
    npm run build > /dev/null 2>&1
    log_success "前端构建完成"
}

# 配置环境
setup_environment() {
    log_step "配置环境"

    cd "$PROJECT_DIR"

    # 检查是否存在.env文件
    if [ ! -f "backend/.env" ]; then
        # 获取本机IP
        LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

        cat > backend/.env << EOF
NODE_ENV=production
PORT=3001
FRONTEND_PORT=5175
ALLOWED_HOSTS=localhost,127.0.0.1,$LOCAL_IP
DB_PATH=./data/db.json
LOG_LEVEL=info
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
EOF

        log_success "后端环境配置完成"
    fi

    # 前端环境配置
    if [ ! -f "frontend/.env" ]; then
        cat > frontend/.env << EOF
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_TERMINAL_WS_URL=ws://localhost:3002/ws/terminal
VITE_BROWSER_WS_URL=ws://localhost:3003/ws/browser
EOF
        log_success "前端环境配置完成"
    fi
}

# 初始化数据库
init_database() {
    log_step "初始化数据库"

    cd "$PROJECT_DIR/backend"

    # 创建数据目录
    mkdir -p data data/backups data/uploads

    # 检查数据库文件
    if [ ! -f "data/db.json" ]; then
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
    fi
}

# 配置权限
setup_permissions() {
    log_step "配置权限"

    cd "$PROJECT_DIR"

    if id macpanel &>/dev/null; then
        sudo chown -R macpanel:staff .
    else
        log_warn "macpanel 用户不存在，使用当前用户"
    fi

    chmod -R 755 .
    chmod 775 backend/data
    chmod 644 backend/data/*.json 2>/dev/null || true
    mkdir -p backend/logs backend/uploads
    chmod 775 backend/logs backend/uploads

    log_success "权限配置完成"
}

# 配置sudoers
setup_sudoers() {
    log_step "配置 Sudoers"

    if ! id macpanel &>/dev/null; then
        log_warn "用户 macpanel 不存在，跳过 sudoers 配置"
        return
    fi

    SUDOERS_FILE="/etc/sudoers.d/mac-panel"

    sudo tee "$SUDOERS_FILE" > /dev/null << EOF
# Mac Panel Sudoers Configuration
macpanel ALL=(ALL) NOPASSWD: /bin/launchctl kickstart -k gui/\$(id -u macpanel) com.github.macpanel.backend
macpanel ALL=(ALL) NOPASSWD: /opt/homebrew/bin/brew services *
macpanel ALL=(ALL) NOPASSWD: /opt/homebrew/bin/nginx -s *
macpanel ALL=(ALL) NOPASSWD: /usr/bin/ps
macpanel ALL=(ALL) NOPASSWD: /usr/bin/kill *
EOF

    sudo chmod 440 "$SUDOERS_FILE"
    sudo visudo -c -f "$SUDOERS_FILE" > /dev/null 2>&1 || {
        log_error "Sudoers 配置语法错误"
        sudo rm -f "$SUDOERS_FILE"
        exit 1
    }

    log_success "Sudoers 配置完成"
}

# 创建启动脚本
create_launch_scripts() {
    log_step "创建启动脚本"

    # 创建快速启动脚本
    cat > "$PROJECT_DIR/start.sh" << 'EOF'
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
export NODE_ENV=production
nohup node dist/app.js > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

sleep 2

if ps -p $BACKEND_PID > /dev/null; then
    echo "✅ Mac Panel 已启动"
    echo "📱 访问地址: http://localhost:3001"
else
    echo "❌ 启动失败，请检查日志"
    cat backend.log
    exit 1
fi
EOF

    chmod +x "$PROJECT_DIR/start.sh"
    log_success "启动脚本已创建"
}

# 配置防火墙
configure_firewall() {
    log_step "配置防火墙"

    if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -q "enabled: 1"; then
        log_info "添加防火墙规则..."
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add 3001 2>/dev/null || true
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on 2>/dev/null || true
        log_success "防火墙规则已添加"
    else
        log_info "防火墙未启用"
    fi
}

# 创建管理脚本
create_management_scripts() {
    log_step "创建管理命令"

    cat > /usr/local/bin/mac-panel << 'EOF'
#!/bin/bash
PROJECT_DIR="/opt/mac-panel"
ACTION="$1"

case "$ACTION" in
    start)
        echo "🚀 启动 Mac Panel..."
        cd "$PROJECT_DIR/backend"
        export NODE_ENV=production
        nohup node dist/app.js > backend.log 2>&1 &
        echo $! > backend.pid
        echo "✅ Mac Panel 已启动"
        echo "📱 访问: http://localhost:3001"
        ;;
    stop)
        echo "⏹️  停止 Mac Panel..."
        if [ -f "$PROJECT_DIR/backend/backend.pid" ]; then
            kill $(cat "$PROJECT_DIR/backend/backend.pid") 2>/dev/null || true
            rm -f "$PROJECT_DIR/backend/backend.pid"
        fi
        pkill -f "mac-panel/backend.*app.js" || true
        echo "✅ Mac Panel 已停止"
        ;;
    restart)
        echo "🔄 重启 Mac Panel..."
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        echo "📊 Mac Panel 状态:"
        if pgrep -f "mac-panel/backend.*app.js" > /dev/null; then
            echo "✅ 运行中"
            echo "   访问: http://localhost:3001"
        else
            echo "❌ 未运行"
        fi
        ;;
    logs)
        echo "📝 最新日志:"
        tail -50 "$PROJECT_DIR/backend/backend.log"
        ;;
    update)
        echo "🔄 更新 Mac Panel..."
        cd "$PROJECT_DIR"
        git pull
        cd backend && npm install && npm run build
        $0 restart
        echo "✅ 更新完成"
        ;;
    *)
        echo "Mac Panel 管理工具"
        echo ""
        echo "用法: mac-panel {start|stop|restart|status|logs|update}"
        ;;
esac
EOF

    chmod +x /usr/local/bin/mac-panel
    log_success "管理命令已创建: mac-panel"
}

# 启动服务
start_services() {
    log_step "启动服务"

    cd "$PROJECT_DIR/backend"

    # 停止现有服务
    pkill -f "mac-panel/backend.*app.js" || true
    sleep 1

    # 启动后端
    export NODE_ENV=production
    nohup node dist/app.js > backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > backend.pid

    sleep 3

    # 验证服务
    if curl -s http://localhost:3001/health > /dev/null; then
        log_success "后端服务启动成功"
    else
        log_error "后端服务启动失败"
        tail -20 backend.log
        exit 1
    fi
}

# 显示完成信息
show_completion() {
    local LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     🎉 Mac Panel 安装成功！              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📱 访问地址：${NC}"
    echo -e "   ${BLUE}本地: http://localhost:3001${NC}"
    echo -e "   ${BLUE}局域网: http://$LOCAL_IP:3001${NC}"
    echo ""
    echo -e "${CYAN}🔑 默认账号：${NC}"
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
    echo -e "   2. 详细文档: $PROJECT_DIR/README.md"
    echo ""
    echo -e "${GREEN}🚀 立即开始: mac-panel start${NC}"
    echo ""
}

# 主函数
main() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Mac Panel 网络一键安装 v3.0              ║${NC}"
    echo -e "${BLUE}║   支持 macOS 12.0+                        ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""

    # 安装流程
    check_sudo
    check_macos_version
    install_homebrew
    install_nodejs
    create_user
    clone_project
    install_and_build
    setup_environment
    init_database
    setup_permissions
    setup_sudoers
    create_launch_scripts
    configure_firewall
    start_services
    create_management_scripts
    show_completion

    echo -e "${GREEN}网络一键安装完成！🎊${NC}"
}

# 运行主函数
main "$@"
