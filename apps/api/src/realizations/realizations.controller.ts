import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CreateRealizationDto, createRealizationSchema } from '@buildpro/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RealizationsService } from './realizations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/realizations')
export class RealizationsController {
  constructor(private svc: RealizationsService) {}

  @Roles('OWNER', 'ADMIN')
  @Post()
  create(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(createRealizationSchema)) dto: CreateRealizationDto) {
    return this.svc.create(u, pid, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Get()
  list(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Query('rabItemId') rabItemId?: string) {
    return this.svc.list(u.tenantId, pid, rabItemId);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.svc.remove(u.tenantId, pid, id);
  }
}
