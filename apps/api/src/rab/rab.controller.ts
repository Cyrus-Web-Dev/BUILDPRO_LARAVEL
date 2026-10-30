import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RabBulkDto, RabItemDto, UpdateRabItemDto, rabBulkSchema, rabItemSchema, updateRabItemSchema } from '@buildpro/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RabService } from './rab.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId')
export class RabController {
  constructor(private rab: RabService) {}

  @Roles('OWNER', 'ADMIN')
  @Get('rab-items')
  list(@CurrentUser() u: AuthUser, @Param('projectId') pid: string) {
    return this.rab.list(u.tenantId, pid);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('rab-items')
  add(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(rabItemSchema)) dto: RabItemDto) {
    return this.rab.add(u.tenantId, pid, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('rab-items/bulk')
  bulk(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(rabBulkSchema)) dto: RabBulkDto) {
    return this.rab.bulkAdd(u.tenantId, pid, dto.items);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('rab-items/:id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('projectId') pid: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRabItemSchema)) dto: UpdateRabItemDto,
  ) {
    return this.rab.update(u.tenantId, pid, id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete('rab-items/:id')
  remove(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.rab.remove(u.tenantId, pid, id);
  }

  @Roles('OWNER', 'ADMIN')
  @Get('rab-summary')
  summary(@CurrentUser() u: AuthUser, @Param('projectId') pid: string) {
    return this.rab.summary(u.tenantId, pid);
  }
}
