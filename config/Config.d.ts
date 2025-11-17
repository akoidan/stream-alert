/* tslint:disable */
/* eslint-disable */
declare module "node-config-ts" {
  interface IConfig {
    telegram: Telegram
    camera: string
    frameRate: number
    diffThreshold: number
    threshold: number
  }
  interface Telegram {
    token: string
    chatId: number
    spamDelay: number
  }
  export const config: Config
  export type Config = IConfig
}
