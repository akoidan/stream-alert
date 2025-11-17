/* tslint:disable */
/* eslint-disable */
declare module "node-config-ts" {
  interface IConfig {
    pushcut: Pushcut
  }
  interface Pushcut {
    token: string
    notificationName: string
    camera: string
  }
  export const config: Config
  export type Config = IConfig
}
