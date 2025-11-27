# Development Guide

This guide covers building Stream Alert from source on Windows.

## Prerequisites

### Telegram Setup
- Install [Telegram](https://telegram.org/) if you don't have it
- Create a new bot using @BotFather chat in Telegram
- Use `/newbot` command and follow the instructions until you finish creating your bot
- Copy token to file `stream-alert.json` at path `telegram.token`
- Find your bot in Telegram and send a few messages to it
- Find another bot named `@userinfobot` and type `/start` there - you'll get your chat ID
- Put the chat ID into `stream-alert.json` at path `telegram.chatId`

### Camera Input Options

You need either a real physical webcam or a virtual webcam.

#### Physical Webcam
For a real physical webcam, specify its name in `stream-alert.json` at path `camera.name`.

#### OBS Virtual Camera
For screen capture, you need OBS with virtual camera feature:

1. Install [OBS](https://obsproject.com/) or use `choco install obs`
2. Launch OBS
3. Capture a window or screen you want to monitor and click `Start Virtual Camera`
4. Try to fit only the area you need to monitor:
   - Right-click on the window > `Resize output (Source size)`
   - Right-click on dark area > `Preview scaling`
5. Specify `OBS Virtual Camera` in `stream-alert.json` at path `camera.name`

## Development Tools


### Windows
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


## Linux
Required packages:
 - v4l-utils 
 - libjpeg-turbo
 - cmake 
 - make 
 - yarn 
 - ninja 
 - nvm 
 - g++ 
 
## Architecture Overview

### Video Capture Implementation

Stream Alert uses platform-specific video capture implementations with different architectural models:

#### Linux Implementation (V4L2)
- **Model**: Pull-based, synchronous frame reading
- **Key Functions**:
  - `LinuxCapture::GetFrame()` - Blocks on `select()` until frame ready
  - `VIDIOC_DQBUF` - Dequeues filled buffer from camera
  - `VIDIOC_QBUF` - Returns empty buffer to camera
  - `VIDIOC_S_PARM` - Sets camera framerate via V4L2
- **Threading**: Custom thread with `sleep_for()` to control FPS
- **Buffer Management**: Memory-mapped buffers managed by application

#### Win32 Implementation (DirectShow)
- **Model**: Push-based, asynchronous callback system
- **Key Functions**:
  - `SampleGrabberCallback::SampleCB()` - DirectShow calls when frame arrives
  - `ISampleGrabber::SetCallback()` - Registers callback with DirectShow
  - `DispatchFrame()` - Applies FPS limiting and calls JavaScript
- **Threading**: DirectShow manages threads, callbacks run on DirectShow thread
- **Buffer Management**: DirectShow handles buffer lifecycle

#### Common Flow
1. **Native Layer**: Platform-specific capture (V4L2/DirectShow)
2. **N-API Bridge**: Thread-safe callbacks to JavaScript via `Napi::ThreadSafeFunction`
3. **Stream Service**: Receives frames and calls `frameListener.onNewFrame()`
4. **App Service**: Processes frames for motion detection and Telegram alerts

### Frame Processing Pipeline
- **Format Conversion**: YUYV/MJPEG/GREY → RGB24
- **Motion Detection**: Pixel difference analysis via ImageLib service
- **Rate Limiting**: FPS control at both native and application levels
- **Telegram Integration**: Async image upload when motion detected

## Configuration

Config file is located at `stream-alert.json`, or you can use `src/config/user/[username].json` which is in gitignore.

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
   - Builds Node.js native modules to `build/Release/native.node`

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
- Check `stream-alert.json` for configuration issues
- Verify Telegram bot token and chat ID are correct
- Ensure camera name matches exactly what's available on your system


### C++ files
Yarn `yarn cmake:debug`, this will output `build/Debug/native.node`, which will be loaded automatically.
The project is build using MS Visual ++, which means it produces the build in debug folder which is compatible with `cdb`.
Run `yarn start`, and then attach to a remote process (this nodejs process) from Visual ++, it should automatically pull debug symbols and breakpoint should work.