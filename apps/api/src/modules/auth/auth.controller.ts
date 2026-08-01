import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser, Public, type AuthPrincipal } from '@/common/decorators';

import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private sessionContext(req: Request) {
    return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Post('register')
  @Public()
  @Throttle({ long: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Create an organisation and its first Super Admin' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.sessionContext(req));
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle({ long: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Exchange credentials for an access and refresh token' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, this.sessionContext(req));
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token and mint a new access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.sessionContext(req));
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current session' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  logoutAll(@CurrentUser('userId') userId: string) {
    return this.auth.logoutAll(userId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current principal, role and effective permissions' })
  me(@CurrentUser() user: AuthPrincipal) {
    return {
      id: user.userId,
      name: user.name,
      email: user.email,
      organizationId: user.organizationId,
      clientId: user.clientId,
      role: { id: user.roleId, key: user.roleKey, level: user.roleLevel },
      permissions: user.permissions,
      permissionScopes: user.permissionScopes,
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password and sign out every other device' })
  changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active device sessions' })
  sessions(@CurrentUser('userId') userId: string) {
    return this.auth.listSessions(userId);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  revokeSession(@CurrentUser('userId') userId: string, @Param('id') sessionId: string) {
    return this.auth.revokeSession(userId, sessionId);
  }
}
