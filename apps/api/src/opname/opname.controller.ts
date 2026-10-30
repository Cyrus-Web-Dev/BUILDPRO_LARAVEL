import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  CreateWorkOrderDto, OpnameDto, PayOpnameDto, createWorkOrderSchema, opnameSchema, payOpnameSchema,
} from '@buildpro/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OpnameService } from './opname.service';

// Opname menyangkut upah/keuangan: seluruhnya hanya untuk Owner & Admin
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
@Controller('projects/:projectId')
export class OpnameController {
  constructor(private svc: OpnameService) {}

  @Get('work-orders')
  workOrders(@CurrentUser() u: AuthUser, @Param('projectId') pid: string) {
    return this.svc.listWorkOrders(u, pid);
  }

  @Post('work-orders')
  createWorkOrder(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(createWorkOrderSchema)) dto: CreateWorkOrderDto) {
    return this.svc.createWorkOrder(u, pid, dto);
  }

  @Post('work-orders/:id/close')
  close(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.svc.closeWorkOrder(u, pid, id);
  }

  @Delete('work-orders/:id')
  deleteWorkOrder(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.svc.deleteWorkOrder(u, pid, id);
  }

  @Post('work-orders/:id/opnames')
  createOpname(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(opnameSchema)) dto: OpnameDto) {
    return this.svc.createOpname(u, pid, id, dto);
  }

  @Get('opnames')
  opnames(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Query('workOrderId') workOrderId?: string) {
    return this.svc.list(u, pid, workOrderId);
  }

  @Put('opnames/:id')
  update(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(opnameSchema)) dto: OpnameDto) {
    return this.svc.updateOpname(u, pid, id, dto);
  }

  @Roles('OWNER')
  @Post('opnames/:id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.svc.approve(u, pid, id);
  }

  @Post('opnames/:id/pay')
  pay(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(payOpnameSchema)) dto: PayOpnameDto) {
    return this.svc.pay(u, pid, id, dto);
  }

  @Post('opnames/:id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.svc.cancel(u, pid, id);
  }
}
