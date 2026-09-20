import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './common/configure-app';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureApp(app, config.getOrThrow<string[]>('CORS_ORIGINS'));
  await app.listen(config.getOrThrow<number>('API_PORT'), '0.0.0.0');
}
void bootstrap().catch(() => {
  console.error(
    'API startup failed. Check environment configuration and port availability.',
  );
  process.exitCode = 1;
});
