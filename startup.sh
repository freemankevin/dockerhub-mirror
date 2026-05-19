#!/bin/bash
# Registry Sync — 跨平台开发环境启动脚本
# 兼容 Linux / macOS / Windows(Git Bash / MSYS2 / WSL)

set -e

# ── Colors ────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log_info()  { echo -e "${BLUE}ℹ${RESET}  $1"; }
log_ok()    { echo -e "${GREEN}✓${RESET}  $1"; }
log_warn()  { echo -e "${YELLOW}⚠${RESET}  $1"; }
log_err()   { echo -e "${RED}✗${RESET}  $1"; }
log_step()  { echo -e "${CYAN}${BOLD}→${RESET}  $1"; }

# ── Platform & Arch ───────────────────────────
OS=$(uname -s)
ARCH=$(uname -m)

echo ""
echo -e "${BOLD}Registry Sync${RESET} — Development Server"
echo "────────────────────────────────────────"
log_info "Platform: ${OS} (${ARCH})"

# ── Check Node.js ─────────────────────────────
if ! command -v node &> /dev/null; then
    log_err "Node.js not found. Please install Node.js first."
    exit 1
fi

log_ok "Node.js $(node -v)"

# ── Detect Python (for syntax checks) ─────────
HAS_PYTHON=false
PYTHON=""
# Windows: prefer 'py' launcher (avoids Windows Store stub issues in Git Bash)
if command -v py &> /dev/null; then
    HAS_PYTHON=true
    PYTHON="py"
elif command -v python3 &> /dev/null; then
    HAS_PYTHON=true
    PYTHON="python3"
elif command -v python &> /dev/null; then
    HAS_PYTHON=true
    PYTHON="python"
fi

# ── Dependency Check ──────────────────────────
NEED_INSTALL=false

if [ ! -d "node_modules" ]; then
    NEED_INSTALL=true
    log_warn "node_modules missing"
elif [ ! -f "node_modules/.bin/tailwindcss" ] || [ ! -f "node_modules/.bin/serve" ]; then
    NEED_INSTALL=true
    log_warn "Required binaries missing"
elif [ -f "package-lock.json" ] && [ "package-lock.json" -nt "node_modules" ]; then
    NEED_INSTALL=true
    log_warn "package-lock.json changed"
fi

if [ "$NEED_INSTALL" = true ]; then
    log_step "Installing npm dependencies..."
    npm install
    log_ok "Dependencies installed"
else
    log_ok "Dependencies up to date"
fi

# ── Syntax Checks ─────────────────────────────
log_step "Running syntax checks..."

CHECKED=0

check_js() {
    local file=$1
    if [ -f "$file" ]; then
        if ! node --check "$file" 2>/dev/null; then
            log_err "Syntax error in $file"
            exit 1
        fi
        log_ok "$file"
        CHECKED=$((CHECKED + 1))
    fi
}

check_json() {
    local file=$1
    if [ -f "$file" ]; then
        if ! node -e "JSON.parse(require('fs').readFileSync('$file'))" 2>/dev/null; then
            log_warn "$file is invalid JSON"
        else
            log_ok "$file"
            CHECKED=$((CHECKED + 1))
        fi
    fi
}

check_py() {
    local file=$1
    if [ -f "$file" ] && [ "$HAS_PYTHON" = true ]; then
        if ! $PYTHON -m py_compile "$file" 2>/dev/null; then
            log_err "Syntax error in $file"
            exit 1
        fi
        log_ok "$file"
        CHECKED=$((CHECKED + 1))
    fi
}

check_js "js/app.js"
check_js "js/i18n.js"
check_json "images.json"
check_py "scripts/main.py"
check_py "scripts/cli/cli.py"

if [ $CHECKED -eq 0 ]; then
    log_warn "No files found to check"
fi

# ── Port Conflict Resolution ──────────────────
DEV_PORT=7886

log_step "Checking port ${DEV_PORT}..."

kill_port_process() {
    local port=$1
    local pid=""

    case "$OS" in
        Linux*|Darwin*)
            if command -v lsof &> /dev/null; then
                pid=$(lsof -ti :${port} 2>/dev/null || true)
            elif command -v ss &> /dev/null; then
                pid=$(ss -tlnp 2>/dev/null | grep ":${port}" | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*|Windows_NT)
            pid=$(netstat -ano 2>/dev/null | grep ":${port}" | grep LISTENING | awk '{print $5}' | head -1)
            ;;
    esac

    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
        log_warn "Port ${port} occupied by PID ${pid}, terminating..."
        case "$OS" in
            MINGW*|MSYS*|CYGWIN*|Windows_NT)
                taskkill //PID ${pid} //F 2>/dev/null || true
                ;;
            *)
                kill -9 ${pid} 2>/dev/null || true
                ;;
        esac
        sleep 1
        log_ok "Process ${pid} terminated"
    else
        log_ok "Port ${DEV_PORT} is available"
    fi
}

kill_port_process $DEV_PORT

# ── Build CSS ─────────────────────────────────
log_step "Building CSS..."
if ! npm run build:css; then
    log_err "CSS build failed"
    exit 1
fi
log_ok "CSS built"

# ── Start Dev Server ──────────────────────────
log_step "Starting server..."
echo ""
echo -e "${GREEN}${BOLD}  ┌─────────────────────────────────────┐${RESET}"
echo -e "${GREEN}${BOLD}  │  http://localhost:${DEV_PORT}           │${RESET}"
echo -e "${GREEN}${BOLD}  └─────────────────────────────────────┘${RESET}"
echo ""

npm run preview
