import {Logger, Module} from '@nestjs/common';
import {CameraConfData, DiffConfData, IConfigResolver, TelegramConfigData} from "@/config/config-resolve-model";
import {SeaConfigService} from "@/config/sea-config.service";
import {isSea} from "node:sea";


@Module({
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
    Logger,
    {
      provide: SeaConfigService,
      inject: [Logger],
      useFactory: async (logger: Logger): Promise<SeaConfigService> => {
        const data = new SeaConfigService(logger, isSea() ? __dirname : process.cwd());
        await data.load()
        return data;
      },
    },
    {
      provide: DiffConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getDiffConfig(),
      inject: [SeaConfigService],
    },
    {
      provide: CameraConfData,
      useFactory: (resolver: IConfigResolver) => resolver.getCameraConfig(),
      inject: [SeaConfigService],
    },
    {
      provide: TelegramConfigData,
      useFactory: (resolver: IConfigResolver) => resolver.getTGConfig(),
      inject: [SeaConfigService],
    }
  ],
})
export class ConfigResolveModule {

}
