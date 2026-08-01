import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PERMISSIONS } from '@ayv/types';
import { RequestContextStore } from '@/common/context/request-context';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';
import { PaginationQueryDto, paginationMeta } from '@/common/dto/pagination.dto';
import { PRISMA, type PrismaService } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit/audit.service';

// ─── DTOs ──────────────────────────────────────────────────────────────────

class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
  @IsString() @IsNotEmpty() roleId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() managerId?: string;
}

class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() managerId?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INVITED', 'SUSPENDED', 'OFFBOARDED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INVITED', 'SUSPENDED', 'OFFBOARDED'])
  status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'OFFBOARDED';
}

class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() roleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
}

// ─── Service ───────────────────────────────────────────────────────────────

/** Roles permitted to see salary. Everyone else gets the field stripped. */
const SALARY_VISIBLE_ROLES = new Set(['SUPER_ADMIN', 'CEO', 'HR', 'FINANCE']);

@Injectable()
export class UsersService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: UserQueryDto, principal: AuthPrincipal) {
    const where = {
      userType: 'EMPLOYEE' as const,
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.deleted ? { deletedAt: { not: null } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { role: { select: { id: true, key: true, name: true } }, team: true },
        orderBy: query.orderBy(['createdAt', 'name', 'joinedAt'], [{ name: 'asc' }]),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.present(row, principal)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string, principal: AuthPrincipal) {
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: {
        role: { select: { id: true, key: true, name: true } },
        team: true,
        manager: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return this.present(user, principal);
  }

  async create(dto: CreateUserDto, principal: AuthPrincipal) {
    const created = await this.prisma.user.create({
      data: {
        organizationId: principal.organizationId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        roleId: dto.roleId,
        phone: dto.phone,
        designation: dto.designation,
        department: dto.department,
        teamId: dto.teamId,
        managerId: dto.managerId,
        status: 'ACTIVE',
        joinedAt: new Date(),
        passwordChangedAt: new Date(),
        createdById: principal.userId,
      },
      include: { role: { select: { id: true, key: true, name: true } }, team: true },
    });

    await this.audit.record({
      action: 'CREATE',
      entity: 'User',
      entityId: created.id,
      after: { name: created.name, email: created.email, roleId: created.roleId },
    });

    return this.present(created, principal);
  }

  async update(id: string, dto: UpdateUserDto, principal: AuthPrincipal) {
    const before = await this.prisma.user.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { ...dto },
      include: { role: { select: { id: true, key: true, name: true } }, team: true },
    });

    await this.audit.record({
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      before,
      after: updated,
    });

    return this.present(updated, principal);
  }

  async remove(id: string, principal: AuthPrincipal) {
    if (id === principal.userId) {
      throw new NotFoundException('You cannot deactivate your own account');
    }

    const user = await this.prisma.user.findFirst({ where: { id }, include: { role: true } });
    if (!user) throw new NotFoundException('User not found');

    if (user.role.key === 'SUPER_ADMIN') {
      const remaining = await this.prisma.user.count({
        where: {
          role: { key: 'SUPER_ADMIN' },
          status: 'ACTIVE',
          id: { not: id },
        },
      });
      if (remaining === 0) {
        throw new NotFoundException('Cannot deactivate the only Super Admin');
      }
    }

    await this.prisma.user.delete({ where: { id } });
    // Deactivating an account must also end its live sessions.
    await RequestContextStore.runUnscoped(() =>
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );

    await this.audit.record({ action: 'DELETE', entity: 'User', entityId: id, before: user });
    return { success: true };
  }

  private present(user: Record<string, any>, principal: AuthPrincipal) {
    const canSeeSalary =
      SALARY_VISIBLE_ROLES.has(principal.roleKey) || principal.userId === user.id;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      initials: String(user.name)
        .split(/\s+/)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() ?? '')
        .join(''),
      userType: user.userType,
      status: user.status,
      designation: user.designation,
      department: user.department,
      role: user.role,
      team: user.team ? { id: user.team.id, name: user.team.name } : null,
      manager: user.manager ?? null,
      joinedAt: user.joinedAt?.toISOString() ?? null,
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
      // Field-level redaction, per docs/07-rbac-permissions.md §3.
      salary: canSeeSalary && user.salary != null ? Number(user.salary) : null,
      createdAt: user.createdAt?.toISOString() ?? null,
    };
  }
}

// ─── Controller ────────────────────────────────────────────────────────────

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List employees' })
  list(@Query() query: UserQueryDto, @CurrentUser() user: AuthPrincipal) {
    return this.users.list(query, user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'User detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.users.findOne(id, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Create a user account' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthPrincipal) {
    return this.users.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: 'Update a user' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.users.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.USER_DELETE)
  @ApiOperation({ summary: 'Deactivate a user and revoke their sessions' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.users.remove(id, user);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
