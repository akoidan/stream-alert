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
    protected readonly confPath: string
  ) {
  }


  public async canHandle(): Promise<boolean> {
    return fs.access(this.confPath).then(() => true).catch(() => {
      this.logger.error(`Cannot load main configuration file: ${this.confPath}`);
      return false;
    });
  }

  public async save(data: Config): Promise<void> {
    this.data = data;
    this.logger.log(`Saving data to file ${this.confPath}`);
    const dir = path.dirname(this.confPath);
    try {
      await fs.mkdir(dir, { recursive: true }).catch(e => {throw Error(`Failed to create directory ${dir}`)});
    } catch (error) {
      throw Error(`Failed to create directory ${dir}: ${error}`)
    }
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
