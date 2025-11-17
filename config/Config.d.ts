/* tslint:disable */
/* eslint-disable */
declare module "node-config-ts" {
  interface IConfig {
    pushcut: Pushcut
    camera: string
    diffThreshold: number
    threshold: number
  }
  interface Pushcut {
    token: string
    notificationName: string
  }
  export const config: Config
  export type Config = IConfig
}
