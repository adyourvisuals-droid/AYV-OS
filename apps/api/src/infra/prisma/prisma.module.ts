import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';

import type { AppConfig } from '@/config/configuration';

import { createPrismaClient, type ExtendedPrismaClient } from './prisma.extensions';

export const PRISMA = Symbol('PRISMA_CLIENT');

/** Inject with `@Inject(PRISMA) private readonly prisma: PrismaService`. */
export type PrismaService = ExtendedPrismaClient;

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<{ app: AppConfig }, true>) => {
        const database = config.get('app.database', { infer: true }) as AppConfig['database'];
        const client = createPrismaClient(database.url);
        await client.$connect();
        Logger.log('Database connected', 'PrismaModule');
        return client;
      },
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<ExtendedPrismaClient>(PRISMA, { strict: false });
    await client?.$disconnect();
  }
}
