import {Module} from '@nestjs/common';
import {CameraConfData, DiffConfData, IConfigResolver, TelegramConfigData} from "@/config/config-resolve-model";
import {SeaConfigService} from "@/config/sea-config.service";
import {ConfigLoadModule} from "@/config/config-load-module";


@Module({
  imports: [ConfigLoadModule],
  exports: [TelegramConfigData, CameraConfData, DiffConfData],
  providers: [
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
export class ConfigResolveModule  {

}
