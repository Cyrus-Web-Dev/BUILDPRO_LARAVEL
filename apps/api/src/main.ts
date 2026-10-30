import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0 agar bisa diakses tim lewat IP LAN (mis. http://192.168.1.50:3000/api)
  await app.listen(port, '0.0.0.0');
  console.log(`BUILDPRO API berjalan di http://localhost:${port}/api`);
}
bootstrap();
