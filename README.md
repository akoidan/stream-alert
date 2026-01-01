[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/deathangel908/lines-logger/blob/master/LICENSE) [![Coverage](https://coveralls.io/repos/github/akoidan/stream-alert/badge.svg?branch=main)](https://coveralls.io/github/akoidan/stream-alert?branch=main) [![Build Status](https://github.com/akoidan/stream-alert/actions/workflows/build.yaml/badge.svg?branch=main)](https://github.com/akoidan/stream-alert/actions/workflows/build.yaml)

# Stream Alert

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/deathangel908/lines-logger/blob/master/LICENSE)
[![Coverage](https://coveralls.io/repos/github/akoidan/stream-alert/badge.svg?branch=main)](https://coveralls.io/github/akoidan/stream-alert?branch=main)
[![Build Status](https://github.com/akoidan/stream-alert/actions/workflows/build.yaml/badge.svg?branch=main)](https://github.com/akoidan/stream-alert/actions/workflows/build.yaml)

Get Telegram notifications when your webcam or screen changes.

---
## For Ubuntu/Debian Users

### Installation
1. Download the latest `.deb` package from [GitHub Releases](https://github.com/akoidan/stream-alert/releases)
2. Install using dpkg:
   ```bash
   sudo add-apt-repository universe
   sudo apt-get update
   sudo apt-get install v4l-utils libv4l2rds0
   sudo dpkg -i stream-alert.deb
   ```

### Configuration
1. Run the application:
   ```bash
   stream-alert
   ```
2. Follow the setup wizard to configure your camera and Telegram bot
3. Configuration is saved to: `~/.local/share/stream-alert/config.json`

### Run as Service
1. Start the service from a regular user:
   ```bash
   systemctl --user start stream-alert.service
   ```
2. Check status: `systemctl --user status stream-alert.service` or logs with `journalctl --user stream-alert.service`

---

## For Arch Linux Users

### Installation
```bash
yay -S stream-alert
```

### Configuration
1. Run the application:
   ```bash
   stream-alert
   ```
2. Follow the setup wizard

### Run as Service
1. Enable user service:
   ```bash
   systemctl --user start stream-alert.service
   ```
2. Check status: `systemctl --user status stream-alert.service` or logs with `journalctl --user stream-alert.service`

---

## For Generic Linux Users

### Installation
1. Download `stream-alert.elf` from [GitHub Releases](https://github.com/akoidan/stream-alert/releases)
2. Make it executable:
   ```bash
   chmod +x stream-alert.elf
   ```

### Configuration
1. Run the application:
   ```bash
   ./stream-alert.elf
   ```
2. Follow the setup wizard
3. Configuration will be saved to: `./stream-alert.json`

---

## For Windows Users

### Installation
1. Download the latest `.exe` application from [GitHub Releases](https://github.com/akoidan/stream-alert/releases)

### Input device
For webcamera capture nothing is required. For screen monitoring setup OBS:
1. Install [OBS](https://obsproject.com/) or run `choco install obs`
2. Launch OBS and capture the window/screen you want to monitor
3. Click `Start Virtual Camera`

### Configuration
1. Launch Stream Alert from Start Menu or run `stream-alert.exe`
2. Follow the setup wizard
3. Configuration is saved as `stream-alert.json` in the current directory

---

## How It Works

Stream Alert monitors your camera feed and sends Telegram alerts when:
- Motion is detected (configurable sensitivity)
- The camera feed changes significantly
- Customizable delay prevents notification spam

## Development

For building from source, see [DEVELOPMENT.md](DEVELOPMENT.md)
