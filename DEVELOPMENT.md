# Development Guide

This guide covers building Stream Alert from source on Windows.

## Prerequisites

### Telegram Setup
- Install [Telegram](https://telegram.org/) if you don't have it
- Create a new bot using @BotFather chat in Telegram
- Use `/newbot` command and follow the instructions until you finish creating your bot
- Copy token to file `src/config/default.json` at path `telegram.token`
- Find your bot in Telegram and send a few messages to it
- Find another bot named `@userinfobot` and type `/start` there - you'll get your chat ID
- Put the chat ID into `src/config/default.json` at path `telegram.chatId`

### Camera Input Options

You need either a real physical webcam or a virtual webcam.

#### Physical Webcam
For a real physical webcam, specify its name in `src/config/default.json` at path `camera.name`.
You can get the camera name from any software that reads cameras. For example:
1. Join https://meet.google.com/ and create an instant call
2. Go to Settings > Video and check the camera list

#### OBS Virtual Camera
For screen capture, you need OBS with virtual camera feature:

1. Install [OBS](https://obsproject.com/) or use `choco install obs`
2. Launch OBS
3. Capture a window or screen you want to monitor and click `Start Virtual Camera`
4. Try to fit only the area you need to monitor:
   - Right-click on the window > `Resize output (Source size)`
   - Right-click on dark area > `Preview scaling`
5. Specify `OBS Virtual Camera` in `src/config/default.json` at path `camera.name`

### Development Tools

#### Microsoft Visual C++
- Install [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - If you installed Node.js with the installer, you can install these when prompted
- Alternative: Install [Chocolatey package manager](https://chocolatey.org/install) and run:
  ```powershell
  choco install visualstudio2017-workload-vctools
  ```
- Install [cmake](https://cmake.org/download/)

#### Node.js
- Node version 20 or [nvm](https://github.com/nvm-sh/nvm)
- Install [yarn](https://yarnpkg.com/) to manage dependencies

## Configuration

Config file is located at `src/config/default.json`, or you can use `src/config/user/[username].json` which is in gitignore.

### Configuration Options
- `diff.pixels` - Minimum number of pixels that must change to trigger a notification
- `diff.threshold` (0..1) - How significant the change should be. Lower values require bigger changes per pixel
- `telegram.spamDelay` - Time in seconds between each Telegram message
- `telegram.initialDelay` - Time in seconds before first telegram notification can be sent. E.g. prevent from spamming tg, when camera still sees you.
- `camera.frameRate` - How often (in seconds) to check for differences in video frames. 1 = 1 frame per second

## Running Locally

```bash
nvm use 20
yarn install
yarn cmake
yarn start
```

**Note**: Only 1 process can be running at the same time due to Telegram bot restrictions.

## Build Process

### Build Windows Executable

The build process involves several steps:

1. **Build native modules**: 
   ```bash
   yarn cmake
   ```
   - Builds Node.js native modules to `build/Debug/native.node`

2. **Compile TypeScript**:
   ```bash
   yarn nest
   ```
   - Converts TypeScript to CommonJS while preserving NestJS decorators
   - Outputs to `dist` directory

3. **Bundle dependencies**:
   ```bash
   yarn esbuild
   ```
   - Bundles main file `dist/sea.js` with its dependency tree into `dist/sea-bundle.js`
   - Note: esbuild doesn't work with NestJS decorators, so NestJS build is required first

4. **Create executable**:
   ```bash
   yarn native
   ```
   - Creates `dist/stream-alert.exe` from `dist/sea-bundle.js` and other files specified in `sea-config.json`

### Complete Build Command

```bash
yarn build
```


## Debugging

### Typescript file

- Use `yarn debug` and you can open debugger at chrome://inspect, or just you your ide with `yarn start`
- Check `src/config/default.json` for configuration issues
- Verify Telegram bot token and chat ID are correct
- Ensure camera name matches exactly what's available on your system


### C++ files

Native addon is already built in debug mode. The project is build using MS Visual ++, which means it produces the build in debug folder which is compatible with `cdb`.
Run `yarn start`, and then attach to a remote process (this nodejs process) from Visual ++, it should automatically pull debug symbols and breakpoint should work.