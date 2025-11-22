import {Inject, Logger, Module} from '@nestjs/common';
import bindings from 'bindings';
import {INativeModule, Native} from "@/native/native-model";
import clc from "cli-color";
import * as path from 'path';
import * as fs from 'fs';


@Module({
  providers: [
    Logger,
    {
      provide: Native,
      useFactory: (): INativeModule => {
        // Check if we're running in a SEA context by looking for sea-assets folder
        const execDir = path.dirname(process.execPath);
        const seaAssetsPath = path.join(execDir, 'sea-assets');
        const nativePath = path.join(seaAssetsPath, 'native.node');
        
        if (fs.existsSync(seaAssetsPath) && fs.existsSync(nativePath)) {
          // We're in a SEA application, load from embedded assets
          try {
            // Load the native module directly from the embedded path
            const nativeModule = require(nativePath);
            // Add path property for compatibility
            nativeModule.path = nativePath;
            return nativeModule;
          } catch (error) {
            console.error(`Failed to load native module from ${nativePath}:`, error);
            throw error;
          }
        } else {
          // Normal Node.js execution, use bindings
          // eslint-disable-next-line
          return bindings('native');
        }
      },
    },
  ],
  exports: [Native],
})
export class NativeModule {
  constructor(
    private readonly logger: Logger,
    @Inject(Native)
    private readonly native: INativeModule
  ) {
  }

  onModuleInit(): any {
    this.logger.log(`Loaded native library from ${clc.bold.green(this.native.path)}`);
  }
}
