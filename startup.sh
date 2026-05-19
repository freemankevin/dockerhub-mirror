#!/usr/bin/env bash
# =============================================================================
# Registry Sync — Development Environment Startup Script
# =============================================================================
# Features:
#   - Auto-detect OS & architecture
#   - Check & install Node.js / npm
#   - Auto-install dependencies
#   - TypeScript type checking
#   - Port conflict detection & cleanup
#   - Start Vite dev server
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_PORT=7886
NODE_MIN_VERSION=18

# =============================================================================
# Helpers
# =============================================================================

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${CYAN}${BOLD}▶ $1${NC}"; }

print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}  ║          Registry Sync — Dev Environment Launcher            ║${NC}"
  echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# =============================================================================
# 1. Detect OS & Architecture
# =============================================================================

detect_system() {
  log_step "Detecting system environment..."

  OS=$(uname -s)
  ARCH=$(uname -m)
  OS_NAME="unknown"
  ARCH_NAME="$ARCH"

  case "$OS" in
    Linux*)     OS_NAME="linux" ;;
    Darwin*)    OS_NAME="macos" ;;
    CYGWIN*|MINGW*|MSYS*|MINGW32*|MINGW64*)
      OS_NAME="windows"
      ;;
    *)          OS_NAME="unknown" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH_NAME="x64" ;;
    arm64|aarch64) ARCH_NAME="arm64" ;;
    i386|i686)     ARCH_NAME="x86" ;;
  esac

  log_info "OS:      ${BOLD}$OS_NAME${NC} ($OS)"
  log_info "Arch:    ${BOLD}$ARCH_NAME${NC} ($ARCH)"
  log_info "Shell:   ${BOLD}$SHELL${NC}"
}

# =============================================================================
# 2. Check & Install Node.js / npm
# =============================================================================

check_node() {
  log_step "Checking Node.js environment..."

  if command -v node &>/dev/null && command -v npm &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    NPM_VERSION=$(npm -v)

    if [ "$NODE_MAJOR" -ge "$NODE_MIN_VERSION" ]; then
      log_ok "Node.js $NODE_VERSION, npm $NPM_VERSION"
      return 0
    else
      log_warn "Node.js $NODE_VERSION is too old (required >= $NODE_MIN_VERSION)"
    fi
  else
    log_warn "Node.js / npm not found"
  fi

  # Try to install Node.js
  install_node
}

install_node() {
  log_step "Installing Node.js (>= $NODE_MIN_VERSION)..."

  if command -v nvm &>/dev/null; then
    log_info "Using nvm..."
    nvm install node
    nvm use node
  elif [ "$OS_NAME" = "macos" ] && command -v brew &>/dev/null; then
    log_info "Using Homebrew..."
    brew install node
  elif [ "$OS_NAME" = "linux" ]; then
    if command -v apt-get &>/dev/null; then
      log_info "Using apt..."
      sudo apt-get update -qq
      sudo apt-get install -y -qq nodejs npm
    elif command -v yum &>/dev/null; then
      log_info "Using yum..."
      sudo yum install -y nodejs npm
    elif command -v dnf &>/dev/null; then
      log_info "Using dnf..."
      sudo dnf install -y nodejs npm
    elif command -v pacman &>/dev/null; then
      log_info "Using pacman..."
      sudo pacman -S --noconfirm nodejs npm
    else
      # Fallback: nvm
      log_info "Using nvm installer..."
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] || {
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
      }
      nvm install node
      nvm use node
    fi
  elif [ "$OS_NAME" = "windows" ]; then
    log_err "Please install Node.js manually from https://nodejs.org/ or use nvm-windows"
    exit 1
  else
    # Last resort: try to use n or fnm
    if command -v fnm &>/dev/null; then
      fnm install --lts
      fnm use --lts
    else
      log_err "Could not install Node.js automatically. Please install manually."
      exit 1
    fi
  fi

  # Verify installation
  if command -v node &>/dev/null && command -v npm &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    log_ok "Node.js installed: $NODE_VERSION"
  else
    log_err "Node.js installation failed"
    exit 1
  fi
}

# =============================================================================
# 3. Auto-install dependencies
# =============================================================================

check_dependencies() {
  log_step "Checking project dependencies..."

  if [ ! -d "node_modules" ]; then
    log_warn "node_modules not found"
    install_deps
    return
  fi

  # Check if package-lock.json or package.json is newer than node_modules
  if [ -f "package-lock.json" ]; then
    if [ "package-lock.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null || \
       [ "package.json" -nt "node_modules/.package-lock.json" ] 2>/dev/null; then
      log_warn "Dependencies may be outdated (package.json / lockfile changed)"
      install_deps
      return
    fi
  fi

  # Quick sanity check: verify react exists
  if [ ! -d "node_modules/react" ]; then
    log_warn "node_modules appears incomplete"
    install_deps
    return
  fi

  log_ok "Dependencies are up to date"
}

install_deps() {
  log_step "Installing dependencies..."
  npm install
  log_ok "Dependencies installed"
}

# =============================================================================
# 4. TypeScript type checking
# =============================================================================

check_types() {
  log_step "Running TypeScript type check..."

  if npx tsc --noEmit 2>&1; then
    log_ok "No type errors found"
  else
    log_warn "Type errors detected (see above). Continuing anyway..."
  fi
}

# =============================================================================
# 5. Port conflict detection & cleanup
# =============================================================================

cleanup_ports() {
  log_step "Checking port $DEFAULT_PORT..."

  local pid=""

  case "$OS_NAME" in
    linux|macos)
      # lsof approach
      if command -v lsof &>/dev/null; then
        pid=$(lsof -ti tcp:"$DEFAULT_PORT" 2>/dev/null || true)
      fi
      # netstat fallback
      if [ -z "$pid" ] && command -v netstat &>/dev/null; then
        pid=$(netstat -tlnp 2>/dev/null | grep ":$DEFAULT_PORT " | awk '{print $7}' | cut -d'/' -f1 | head -n1)
      fi
      # ss fallback
      if [ -z "$pid" ] && command -v ss &>/dev/null; then
        pid=$(ss -tlnp 2>/dev/null | grep ":$DEFAULT_PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -n1)
      fi
      ;;
    windows)
      # Git Bash / MSYS2
      if command -v netstat &>/dev/null; then
        pid=$(netstat -ano 2>/dev/null | grep ":$DEFAULT_PORT " | grep LISTENING | awk '{print $5}' | head -n1 || true)
      fi
      ;;
  esac

  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    log_warn "Port $DEFAULT_PORT is occupied by PID $pid"
    log_info "Killing process $pid..."

    case "$OS_NAME" in
      linux|macos)
        kill -TERM "$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
        ;;
      windows)
        taskkill //PID "$pid" //F 2>/dev/null || true
        ;;
    esac

    sleep 1

    # Verify port is free
    case "$OS_NAME" in
      linux|macos)
        if command -v lsof &>/dev/null && lsof -ti tcp:"$DEFAULT_PORT" &>/dev/null; then
          log_err "Failed to free port $DEFAULT_PORT"
          exit 1
        fi
        ;;
    esac

    log_ok "Port $DEFAULT_PORT is now free"
  else
    log_ok "Port $DEFAULT_PORT is available"
  fi

  # Also clean up any stray node processes from previous Vite sessions
  cleanup_old_processes
}

cleanup_old_processes() {
  log_step "Cleaning up old Vite/node processes..."

  local pids=""

  case "$OS_NAME" in
    linux|macos)
      pids=$(pgrep -f "vite.*$DEFAULT_PORT" 2>/dev/null || true)
      if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 0.5
        echo "$pids" | xargs kill -KILL 2>/dev/null || true
      fi
      ;;
    windows)
      # Try to find node.exe listening on the port
      if command -v wmic &>/dev/null; then
        wmic process where "name='node.exe'" get ProcessId 2>/dev/null | tail -n +2 | while read -r p; do
          [ -n "$p" ] && taskkill //PID "$p" //F 2>/dev/null || true
        done
      fi
      ;;
  esac

  log_ok "Old processes cleaned"
}

# =============================================================================
# 6. Start development server
# =============================================================================

start_server() {
  log_step "Starting Vite development server..."
  echo ""
  echo -e "${GREEN}${BOLD}  🚀 Server starting at http://localhost:$DEFAULT_PORT${NC}"
  echo -e "${GREEN}${BOLD}  📦 Press Ctrl+C to stop${NC}"
  echo ""

  npx vite --port "$DEFAULT_PORT" --host
}

# =============================================================================
# Main
# =============================================================================

main() {
  print_banner
  detect_system
  check_node
  check_dependencies
  check_types
  cleanup_ports
  start_server
}

main "$@"
