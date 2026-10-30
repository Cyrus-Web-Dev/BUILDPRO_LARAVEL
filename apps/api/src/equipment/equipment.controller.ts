import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  CreateRentalDto, RentalUsageDto, ReturnRentalDto, UpdateRentalDto,
  createRentalSchema, rentalUsageSchema, returnRentalSchema, updateRentalSchema,
} from '@buildpro/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EquipmentService } from './equipment.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/equipment')
export class EquipmentController {
  constructor(private eq: EquipmentService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Param('projectId') pid: string) {
    return this.eq.list(u, pid);
  }

  @Roles('OWNER', 'ADMIN')
  @Post()
  create(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(createRentalSchema)) dto: CreateRentalDto) {
    return this.eq.create(u, pid, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('usage/:usageId/void')
  voidUsage(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('usageId') usageId: string) {
    return this.eq.voidUsage(u, pid, usageId);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(updateRentalSchema)) dto: UpdateRentalDto) {
    return this.eq.update(u, pid, id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/return')
  giveBack(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(returnRentalSchema)) dto: ReturnRentalDto) {
    return this.eq.giveBack(u, pid, id, dto);
  }

  @Post(':id/usage')
  addUsage(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(rentalUsageSchema)) dto: RentalUsageDto) {
    return this.eq.addUsage(u, pid, id, dto);
  }

  @Get(':id/usage')
  usage(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.eq.listUsage(u, pid, id);
  }
}
