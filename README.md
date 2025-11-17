# Stream Alert


Get a telegram notification when your webcamera or screen changes

## Get started

### Requirements

### ffmpeg
- Install [full  ffmpeg](https://www.ffmpeg.org/download.html) 
- For windows you can get `ffmpeg-git-full.7z` from here https://www.gyan.dev/ffmpeg/builds/ or use `choco install ffmpeg-full`
- Put ffmpeg.exe in your PATH so it's globally accessible (not required if you use choco)



### Telegram
- Install [telegram](https://telegram.org/) if you dont have it
- Create a new bot using @botfather chat in telegram
- use `/newbot` command there and keep going until you finish creating your bot
- copy token to file `config/default.json` at path to `telegram.token`
- Find your bot in the telegram and post a few messages there
- Find another bot named `@userinfobot` and type start there, you will get Id, this is id of your chat, put it into `config/default.json` at path to `telegram.chatId` 

### Input  
#### Web camera
For web camera specify its name in `config/default.json` at path `camera`. 

#### Screen capture
For screen capture you need OBS with streaming as a camera feature

- Install [OBS](https://obsproject.com/) or use `choco install obs`
- Launch OBS 
- Capture a window or screen you want to monitor and click `Start Virtual Camera`
- The name of your camera should be specified at `config/default.json` at path `camera`. If you use default settings, it's already there


### Clone repo
- `nvm use 20` - use node version 20+
-  install dependencies: `yarn install`
- Run the program with `yarn start`


### Customize

- `diffThreshold` - amount of pixes required to change in the video in order to get a notification
- `treshold` (0..1) - how significant change should be. Lower values require bigger changes per pixel
-  `spamDelay` - amount of time in milliseconds between each telegram message and at the same time delay after start
-  `frameRate` - how often (time a seconds) check the difference for the video frames, 1 = 1 frame a second, 

