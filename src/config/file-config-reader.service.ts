import {Inject, Injectable, Logger} from '@nestjs/common';
import {promises as fs} from 'fs';
import path from 'path';
import {aconfigSchema, Config} from '@/config/config-zod-schema';
import {ConfigPath} from '@/config/config-resolve-model';

@Injectable()
export class FileConfigReader {
  public data: Config = null!;

  constructor(
    protected readonly logger: Logger,
    @Inject(ConfigPath)
    protected readonly configsPath: string
  ) {
  }

  protected get confPath(): string {
    return path.join(this.configsPath, 'stream-alert.json');
  };


  public async canHandle(): Promise<boolean> {
    return fs.access(this.confPath).then(() => true).catch(() => false);
  }

  public async save(data: Config): Promise<void> {
    this.data = data;
    this.logger.log(`Saving data to file ${this.confPath}`);
    await fs.writeFile(this.confPath, JSON.stringify(this.data, null, 2));
  }

  public async load(): Promise<void> {
    const data = await fs.readFile(this.confPath, 'utf8');
    try {
      this.data = await aconfigSchema.parseAsync(JSON.parse(data)) as Config;
    } catch (e) {
      const err = new Error(`Unable to parse config at ${this.confPath}: \n ${(e as Error).message}`);
      err.stack = (e as Error).stack;
      throw err;
    }
  }
}
