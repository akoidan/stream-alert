"use strict";
const path = require("path");
const process$1 = require("node:process");
const node_fs = require("node:fs");
const core = require("@nestjs/core");
const common = require("@nestjs/common");
const clc = require("cli-color");
const telegraf = require("telegraf");
const nodeTsConfig = require("node-ts-config");
const bindings = require("bindings");
const readline = require("readline");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const process__namespace = /* @__PURE__ */ _interopNamespaceDefault(process$1);
const readline__namespace = /* @__PURE__ */ _interopNamespaceDefault(readline);
var __getOwnPropDesc$9 = Object.getOwnPropertyDescriptor;
var __decorateClass$9 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$9(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let CustomLogger = class extends common.ConsoleLogger {
  logFormat(level, message, levelColor, messageStyle) {
    const timestamp = clc.xterm(100)(`[${this.getCurrentTime()}]`);
    const id = levelColor(level);
    return `${timestamp} ${id}: ${messageStyle ? messageStyle(message) : message}`;
  }
  getCurrentTime() {
    const now = /* @__PURE__ */ new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    const millis = now.getMilliseconds().toString().padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${millis}`;
  }
  log(message) {
    console.info(this.logFormat("INFO", message, clc.bold.blue, clc.cyan));
  }
  error(message, trace) {
    console.error(this.logFormat("ERROR", message?.message ?? message, clc.bold.redBright, clc.red));
    if (trace ?? message?.stack) {
      console.error(clc.red(trace ?? message?.stack));
    }
  }
  warn(message) {
    console.warn(this.logFormat("WARN", message, clc.bold.yellow, clc.yellow));
  }
  debug(message) {
    console.debug(this.logFormat("DEBUG", message, clc.xterm(2), clc.xterm(7)));
  }
  verbose(message) {
    console.log(this.logFormat("VERBOSE", message, clc.bold.magenta, clc.xterm(7)));
  }
};
CustomLogger = __decorateClass$9([
  common.Injectable()
], CustomLogger);
var TelegramCommands = /* @__PURE__ */ ((TelegramCommands2) => {
  TelegramCommands2["image"] = "image";
  TelegramCommands2["set_threshold"] = "set_threshold";
  TelegramCommands2["increase_threshold"] = "increase_threshold";
  TelegramCommands2["decrease_threshold"] = "decrease_threshold";
  return TelegramCommands2;
})(TelegramCommands || {});
const TelegramConfig = "TelegramConfig";
var __getOwnPropDesc$8 = Object.getOwnPropertyDescriptor;
var __decorateClass$8 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$8(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
var __decorateParam$3 = (index, decorator) => (target, key) => decorator(target, key, index);
let TelegramService = class {
  constructor(logger, bot, tgConfig) {
    this.logger = logger;
    this.bot = bot;
    this.tgConfig = tgConfig;
    this.lastNotificationTime = Date.now();
  }
  async setup(commandListener) {
    this.logger.log("Starting telegram service");
    await this.bot.telegram.setMyCommands([
      { command: TelegramCommands.image, description: "Get the last image" },
      { command: TelegramCommands.set_threshold, description: "Sets new amount of pixels to be changes to fire a notification" },
      { command: TelegramCommands.increase_threshold, description: "Double the amount of pixels related to current value to spot a diff" },
      { command: TelegramCommands.decrease_threshold, description: "Reduces the amount of pixels related to current value to spot a diff" }
    ]);
    this.bot.command(TelegramCommands.image, () => commandListener.onAskImage());
    this.bot.command(TelegramCommands.set_threshold, (a) => commandListener.onSetThreshold(a));
    this.bot.command(TelegramCommands.increase_threshold, () => commandListener.onIncreaseThreshold());
    this.bot.command(TelegramCommands.decrease_threshold, () => commandListener.onDecreaseThreshold());
    await this.bot.launch();
  }
  async sendText(text) {
    await this.bot.telegram.sendMessage(this.tgConfig.chatId, text);
  }
  async sendImage(data) {
    const newNotificationTime = Date.now();
    const diffDate = newNotificationTime - this.lastNotificationTime;
    if (diffDate > this.tgConfig.spamDelay) {
      await this.bot.telegram.sendPhoto(this.tgConfig.chatId, { source: data }, { caption: this.tgConfig.message });
      this.lastNotificationTime = newNotificationTime;
      this.logger.log("Notification sent");
    } else {
      this.logger.log(`Skipping sending notification as the last one was sent ${diffDate}ms ago`);
    }
  }
};
TelegramService = __decorateClass$8([
  common.Injectable(),
  __decorateParam$3(2, common.Inject(TelegramConfig))
], TelegramService);
var __getOwnPropDesc$7 = Object.getOwnPropertyDescriptor;
var __decorateClass$7 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$7(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let TelegramModule = class {
};
TelegramModule = __decorateClass$7([
  common.Module({
    exports: [TelegramService],
    providers: [
      common.Logger,
      TelegramService,
      {
        provide: telegraf.Telegraf,
        useFactory: () => {
          return new telegraf.Telegraf(nodeTsConfig.config.telegram.token);
        }
      },
      {
        provide: TelegramConfig,
        useValue: nodeTsConfig.config.telegram
      }
    ]
  })
], TelegramModule);
const Native = "Native";
const imageLibConf = "ImageLibConf";
var __getOwnPropDesc$6 = Object.getOwnPropertyDescriptor;
var __decorateClass$6 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$6(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
var __decorateParam$2 = (index, decorator) => (target, key) => decorator(target, key, index);
let ImagelibService = class {
  constructor(logger, native, conf) {
    this.logger = logger;
    this.native = native;
    this.conf = conf;
    this.oldFrame = null;
  }
  async getLastImage() {
    if (!this.oldFrame) {
      return null;
    }
    return await this.native.convertRgbToJpeg(this.oldFrame.buffer, this.oldFrame.width, this.oldFrame.height);
  }
  async getImageIfItsChanged(frameData) {
    if (!frameData || !frameData.buffer || frameData.buffer.length === 0) {
      return null;
    }
    if (!this.oldFrame) {
      this.oldFrame = frameData;
      return null;
    }
    const diffPixels = await this.native.compareRgbImages(
      this.oldFrame.buffer,
      frameData.buffer,
      frameData.width,
      frameData.height,
      this.conf.threshold
    );
    if (diffPixels < this.conf.pixels) {
      return null;
    }
    this.logger.log(`⚠️ CHANGE DETECTED: ${diffPixels} pixels`);
    const jpegBuffer = await this.native.convertRgbToJpeg(frameData.buffer, frameData.width, frameData.height);
    this.oldFrame = frameData;
    return jpegBuffer;
  }
};
ImagelibService = __decorateClass$6([
  common.Injectable(),
  __decorateParam$2(1, common.Inject(Native)),
  __decorateParam$2(2, common.Inject(imageLibConf))
], ImagelibService);
var __getOwnPropDesc$5 = Object.getOwnPropertyDescriptor;
var __decorateClass$5 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$5(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
var __decorateParam$1 = (index, decorator) => (target, key) => decorator(target, key, index);
let NativeModule = class {
  constructor(logger, native) {
    this.logger = logger;
    this.native = native;
  }
  onModuleInit() {
    this.logger.log(`Loaded native library from ${clc.bold.green(this.native.path)}`);
  }
};
NativeModule = __decorateClass$5([
  common.Module({
    providers: [
      common.Logger,
      {
        provide: Native,
        useFactory: () => {
          return bindings("native");
        }
      }
    ],
    exports: [Native]
  }),
  __decorateParam$1(1, common.Inject(Native))
], NativeModule);
var __getOwnPropDesc$4 = Object.getOwnPropertyDescriptor;
var __decorateClass$4 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$4(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let ImagelibModule = class {
};
ImagelibModule = __decorateClass$4([
  common.Module({
    imports: [NativeModule],
    providers: [
      common.Logger,
      {
        provide: imageLibConf,
        useValue: nodeTsConfig.config.diff
      },
      ImagelibService
    ],
    exports: [ImagelibService]
  })
], ImagelibModule);
const CameraConf = "CameraConf";
var __getOwnPropDesc$3 = Object.getOwnPropertyDescriptor;
var __decorateClass$3 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$3(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
let StreamService = class {
  constructor(logger, captureService, conf) {
    this.logger = logger;
    this.captureService = captureService;
    this.conf = conf;
    this.exitTimeout = null;
  }
  async listen(frameListener) {
    this.exitOnTimeout();
    this.captureService.start(this.conf.name, this.conf.frameRate, async (frameInfo) => {
      clearTimeout(this.exitTimeout);
      this.exitOnTimeout();
      if (frameInfo) {
        process.stdout.write(".");
        await frameListener.onNewFrame(frameInfo);
      }
    });
    this.logger.log(`DirectShow capture started for device: ${this.conf.name}`);
  }
  exitOnTimeout() {
    this.exitTimeout = setTimeout(() => {
      throw Error("Frame capturing didn't produce any data for 5s, exiting...");
    }, 5e3);
  }
};
StreamService = __decorateClass$3([
  common.Injectable(),
  __decorateParam(1, common.Inject(Native)),
  __decorateParam(2, common.Inject(CameraConf))
], StreamService);
var __getOwnPropDesc$2 = Object.getOwnPropertyDescriptor;
var __decorateClass$2 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$2(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let StreamModule = class {
};
StreamModule = __decorateClass$2([
  common.Module({
    imports: [NativeModule],
    exports: [StreamService],
    providers: [
      common.Logger,
      {
        provide: CameraConf,
        useValue: nodeTsConfig.config.camera
      },
      StreamService
    ]
  })
], StreamModule);
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __decorateClass$1 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$1(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let AppService = class {
  constructor(logger, ss, telegram, im) {
    this.logger = logger;
    this.ss = ss;
    this.telegram = telegram;
    this.im = im;
  }
  async onIncreaseThreshold() {
    this.im.conf.threshold = Math.ceil(this.im.conf.threshold * 2);
    await this.telegram.sendText(`Increase threshold to ${this.im.conf.threshold}`);
  }
  async onDecreaseThreshold() {
    this.im.conf.threshold = Math.ceil(this.im.conf.threshold / 2);
    await this.telegram.sendText(`Decreased threshold to ${this.im.conf.threshold}`);
  }
  async onAskImage() {
    this.logger.log(`Got image command`);
    const image = await this.im.getLastImage();
    if (image) {
      await this.telegram.sendImage(image);
    } else {
      await this.telegram.sendText(`No image in cache`);
      this.logger.log(`No current image found, skipping`);
    }
  }
  async onSetThreshold(a) {
    const newThreshold = Number(a.payload);
    if (newThreshold > 0) {
      this.im.conf.threshold = newThreshold;
    } else {
      await this.telegram.sendText(`${TelegramCommands.set_threshold} required number parameter. ${a.payload} is not a number`);
    }
  }
  async onNewFrame(frameData) {
    const image = await this.im.getImageIfItsChanged(frameData);
    if (image) {
      await this.telegram.sendImage(image);
    }
  }
  async run() {
    await this.ss.listen(this);
    await this.telegram.setup(this);
  }
};
AppService = __decorateClass$1([
  common.Injectable()
], AppService);
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = decorator(result) || result;
  return result;
};
let AppModule = class {
  constructor(as) {
    this.as = as;
  }
  async onModuleInit() {
    await this.as.run();
  }
};
AppModule = __decorateClass([
  common.Module({
    imports: [StreamModule, TelegramModule, ImagelibModule],
    providers: [common.Logger, AppService]
  })
], AppModule);
process__namespace.env["NODE_CONFIG_TS_DIR"] = path.join(__dirname, "config");
const configPath = path.join(process__namespace.env.NODE_CONFIG_TS_DIR, "default.json");
const config = JSON.parse(node_fs.readFileSync(configPath, "utf-8"));
async function bootstrap() {
  console.log("🔧 Stream Alert Configuration");
  console.log("================================\n");
  const rl = readline__namespace.createInterface({
    input: process__namespace.stdin,
    output: process__namespace.stdout
  });
  function prompt(question, defaultValue = null) {
    return new Promise((resolve) => {
      const promptText = defaultValue !== null ? `${question} (default: ${defaultValue}): ` : `${question}: `;
      rl.question(promptText, (answer) => {
        if (answer.trim() === "" && defaultValue !== null) {
          resolve(defaultValue);
        } else {
          resolve(answer.trim());
        }
      });
    });
  }
  function validateAndConvert(value, type, fieldName) {
    switch (type) {
      case "number":
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error(`${fieldName} must be a valid number`);
        }
        return num;
      case "string":
        if (!value || value.trim() === "") {
          throw new Error(`${fieldName} cannot be empty`);
        }
        return value;
      default:
        return value;
    }
  }
  function isEnvVariable(value) {
    return typeof value === "string" && value.startsWith("@@");
  }
  try {
    console.log("📱 Telegram Configuration");
    console.log("--------------------------");
    const telegramToken = isEnvVariable(config.telegram.token) ? await prompt("Telegram bot token") : await prompt("Telegram bot token", config.telegram.token);
    config.telegram.token = validateAndConvert(telegramToken, "string", "Telegram token");
    const telegramChatId = isEnvVariable(config.telegram.chatId) ? await prompt("Telegram chat ID") : await prompt("Telegram chat ID", config.telegram.chatId.toString());
    config.telegram.chatId = validateAndConvert(telegramChatId, "number", "Telegram chat ID");
    const telegramSpamDelay = isEnvVariable(config.telegram.spamDelay) ? await prompt("Spam delay in milliseconds") : await prompt("Spam delay in milliseconds", config.telegram.spamDelay.toString());
    config.telegram.spamDelay = validateAndConvert(telegramSpamDelay, "number", "Spam delay");
    const telegramMessage = isEnvVariable(config.telegram.message) ? await prompt("Default message for alerts") : await prompt("Default message for alerts", config.telegram.message);
    config.telegram.message = validateAndConvert(telegramMessage, "string", "Telegram message");
    console.log("");
    console.log("📷 Camera Configuration");
    console.log("------------------------");
    const cameraName = isEnvVariable(config.camera.name) ? await prompt("Camera name") : await prompt("Camera name", config.camera.name);
    config.camera.name = validateAndConvert(cameraName, "string", "Camera name");
    const cameraFrameRate = isEnvVariable(config.camera.frameRate) ? await prompt("Frame rate (frames per second)") : await prompt("Frame rate (frames per second)", config.camera.frameRate.toString());
    config.camera.frameRate = validateAndConvert(cameraFrameRate, "number", "Frame rate");
    console.log("");
    console.log("🔍 Motion Detection Configuration");
    console.log("----------------------------------");
    const diffPixels = isEnvVariable(config.diff.pixels) ? await prompt("Minimum pixels changed to trigger detection") : await prompt("Minimum pixels changed to trigger detection", config.diff.pixels.toString());
    config.diff.pixels = validateAndConvert(diffPixels, "number", "Diff pixels");
    const diffThreshold = isEnvVariable(config.diff.threshold) ? await prompt("Threshold for pixel changes (0.0 - 1.0)") : await prompt("Threshold for pixel changes (0.0 - 1.0)", config.diff.threshold.toString());
    const threshold = validateAndConvert(diffThreshold, "number", "Diff threshold");
    if (threshold < 0 || threshold > 1) {
      throw new Error("Diff threshold must be between 0.0 and 1.0");
    }
    config.diff.threshold = threshold;
    console.log("\n✅ Configuration completed successfully!");
    console.log("Starting application...\n");
    rl.close();
    const updatedConfig = JSON.stringify(config, null, 2);
    require("fs").writeFileSync(configPath, updatedConfig);
    const customLogger = new CustomLogger();
    const app = await core.NestFactory.createApplicationContext(AppModule, {
      logger: customLogger
    });
    console.log("Application started successfully");
  } catch (error) {
    console.error("❌ Configuration error:", error.message);
    rl.close();
    process__namespace.exit(1);
  }
}
bootstrap();
//# sourceMappingURL=bundle.js.map
