# Stream Alert

Get a telegram notification when your webcamera or screen changes on Windows OS.

## Get started


### Telegram
- Install [telegram](https://telegram.org/) if you dont have it
- Create a new bot using @botfather chat in telegram
- use `/newbot` command there and keep going until you finish creating your bot
- copy token to file `src/config/default.json` at path to `telegram.token`
- Find your bot in the telegram and post a few messages there
- Find another bot named `@userinfobot` and type start there, you will get Id, this is id of your chat, put it into `src/config/default.json` at path to `telegram.chatId` 

### Input Camera 

You need either real physical webcamera or some virtual webcamera

#### Web camera
For real physical web camera specify its name in `src/config/default.json` at path `camera`.
You can get the camera name from any software that read camera. E.g. you join https://meet.google.com/ create an instanc call, go to settings -> video and check camera list

#### OBS Virtual camera
For screen capture you need OBS with streaming as a camera feature

- Install [OBS](https://obsproject.com/) or use `choco install obs`
- Launch OBS 
- Capture a window or screen you want to monitor and click `Start Virtual Camera`
- Try to fit only the area you need to monitor. Use `m2` on the window reactanble->`resize output (Source size)`. m2 on dark area -> `preview scaling`
- Specify `OBS Virtual Camera` in `src/config/default.json` at path `camera`.


### MS Visual C++
- [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/). If you installed nodejs with the installer, you can install these when prompted.
- An alternate way is to install the [Chocolatey package manager](https://chocolatey.org/install), and run `choco install visualstudio2017-workload-vctools` in an Administrator Powershell
- [cmake](https://cmake.org/download/),


### Nodejs
- Node version 20 or [nvm](https://github.com/nvm-sh/nvm)
- [yarn](https://yarnpkg.com/) to install dependencies


### Set config
Config file is located at src/config/default.json, or you can use src/config/user/osusername.json which is in gitignore

- `diffThreshold` - amount of pixes required to change in the video in order to get a notification
- `treshold` (0..1) - how significant change should be. Lower values require bigger changes per pixel
-  `spamDelay` - amount of time in milliseconds between each telegram message and at the same time delay after start
-  `frameRate` - how often (time a seconds) check the difference for the video frames, 1 = 1 frame a second,


### Build and run 
- `nvm use 20`
- run `yarn` to install dependencies 
- run `yarn build` to build native module
- run `yarn start` to start the process. Note that only 1 process can be running at the same time, due to 1 TG bot restriction

