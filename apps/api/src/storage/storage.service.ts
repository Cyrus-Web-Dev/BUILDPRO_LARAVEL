import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';

/**
 * Penyimpanan file. Saat ini disimpan di folder lokal (cukup untuk masa development).
 * Untuk produksi, ganti implementasi ini dengan AWS S3 / Cloudflare R2 tanpa mengubah pemakainya.
 */
@Injectable()
export class StorageService {
  private dir: string;
  constructor(config: ConfigService) {
    this.dir = path.resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
  }

  private resolve(key: string) {
    const full = path.resolve(this.dir, key);
    if (!full.startsWith(this.dir + path.sep)) throw new Error('Kunci file tidak valid');
    return full;
  }

  async save(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  stream(key: string) {
    return createReadStream(this.resolve(key));
  }

  async remove(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
