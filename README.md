# Stream Alert

Get a Telegram notification when your webcam or screen changes on Windows OS.

## Quick Start

1. **Download the executable** from [GitHub Releases](https://github.com/akoidan/stream-alert/releases)
2. **Run the executable** - it will guide you through the setup
3. **Configure your Telegram bot** when prompted

## Setup Requirements

### Telegram Bot
- You'll need a Telegram bot to receive notifications
- The app will guide you through creating one with `@BotFather`
- You'll also get your chat ID from `@userinfobot`

### Camera Options
- **Webcam**: Use your physical webcam
- **Virtual Camera**: Use OBS Virtual Camera for screen monitoring

### OBS Virtual Camera Setup (for screen monitoring)
1. Install [OBS](https://obsproject.com/) or run `choco install obs`
2. Launch OBS and capture the window/screen you want to monitor
3. Click `Start Virtual Camera`

## How It Works

The app monitors your camera feed and sends Telegram alerts when:
- The camera feed changes significantly
- Configurable sensitivity and delay prevent spam notifications

## Configuration

When you first run the app, you'll be asked to configure:
- **Bot Token**: Get this from @BotFather
- **Chat ID**: Get this from @userinfobot  
- **Alert Delay**: Minimum time between alerts (10+ seconds recommended)
- **Alert Message**: Custom message for notifications
- **Camera**: You can get the name e.g. -> https://meet.google.com/ and create an instant call ->  Settings > Video and check the camera list
- **Frame Rate**: How often to check for changes (1-5 FPS recommended)
- **Sensitivity**: How much change triggers an alert (try 0.1)

## Development

For developers who want to build from source, see [DEVELOPMENT.md](DEVELOPMENT.md)
