import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  CreateStockItemDto, StockAdjustDto, StockInDto, StockOutDto, UpdateStockItemDto,
  createStockItemSchema, stockAdjustSchema, stockInSchema, stockOutSchema, updateStockItemSchema,
} from '@buildpro/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StockService } from './stock.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/stock')
export class StockController {
  constructor(private stock: StockService) {}

  @Get('items')
  items(@CurrentUser() u: AuthUser, @Param('projectId') pid: string) {
    return this.stock.listItems(u, pid);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('items')
  createItem(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(createStockItemSchema)) dto: CreateStockItemDto) {
    return this.stock.createItem(u, pid, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('items/:id')
  updateItem(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(updateStockItemSchema)) dto: UpdateStockItemDto) {
    return this.stock.updateItem(u, pid, id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('in')
  stockIn(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(stockInSchema)) dto: StockInDto) {
    return this.stock.stockIn(u, pid, dto);
  }

  @Post('out')
  stockOut(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(stockOutSchema)) dto: StockOutDto) {
    return this.stock.stockOut(u, pid, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('adjust')
  adjust(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Body(new ZodValidationPipe(stockAdjustSchema)) dto: StockAdjustDto) {
    return this.stock.adjust(u, pid, dto);
  }

  @Get('movements')
  movements(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Query('stockItemId') stockItemId?: string) {
    return this.stock.listMovements(u, pid, stockItemId);
  }

  @Roles('OWNER', 'ADMIN')
  @Post('movements/:id/void')
  voidMovement(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.stock.voidMovement(u, pid, id);
  }
}
