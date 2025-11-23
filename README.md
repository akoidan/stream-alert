# Stream Alert

Get a Telegram notification when your webcam or screen changes on Windows OS.

## Table of Contents

- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [Camera Setup](#camera-setup)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Quick Start

1. **Download the executable** from [GitHub Releases](https://github.com/akoidan/stream-alert/releases)
2. **Run the executable** - it will guide you through the setup
3. **Configuration** - after setup finishes, it generates `stream-alert.json`. See [CONFIG.md](./CONFIG.md) for documentation

## Requirements

- **Windows OS**
- **Webcam** (physical or virtual)
- **Telegram** account

## Camera Setup

### Option 1: Physical Webcam
Use your built-in or USB webcam directly.

### Option 2: OBS Virtual Camera (for screen monitoring)
1. Install [OBS](https://obsproject.com/) or run `choco install obs`
2. Launch OBS and capture the window/screen you want to monitor
3. Click `Start Virtual Camera`

## How It Works

The app monitors your camera feed and sends Telegram alerts when:
- The camera feed changes significantly
- Configurable sensitivity and delay prevent spam notifications

## Configuration

When you first run the app, you'll be asked to configure:
- **Bot Token**: Get from Telegram bot `@BotFather`
- **Chat ID**: Get from Telegram bot `@userinfobot`  
- **Alert Delay**: Minimum time between alerts (10+ seconds recommended)
- **Alert Message**: Custom message for notifications
- **Camera**: Choose from available cameras
- **Frame Rate**: How often to check for changes (1-5 FPS recommended)
- **Sensitivity**: How much change triggers an alert (try 0.1)

## Troubleshooting

- **No Telegram notifications**: Verify bot token and chat ID are correct
- **Too many notifications**: Increase alert delay or sensitivity
- **Too few notifications**: Decrease sensitivity or alert delay

## Development

For developers who want to build from source, see [DEVELOPMENT.md](DEVELOPMENT.md)
