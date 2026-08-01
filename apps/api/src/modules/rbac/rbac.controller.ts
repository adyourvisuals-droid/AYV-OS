import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import { PERMISSIONS } from '@ayv/types';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';

import { RbacService } from './rbac.service';

class AssignRoleDto {
  @IsString() roleId!: string;
}

@ApiTags('RBAC')
@Controller()
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  @RequirePermission(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'List roles with their permission grants' })
  async listRoles(@CurrentUser() user: AuthPrincipal) {
    const roles = await this.rbac.listRoles(user.organizationId);

    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      level: role.level,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.permissions.map((grant) => ({
        key: grant.permission.key,
        scope: grant.scope,
      })),
    }));
  }

  @Get('permissions')
  @RequirePermission(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'List every registered permission' })
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Patch('users/:id/role')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const updated = await this.rbac.assignRole(id, dto.roleId, user.organizationId);
    return { id: updated.id, role: { id: updated.role.id, key: updated.role.key } };
  }
}
