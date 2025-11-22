/* tslint:disable */
/* eslint-disable */
declare module "node-ts-config" {
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
    message: string
  }
  export const config: Config
  export type Config = IConfig
}
