import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/common/decorators';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';

@ApiTags('Health')
@Controller('health')
class HealthController {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness and dependency check' })
  async check() {
    const startedAt = Date.now();
    let database: 'up' | 'down' = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      checks: { database, latencyMs: Date.now() - startedAt },
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
