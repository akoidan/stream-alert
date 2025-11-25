[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/deathangel908/lines-logger/blob/master/LICENSE) [![Coverage](https://coveralls.io/repos/github/akoidan/stream-alert/badge.svg?branch=main)](https://coveralls.io/github/akoidan/stream-alert?branch=main) [![Build Status](https://github.com/akoidan/stream-alert/actions/workflows/build.yaml/badge.svg?branch=main)](https://github.com/akoidan/stream-alert/actions/workflows/build.yaml)

# Stream Alert

Get a Telegram notification when your webcam or screen changes

Supported platforms:
 - linux
 - windows


## Quick Start

1. **Download the executable** from [GitHub Releases](https://github.com/akoidan/stream-alert/releases)
2. **Run the executable** - it will guide you through the setup
3. **Configuration** - after setup finishes, it generates `stream-alert.json`. See [CONFIG.md](./CONFIG.md) for documentation


## Camera Setup

### Option 1: Physical Webcam
Use your built-in or USB webcam directly.

### Option 2: Screen Capture
1. Install [OBS](https://obsproject.com/) or run `choco install obs`
2. Launch OBS and capture the window/screen you want to monitor
3. Click `Start Virtual Camera`

## Linux
`libjpeg` and `v4l-utils` are required to be installed on Linux systems.

## How It Works

The app monitors your camera feed and sends Telegram alerts when:
- The camera feed changes significantly
- Configurable sensitivity and delay prevent spam notifications

For developers who want to build from source, see [DEVELOPMENT.md](DEVELOPMENT.md)
