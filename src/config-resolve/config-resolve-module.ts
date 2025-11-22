/// <reference path="../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {
  CameraConf,
  ConfigResolver,
  DiffConf,
  globalSeaConf,
  IConfigResolver,
  TelegramConfig
} from "@/config-resolve/config-resolve-model";
import {isSea} from "node:sea";
import {SeaConfigService} from "@/config-resolve/sea-config.service";
import {NodeTsConfigService} from "@/config-resolve/node-ts-config.service";

@Module({
  exports: [TelegramConfig, CameraConf, DiffConf],
  providers: [
    Logger,
    {
      provide: SeaConfigService,
      useFactory: () => new SeaConfigService(globalSeaConf),
    },
    NodeTsConfigService,
    {
      provide: ConfigResolver,
      inject: [SeaConfigService, NodeTsConfigService],
      useFactory: (sea: SeaConfigService, tsnode: NodeTsConfigService): IConfigResolver => {
        const resolver = isSea() ? sea : tsnode;
        resolver.load();
        return resolver;
      },
    },
    {
      provide: DiffConf,
      useFactory: (resolver: IConfigResolver) => resolver.getDiffConfig(),
      inject: [ConfigResolver],
    },
    {
      provide: CameraConf,
      useFactory: (resolver: IConfigResolver) => resolver.getCameraConfig(),
      inject: [ConfigResolver],
    },
    {
      provide: TelegramConfig,
      useFactory: (resolver: IConfigResolver) => resolver.getTGConfig(),
      inject: [ConfigResolver],
    }
  ],
})
export class ConfigResolveModule {

}
