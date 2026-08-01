import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '@ayv/types';
import { CurrentUser, RequirePermission, type AuthPrincipal } from '@/common/decorators';

import { ClientsService } from './clients.service';
import { ClientQueryDto, CreateClientDto, UpdateClientDto } from './dto/client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CLIENT_READ)
  @ApiOperation({ summary: 'List client accounts' })
  list(@Query() query: ClientQueryDto, @CurrentUser() user: AuthPrincipal) {
    return this.clients.list(query, user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CLIENT_READ)
  @ApiOperation({ summary: 'Client detail with contacts and related counts' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.clients.findOne(id, user);
  }

  @Get(':id/health')
  @RequirePermission(PERMISSIONS.CLIENT_HEALTH_READ)
  @ApiOperation({ summary: 'Recompute health with a per-signal breakdown' })
  health(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.clients.computeHealth(id, user);
  }

  @Get(':id/health/history')
  @RequirePermission(PERMISSIONS.CLIENT_HEALTH_READ)
  @ApiOperation({ summary: 'Historical health snapshots' })
  healthHistory(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.clients.healthHistory(id, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.CLIENT_CREATE)
  @ApiOperation({ summary: 'Create a client account' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthPrincipal) {
    return this.clients.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.CLIENT_UPDATE)
  @ApiOperation({ summary: 'Update a client account' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.clients.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.CLIENT_DELETE)
  @ApiOperation({ summary: 'Soft delete a client account' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.clients.remove(id, user);
  }
}
