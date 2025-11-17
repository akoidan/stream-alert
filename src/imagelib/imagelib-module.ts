/// <reference path="../../config/Config.d.ts" />
import {Logger, Module} from '@nestjs/common';
import {config} from 'node-config-ts'
import {ImagelibService} from "@/imagelib/imagelib-service";

@Module({
  providers: [
    Logger,
    {
      provide: ImagelibService,
      useFactory: function (logger: Logger) {
        return new ImagelibService(logger, config.threshold, config.diffThreshold)
      },
      inject: [Logger],
    }
  ],
  exports: [ImagelibService]
})
export class ImagelibModule {

}
