import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EquipmentRental, Prisma } from '@prisma/client';
import { CreateRentalDto, RentalUsageDto, ReturnRentalDto, UpdateRentalDto } from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/project-access.service';
import { AuthUser } from '../common/auth.types';
import { budgetStatus } from '../common/budget.util';
import { checkItemBudget } from '../common/budget-check';

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);
const DAY = 86400000;
const WIB_OFFSET = 7 * 3600 * 1000; // pengguna di Indonesia (WIB)
const todayDay = () => Math.floor((Date.now() + WIB_OFFSET) / DAY);
const dayOf = (d: Date) => Math.floor(d.getTime() / DAY);
const EXPIRING_DAYS = 3;

type Agg = { qty: Prisma.Decimal; cost: Prisma.Decimal };

@Injectable()
export class EquipmentService {
  constructor(private prisma: PrismaService, private access: ProjectAccessService) {}

  private unit(r: EquipmentRental) {
    return r.rateType === 'HOURLY' ? 'jam' : 'hari';
  }

  /** Tampilan sewa lengkap dengan status masa sewa & pemakaian. Mandor tidak melihat tarif/biaya. */
  private view(r: EquipmentRental, agg: Agg, hideMoney: boolean) {
    const daysRemaining = dayOf(r.endDate) - todayDay();
    let durationStatus: 'OK' | 'EXPIRING' | 'OVERDUE' | 'RETURNED' = 'OK';
    if (r.status === 'RETURNED') durationStatus = 'RETURNED';
    else if (daysRemaining < 0) durationStatus = 'OVERDUE';
    else if (daysRemaining <= EXPIRING_DAYS) durationStatus = 'EXPIRING';
    const usageStatus = r.plannedQuantity ? budgetStatus(r.plannedQuantity, agg.qty) : 'OK';
    const alerts: string[] = [];
    if (durationStatus === 'OVERDUE') alerts.push(`Masa sewa "${r.name}" sudah lewat ${Math.abs(daysRemaining)} hari dan belum dikembalikan`);
    if (durationStatus === 'EXPIRING') alerts.push(`Masa sewa "${r.name}" berakhir ${daysRemaining === 0 ? 'hari ini' : `${daysRemaining} hari lagi`}`);
    if (usageStatus === 'OVER') alerts.push(`Pemakaian "${r.name}" melebihi rencana (${agg.qty.toNumber()} dari ${r.plannedQuantity?.toNumber()} ${this.unit(r)})`);
    if (usageStatus === 'WARNING') alerts.push(`Pemakaian "${r.name}" sudah mencapai 80% atau lebih dari rencana`);
    return {
      id: r.id, name: r.name, code: r.code, vendor: r.vendor, rateType: r.rateType, unit: this.unit(r),
      rate: hideMoney ? null : r.rate.toNumber(),
      operatorRate: hideMoney ? null : r.operatorRate.toNumber(),
      plannedQuantity: r.plannedQuantity?.toNumber() ?? null,
      usedQuantity: agg.qty.toNumber(),
      totalCost: hideMoney ? null : agg.cost.toNumber(),
      startDate: r.startDate, endDate: r.endDate, daysRemaining,
      status: r.status, returnedAt: r.returnedAt, rabItemId: r.rabItemId, notes: r.notes,
      durationStatus, usageStatus, alerts,
    };
  }

  private async aggregates(db: Prisma.TransactionClient | PrismaService, tenantId: string, projectId: string) {
    const rows = await db.equipmentUsage.groupBy({
      by: ['rentalId'], where: { tenantId, projectId, voidedAt: null }, _sum: { quantity: true, cost: true },
    });
    return new Map<string, Agg>(rows.map((x) => [x.rentalId, { qty: x._sum.quantity ?? D(0), cost: x._sum.cost ?? D(0) }]));
  }

  private async rental(db: Prisma.TransactionClient | PrismaService, tenantId: string, projectId: string, id: string) {
    const r = await db.equipmentRental.findFirst({ where: { id, projectId, tenantId } });
    if (!r) throw new NotFoundException('Data sewa alat tidak ditemukan');
    return r;
  }

  async list(user: AuthUser, projectId: string) {
    await this.access.assert(user, projectId);
    const [rows, aggs] = await Promise.all([
      this.prisma.equipmentRental.findMany({ where: { projectId, tenantId: user.tenantId }, orderBy: [{ status: 'asc' }, { endDate: 'asc' }] }),
      this.aggregates(this.prisma, user.tenantId, projectId),
    ]);
    const hide = user.role === 'MANDOR';
    return rows.map((r) => this.view(r, aggs.get(r.id) ?? { qty: D(0), cost: D(0) }, hide));
  }

  async create(user: AuthUser, projectId: string, dto: CreateRentalDto) {
    await this.access.assert(user, projectId);
    const rab = await this.prisma.rabItem.findFirst({ where: { id: dto.rabItemId, projectId, tenantId: user.tenantId } });
    if (!rab) throw new NotFoundException('Item RAB tidak ditemukan di proyek ini');
    const r = await this.prisma.equipmentRental.create({
      data: {
        tenantId: user.tenantId, projectId, name: dto.name, code: dto.code, vendor: dto.vendor,
        rateType: dto.rateType, rate: D(dto.rate), operatorRate: D(dto.operatorRate ?? 0),
        plannedQuantity: dto.plannedQuantity !== undefined ? D(dto.plannedQuantity) : undefined,
        startDate: dto.startDate, endDate: dto.endDate, rabItemId: dto.rabItemId, notes: dto.notes, createdById: user.userId,
      },
    });
    return this.view(r, { qty: D(0), cost: D(0) }, false);
  }

  async update(user: AuthUser, projectId: string, id: string, dto: UpdateRentalDto) {
    await this.access.assert(user, projectId);
    const r = await this.rental(this.prisma, user.tenantId, projectId, id);
    if (r.status === 'RETURNED') throw new BadRequestException('Alat sudah dikembalikan');
    if (dto.endDate && dto.endDate < r.startDate) throw new BadRequestException('Tanggal berakhir tidak boleh sebelum tanggal mulai');
    const updated = await this.prisma.equipmentRental.update({
      where: { id },
      data: {
        endDate: dto.endDate, vendor: dto.vendor, notes: dto.notes,
        plannedQuantity: dto.plannedQuantity === undefined ? undefined : dto.plannedQuantity === null ? null : D(dto.plannedQuantity),
      },
    });
    const aggs = await this.aggregates(this.prisma, user.tenantId, projectId);
    return this.view(updated, aggs.get(id) ?? { qty: D(0), cost: D(0) }, false);
  }

  async giveBack(user: AuthUser, projectId: string, id: string, dto: ReturnRentalDto) {
    await this.access.assert(user, projectId);
    const r = await this.rental(this.prisma, user.tenantId, projectId, id);
    if (r.status === 'RETURNED') throw new BadRequestException('Alat sudah dikembalikan');
    const updated = await this.prisma.equipmentRental.update({ where: { id }, data: { status: 'RETURNED', returnedAt: dto.returnedAt ?? new Date() } });
    const aggs = await this.aggregates(this.prisma, user.tenantId, projectId);
    return this.view(updated, aggs.get(id) ?? { qty: D(0), cost: D(0) }, false);
  }

  /** Catat pemakaian (jam/hari). Biaya otomatis masuk realisasi RAB dalam satu transaksi. */
  async addUsage(user: AuthUser, projectId: string, rentalId: string, dto: RentalUsageDto) {
    const project = await this.access.assert(user, projectId);
    if (project.rabStatus !== 'APPROVED') throw new BadRequestException('RAB belum disetujui. Setujui RAB sebelum mencatat pemakaian alat.');
    if (user.role === 'MANDOR' && dto.extraCost) throw new ForbiddenException('Biaya tambahan hanya bisa diisi oleh admin');

    return this.prisma.$transaction(async (tx) => {
      const r = await this.rental(tx, user.tenantId, projectId, rentalId);
      if (r.status !== 'ACTIVE') throw new BadRequestException('Alat sudah dikembalikan, tidak bisa mencatat pemakaian');
      if (dayOf(dto.date) < dayOf(r.startDate)) throw new BadRequestException('Tanggal pemakaian sebelum masa sewa dimulai');
      const rab = await tx.rabItem.findFirst({ where: { id: r.rabItemId, projectId, tenantId: user.tenantId } });
      if (!rab) throw new NotFoundException('Item RAB untuk sewa ini sudah tidak ada');

      const qty = D(dto.quantity);
      const extra = D(dto.extraCost ?? 0);
      const cost = qty.mul(r.rate.add(r.operatorRate)).add(extra).toDecimalPlaces(2);

      const realization = await tx.realization.create({
        data: {
          tenantId: user.tenantId, projectId, rabItemId: rab.id, date: dto.date,
          description: `Sewa alat: ${r.name}${r.code ? ` (${r.code})` : ''} ${dto.quantity} ${this.unit(r)}`,
          amount: cost, quantity: qty, vendor: r.vendor, source: 'SEWA_ALAT', createdById: user.userId,
        },
      });
      const usage = await tx.equipmentUsage.create({
        data: {
          tenantId: user.tenantId, projectId, rentalId: r.id, date: dto.date, quantity: qty, extraCost: extra,
          cost, note: dto.note, realizationId: realization.id, createdById: user.userId,
        },
      });
      const sum = await tx.equipmentUsage.aggregate({ where: { rentalId: r.id, voidedAt: null }, _sum: { quantity: true, cost: true } });
      const budget = await checkItemBudget(tx, rab);
      return {
        usageId: usage.id,
        rental: this.view(r, { qty: sum._sum.quantity ?? D(0), cost: sum._sum.cost ?? D(0) }, user.role === 'MANDOR'),
        budgetAlert: budget.alert,
      };
    });
  }

  async listUsage(user: AuthUser, projectId: string, rentalId: string) {
    await this.access.assert(user, projectId);
    await this.rental(this.prisma, user.tenantId, projectId, rentalId);
    const rows = await this.prisma.equipmentUsage.findMany({
      where: { rentalId, tenantId: user.tenantId }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 200,
    });
    const hide = user.role === 'MANDOR';
    return rows.map((u) => ({
      id: u.id, date: u.date, quantity: u.quantity.toNumber(), note: u.note, voidedAt: u.voidedAt,
      extraCost: hide ? null : u.extraCost.toNumber(), cost: hide ? null : u.cost.toNumber(),
    }));
  }

  async voidUsage(user: AuthUser, projectId: string, usageId: string) {
    await this.access.assert(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.equipmentUsage.findFirst({ where: { id: usageId, projectId, tenantId: user.tenantId } });
      if (!u) throw new NotFoundException('Catatan pemakaian tidak ditemukan');
      if (u.voidedAt) throw new BadRequestException('Catatan sudah dibatalkan');
      if (u.realizationId) await tx.realization.deleteMany({ where: { id: u.realizationId, tenantId: user.tenantId } });
      await tx.equipmentUsage.update({ where: { id: u.id }, data: { voidedAt: new Date(), realizationId: null } });
      return { voided: true };
    });
  }
}
