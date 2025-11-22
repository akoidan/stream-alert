/* tslint:disable */
/* eslint-disable */
declare module "node-ts-config" {
  interface IConfig {
    telegram: Telegram
    camera: Camera
    diff: Diff
  }
  interface Diff {
    pixels: number
    threshold: number
  }
  interface Camera {
    name: string
    frameRate: number
  }
  interface Telegram {
    token: string
    chatId: number
    spamDelay: number
    message: string
  }
  export const config: Config
  export type Config = IConfig
}
