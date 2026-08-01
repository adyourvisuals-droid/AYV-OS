import { Module, OnApplicationBootstrap } from '@nestjs/common';

import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  controllers: [RbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule implements OnApplicationBootstrap {
  constructor(private readonly rbac: RbacService) {}

  /** Keeps the permission table in step with the code registry on every boot. */
  async onApplicationBootstrap(): Promise<void> {
    await this.rbac.syncPermissionRegistry();
  }
}
