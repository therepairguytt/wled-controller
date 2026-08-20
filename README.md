# WLED Controller

A web-based dashboard for managing WLED LED controllers — built with FastAPI (Python) + React (Vite) + PostgreSQL.

---

## Quick Install (Linux / Raspberry Pi)

> **Requires:** Debian, Ubuntu, or Raspberry Pi OS (64-bit recommended)

```bash
# 1. Clone the repository
git clone https://github.com/therepairguytt/wled-controller.git
cd wled-controller

# 2. Make the installer executable
chmod +x install.sh

# 3. Run as root
sudo ./install.sh
```

The installer will interactively ask you for:
- PostgreSQL database name, user, and password
- API host / port (default `127.0.0.1:8000`)
- Frontend host / port (default `0.0.0.0:3030`)
- App display name and copyright text
- The system user account that the services will run as

### What the installer does

| Step | Action |
|------|--------|
| 1 | Updates `apt` package list |
| 2 | Installs **PostgreSQL** |
| 3 | Installs **Python 3**, `pip`, `venv` |
| 4 | Installs **Node.js LTS** + `npm` via NodeSource |
| 5 | Creates the PostgreSQL **DB user** and **database** |
| 6 | Creates a Python **virtual environment** and installs pip dependencies |
| 7 | Runs `npm install` and `npm run build` to produce the frontend bundle |
| 8 | Writes the `.env` file with your chosen configuration |
| 9 | Creates `wled-backend.service` (FastAPI/Uvicorn) |
| 10 | Creates `wled-frontend.service` (Vite preview) |
| 11 | Enables and starts both services |

---

## Service Management

```bash
# Status
sudo systemctl status wled-backend
sudo systemctl status wled-frontend

# Live logs
sudo journalctl -u wled-backend  -f
sudo journalctl -u wled-frontend -f

# Restart
sudo systemctl restart wled-backend
sudo systemctl restart wled-frontend

# Stop / Disable
sudo systemctl stop    wled-backend
sudo systemctl disable wled-backend
```

---

## Manual Setup (Development)

```bash
# 1. Copy and edit the env file
cp .env.example .env
nano .env

# 2. Create a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Start the FastAPI backend
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# 4. In a separate terminal, start the Vite dev server
npm install
npm run dev
```

## License

See [LICENSE](LICENSE) for details.