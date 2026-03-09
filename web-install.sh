#!/bin/bash

################################################################################
# Mac Panel 网络一键安装脚本 v3.0
# 可以直接从网络下载并运行
# 使用方法: curl -fsSL https://raw.githubusercontent.com/hnbwww/mac-panel/master/web-install.sh | sudo bash
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
GITHUB_REPO="https://github.com/hnbwww/mac-panel.git"
GITHUB_RAW="https://raw.githubusercontent.com/hnbwww/mac-panel/master"

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

# 克隆或检查项目（支持断点续装）
clone_project() {
    log_step "检查项目"

    # 检查git
    if ! command -v git &> /dev/null; then
        log_info "安装 git..."
        brew install git > /dev/null 2>&1
    fi

    # 检查项目目录是否存在
    if [ -d "$PROJECT_DIR" ]; then
        log_info "项目目录已存在: $PROJECT_DIR"

        # 检查是否为有效的项目目录
        if [ -f "$PROJECT_DIR/package.json" ] || [ -f "$PROJECT_DIR/backend/package.json" ] || [ -f "$PROJECT_DIR/README.md" ]; then
            log_success "检测到有效的项目目录，跳过克隆"
            log_info "如需重新克隆，请先删除目录: sudo rm -rf $PROJECT_DIR"
        else
            log_warn "目录存在但不是有效的项目目录"
            read -p "是否删除并重新克隆? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "520131" | sudo -S rm -rf "$PROJECT_DIR"
            else
                log_error "安装已取消"
                exit 1
            fi
        fi
    fi

    # 如果目录不存在，执行克隆
    if [ ! -d "$PROJECT_DIR" ]; then
        log_info "📥 正在从 GitHub 克隆项目..."
        log_info "仓库地址: $GITHUB_REPO"

        # 设置 HTTP 版本避免 HTTP2 问题
        export GIT_HTTP_VERSION=1.1

        if git clone --depth 1 "$GITHUB_REPO" "$PROJECT_DIR"; then
            log_success "项目克隆成功"
        else
            log_error "项目克隆失败"
            log_error "请检查: 1. 网络是否正常 2. 是否需要代理"
            log_error "或手动下载项目放入: $PROJECT_DIR"
            exit 1
        fi
    fi

    cd "$PROJECT_DIR"
}

# 安装依赖并构建（支持断点续装）
install_and_build() {
    log_step "安装依赖并构建"

    cd "$PROJECT_DIR/backend"

    # 安装后端依赖（如果 node_modules 已存在则跳过）
    if [ -d "node_modules" ]; then
        log_info "后端依赖已存在，跳过安装"
    else
        log_info "📦 安装后端依赖..."
        npm install --production=false > /dev/null 2>&1
        log_success "后端依赖安装完成"
    fi

    # 构建后端（如果 dist 目录已存在则跳过）
    if [ -d "dist" ] && [ -n "$(ls -A dist 2>/dev/null)" ]; then
        log_info "后端已构建，跳过"
    else
        log_info "🔨 构建后端..."
        npm run build > /dev/null 2>&1
        log_success "后端构建完成"
    fi

    cd "$PROJECT_DIR/frontend"

    # 安装前端依赖（如果 node_modules 已存在则跳过）
    if [ -d "node_modules" ]; then
        log_info "前端依赖已存在，跳过安装"
    else
        log_info "📦 安装前端依赖..."
        npm install > /dev/null 2>&1
        log_success "前端依赖安装完成"
    fi

    # 构建前端（如果 dist 目录已存在则跳过）
    if [ -d "dist" ] && [ -n "$(ls -A dist 2>/dev/null)" ]; then
        log_info "前端已构建，跳过"
    else
        log_info "🔨 构建前端..."
        npm run build > /dev/null 2>&1
        log_success "前端构建完成"
    fi
}

# 配置环境（支持断点续装）
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
    else
        log_info "后端环境配置已存在，跳过"
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
    else
        log_info "前端环境配置已存在，跳过"
    fi
}

# 初始化数据库（支持断点续装）
init_database() {
    log_step "初始化数据库"

    cd "$PROJECT_DIR/backend"

    # 创建数据目录
    mkdir -p data data/backups data/uploads

    # 检查数据库文件
    if [ ! -f "data/db.json" ]; then
        cat > data/db.json << DBEOF
{
  "users": [],
  "roles": [
    {"id": "role_admin", "name": "Administrator", "description": "系统管理员", "permissions": ["*"], "created_at": "2026-03-05T16:19:02.000Z"},
    {"id": "role_user", "name": "User", "description": "普通用户", "permissions": ["read"], "created_at": "2026-03-05T16:19:02.000Z"}
  ],
  "websites": [],
  "software_configs": [],
  "tasks": [],
  "notifications": [],
  "settings": {}
}
DBEOF
        log_success "数据库文件已创建"
    else
        if ! grep -q '"roles"' data/db.json; then
            log_info "添加缺失的 roles 数据..."
            python3 << 'PYEOF'
import json
with open('data/db.json', 'r') as f:
    db = json.load(f)
db['roles'] = [
    {"id": "role_admin", "name": "Administrator", "description": "系统管理员", "permissions": ["*"], "created_at": "2026-03-05T16:19:02.000Z"},
    {"id": "role_user", "name": "User", "description": "普通用户", "permissions": ["read"], "created_at": "2026-03-05T16:19:02.000Z"}
]
with open('data/db.json', 'w') as f:
    json.dump(db, f, indent=2)
PYEOF
            log_success "roles 数据已添加"
        fi
        log_info "数据库已存在，跳过初始化"
    fi
