#!/usr/bin/env bash
# =============================================================================
#  WLED Controller - Full Installer
#  Supports: Debian / Ubuntu / Raspberry Pi OS
# =============================================================================
# Usage:
#   chmod +x install.sh
#   sudo ./install.sh
# =============================================================================

set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}${BOLD}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}${BOLD}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}${BOLD}[ERROR]${RESET} $*"; exit 1; }

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root. Try: sudo ./install.sh"
fi

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║        WLED Controller – Installer           ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ── Detect install directory (where this script lives) ───────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
info "Application directory: $APP_DIR"

# ── Detect the real user (caller behind sudo) ─────────────────────────────────
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "$USER")}"
REAL_HOME=$(eval echo "~$REAL_USER")
info "Running as: $REAL_USER (home: $REAL_HOME)"

# =============================================================================
# STEP 1 – Collect configuration from the user
# =============================================================================
echo ""
echo -e "${BOLD}── Configuration ───────────────────────────────────────────${RESET}"

read -rp "  PostgreSQL DB name    [wled]: "       INPUT_DB_NAME;       DB_NAME="${INPUT_DB_NAME:-wled}"
read -rp "  PostgreSQL DB user    [wled]: "       INPUT_DB_USER;       DB_USER="${INPUT_DB_USER:-wled}"
read -rsp " PostgreSQL DB password: "             DB_PASSWORD;         echo ""
if [[ -z "$DB_PASSWORD" ]]; then
  error "A database password is required."
fi

read -rp "  API host              [127.0.0.1]: "  INPUT_API_HOST;      API_HOST="${INPUT_API_HOST:-127.0.0.1}"
read -rp "  API port              [8000]: "        INPUT_API_PORT;      API_PORT="${INPUT_API_PORT:-8000}"
read -rp "  Frontend host         [0.0.0.0]: "    INPUT_APP_HOST;      APP_HOST="${INPUT_APP_HOST:-0.0.0.0}"
read -rp "  Frontend port         [3030]: "        INPUT_APP_PORT;      APP_PORT="${INPUT_APP_PORT:-3030}"
read -rp "  App display name      [WLED Controller]: " INPUT_APP_NAME;  APP_NAME="${INPUT_APP_NAME:-WLED Controller}"
read -rp "  Copyright name        [Your Name]: "  INPUT_COPYRIGHT;     COPYRIGHT="${INPUT_COPYRIGHT:-Your Name}"

# Service user that will run the app (defaults to the real user, NOT root)
read -rp "  Service user account  [$REAL_USER]: " INPUT_SVC_USER; SERVICE_USER="${INPUT_SVC_USER:-$REAL_USER}"

echo ""
info "Configuration summary:"
echo "  DB_NAME=$DB_NAME  DB_USER=$DB_USER  DB_HOST=localhost:5432"
echo "  API=$API_HOST:$API_PORT  Frontend=$APP_HOST:$APP_PORT"
echo "  Service will run as: $SERVICE_USER"
echo ""
read -rp "Proceed with installation? [y/N]: " CONFIRM
[[ "${CONFIRM,,}" == "y" ]] || { echo "Aborted."; exit 0; }

# =============================================================================
# STEP 2 – Ensure the service user exists on the system
# =============================================================================
echo ""
info "Checking system user '${SERVICE_USER}'…"

if id "$SERVICE_USER" &>/dev/null; then
  success "User '${SERVICE_USER}' already exists."
else
  warn "User '${SERVICE_USER}' does not exist – creating system account…"

  # Ask whether to create a full home directory or a system (no-login) account
  echo ""
  echo -e "  ${BOLD}Account type:${RESET}"
  echo -e "   ${CYAN}1)${RESET} System account  – no login shell, no home dir (recommended for services)"
  echo -e "   ${CYAN}2)${RESET} Regular account  – has a home directory and bash shell"
  read -rp "  Choose [1]: " INPUT_ACCT_TYPE
  ACCT_TYPE="${INPUT_ACCT_TYPE:-1}"

  if [[ "$ACCT_TYPE" == "2" ]]; then
    # Regular user with home dir
    useradd \
      --create-home \
      --shell /bin/bash \
      "$SERVICE_USER"
    success "Created regular user '${SERVICE_USER}' with home at /home/${SERVICE_USER}."
  else
    # System account — no login, no home dir
    useradd \
      --system \
      --no-create-home \
      --shell /usr/sbin/nologin \
      "$SERVICE_USER"
    success "Created system account '${SERVICE_USER}' (no login shell)."
  fi

  # Optional: set a password for non-system accounts so the user can log in
  if [[ "$ACCT_TYPE" == "2" ]]; then
    read -rp "  Set a password for '${SERVICE_USER}'? [y/N]: " SET_PASSWD
    if [[ "${SET_PASSWD,,}" == "y" ]]; then
      passwd "$SERVICE_USER"
    else
      warn "No password set. Account is locked until a password is assigned."
    fi
  fi
fi

# Make sure the app directory is owned by the service user
if [[ "$(stat -c '%U' "$APP_DIR")" != "$SERVICE_USER" ]]; then
  info "Transferring ownership of $APP_DIR to ${SERVICE_USER}…"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"
  success "Ownership updated."
fi

# =============================================================================
# STEP 3 – System package update
# =============================================================================
echo ""
info "Updating package list…"
apt-get update -qq

# =============================================================================
# STEP 4 – Install PostgreSQL
# =============================================================================
echo ""
info "Installing PostgreSQL…"
if command -v psql &>/dev/null; then
  success "PostgreSQL already installed: $(psql --version)"
else
  apt-get install -y -qq postgresql postgresql-contrib
  systemctl enable postgresql --quiet
  systemctl start postgresql
  success "PostgreSQL installed and started."
fi

# =============================================================================
# STEP 5 – Install Python 3 + pip + venv
# =============================================================================
echo ""
info "Installing Python 3 and pip…"
apt-get install -y -qq python3 python3-pip python3-venv python3-dev build-essential libpq-dev
success "Python $(python3 --version) ready."

# =============================================================================
# STEP 6 – Install Node.js (LTS) + npm via NodeSource
# =============================================================================
echo ""
info "Installing Node.js LTS…"
if command -v node &>/dev/null; then
  success "Node.js already installed: $(node --version)"
else
  apt-get install -y -qq curl ca-certificates gnupg
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
  success "Node.js $(node --version) / npm $(npm --version) ready."
fi

# =============================================================================
# STEP 7 – Create PostgreSQL database user and database
# =============================================================================
echo ""
info "Configuring PostgreSQL…"

# Create the role if it doesn't already exist
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  warn "DB user '${DB_USER}' already exists – skipping creation."
else
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" \
    && success "Created DB user '${DB_USER}'."
fi

# Create the database if it doesn't already exist
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  warn "Database '${DB_NAME}' already exists – skipping creation."
else
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" \
    && success "Created database '${DB_NAME}'."
fi

# Grant all privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" \
  && success "Granted privileges on '${DB_NAME}' to '${DB_USER}'."

# =============================================================================
# STEP 8 – Create Python virtual environment and install Python deps
# =============================================================================
echo ""
info "Setting up Python virtual environment in $APP_DIR/.venv …"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install --quiet --upgrade pip
"$APP_DIR/.venv/bin/pip" install --quiet -r "$APP_DIR/requirements.txt"
success "Python dependencies installed."

# =============================================================================
# STEP 9 – Install Node modules and build the frontend
# =============================================================================
echo ""
info "Installing Node.js dependencies…"
cd "$APP_DIR"
sudo -u "$SERVICE_USER" npm install --silent
success "Node modules installed."

info "Building frontend (Vite)…"
sudo -u "$SERVICE_USER" npm run build --silent
success "Frontend built into dist/."

# =============================================================================
# STEP 10 – Write the .env file
# =============================================================================
echo ""
info "Writing .env …"
cat > "$APP_DIR/.env" <<EOF
# Database
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}

# Server Config
VITE_API_HOST=${API_HOST}
VITE_API_PORT=${API_PORT}

# App Metadata
VITE_APP_NAME="${APP_NAME}"
VITE_APP_HOST=${APP_HOST}
VITE_APP_PORT=${APP_PORT}
COPYRIGHT_NAME="${COPYRIGHT}"
EOF
chown "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
success ".env written and locked to owner."

# =============================================================================
# STEP 11 – Create systemd service file for the FastAPI backend
# =============================================================================
echo ""
info "Creating systemd service: wled-backend.service …"
cat > /etc/systemd/system/wled-backend.service <<EOF
[Unit]
Description=WLED Controller – FastAPI Backend
Documentation=https://github.com/therepairguytt/wled-controller
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${APP_DIR}/.venv/bin/python -m uvicorn backend.main:app \\
    --host ${API_HOST} \\
    --port ${API_PORT} \\
    --workers 1 \\
    --no-access-log
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wled-backend

# Security hardening
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
success "wled-backend.service created."

# =============================================================================
# STEP 12 – Create systemd service file for the Vite / Node frontend
# =============================================================================
info "Creating systemd service: wled-frontend.service …"
cat > /etc/systemd/system/wled-frontend.service <<EOF
[Unit]
Description=WLED Controller – Vite Frontend
Documentation=https://github.com/therepairguytt/wled-controller
After=network.target wled-backend.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=$(which node) $(npm root -g 2>/dev/null || echo /usr/lib/node_modules)/../bin/vite preview \\
    --host ${APP_HOST} \\
    --port ${APP_PORT}
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wled-frontend

# Security hardening
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# Vite preview needs the global vite binary - rewrite ExecStart with local bin
VITE_BIN="$APP_DIR/node_modules/.bin/vite"
sed -i "s|ExecStart=.*|ExecStart=${VITE_BIN} preview --host ${APP_HOST} --port ${APP_PORT}|" \
  /etc/systemd/system/wled-frontend.service
success "wled-frontend.service created."

# =============================================================================
# STEP 13 – Enable and start both services
# =============================================================================
echo ""
info "Reloading systemd daemon…"
systemctl daemon-reload

info "Enabling services to start on boot…"
systemctl enable wled-backend.service --quiet
systemctl enable wled-frontend.service --quiet

info "Starting wled-backend…"
systemctl restart wled-backend.service
sleep 3
if systemctl is-active --quiet wled-backend.service; then
  success "wled-backend is running."
else
  warn "wled-backend failed to start. Check: journalctl -u wled-backend -n 50"
fi

info "Starting wled-frontend…"
systemctl restart wled-frontend.service
sleep 2
if systemctl is-active --quiet wled-frontend.service; then
  success "wled-frontend is running."
else
  warn "wled-frontend failed to start. Check: journalctl -u wled-frontend -n 50"
fi

# =============================================================================
# DONE
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║           Installation Complete! ✓           ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Backend API:${RESET}   http://${API_HOST}:${API_PORT}"
echo -e "  ${BOLD}Frontend UI:${RESET}   http://${APP_HOST}:${APP_PORT}"
echo ""
echo -e "  ${BOLD}Useful commands:${RESET}"
echo -e "    sudo systemctl status  wled-backend"
echo -e "    sudo systemctl status  wled-frontend"
echo -e "    sudo journalctl -u     wled-backend  -f"
echo -e "    sudo journalctl -u     wled-frontend -f"
echo -e "    sudo systemctl restart wled-backend"
echo -e "    sudo systemctl restart wled-frontend"
echo ""
