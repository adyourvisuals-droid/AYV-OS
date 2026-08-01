import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<{ app: AppConfig }, true>);
  const appConfig = config.get('app', { infer: true }) as AppConfig;

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableShutdownHooks();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
    exposedHeaders: ['x-request-id', 'x-ratelimit-remaining'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.get(Reflector);

  if (!appConfig.isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AYV OS API')
      .setDescription('The operating system of Ad Your Vision')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
      { swaggerOptions: { persistAuthorization: true } },
    );
  }

  await app.listen(appConfig.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`AYV OS API listening on port ${appConfig.port}`);
  logger.log(`REST      http://localhost:${appConfig.port}/${appConfig.apiPrefix}`);
  if (!appConfig.isProduction) {
    logger.log(`Docs      http://localhost:${appConfig.port}/api/docs`);
  }
}

void bootstrap();
