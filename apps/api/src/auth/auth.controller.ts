import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import {
  CreateUserDto, LoginDto, RegisterCompanyDto,
  createUserSchema, loginSchema, registerCompanySchema,
} from '@buildpro/shared';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register-company')
  register(@Body(new ZodValidationPipe(registerCompanySchema)) dto: RegisterCompanyDto) {
    return this.auth.registerCompany(dto);
  }

  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('users')
  listUsers(@CurrentUser() user: AuthUser) {
    return this.auth.listUsers(user.tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('users')
  createUser(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
    if (dto.role === 'OWNER' && user.role !== 'OWNER') {
      throw new ForbiddenException('Hanya Owner yang dapat membuat akun Owner');
    }
    return this.auth.createUser(user.tenantId, dto);
  }
}
