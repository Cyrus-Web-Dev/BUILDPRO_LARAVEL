import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateStockItemDto, StockAdjustDto, StockInDto, StockOutDto, UpdateStockItemDto,
} from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/project-access.service';
import { AuthUser } from '../common/auth.types';
import { checkItemBudget } from '../common/budget-check';

type Tx = Prisma.TransactionClient;
const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

export type StockStatus = 'OK' | 'LOW' | 'EMPTY';
function stockStatus(qty: Prisma.Decimal, min: Prisma.Decimal): StockStatus {
  if (qty.lte(0)) return 'EMPTY';
  if (min.gt(0) && qty.lte(min)) return 'LOW';
  return 'OK';
}

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService, private access: ProjectAccessService) {}

  private itemView(i: { id: string; name: string; unit: string; minStock: Prisma.Decimal; currentQty: Prisma.Decimal; defaultRabItemId: string | null }) {
    return {
      id: i.id, name: i.name, unit: i.unit,
      minStock: i.minStock.toNumber(), currentQty: i.currentQty.toNumber(),
      defaultRabItemId: i.defaultRabItemId, status: stockStatus(i.currentQty, i.minStock),
    };
  }

  private stockAlert(item: ReturnType<StockService['itemView']>) {
    if (item.status === 'OK') return null;
    return {
      level: item.status,
      message:
        item.status === 'EMPTY'
          ? `Stok "${item.name}" HABIS di gudang proyek`
          : `Stok "${item.name}" menipis (${item.currentQty} ${item.unit}, batas minimum ${item.minStock})`,
    };
  }

  /** UPDATE ... RETURNING atomik: stok berkurang hanya jika cukup. Mengembalikan saldo baru, atau null bila tidak cukup. */
  private async decrement(tx: Tx, stockItemId: string, tenantId: string, qty: Prisma.Decimal) {
    const rows = await tx.$queryRaw<{ currentQty: Prisma.Decimal }[]>`
      UPDATE "StockItem" SET "currentQty" = "currentQty" - ${qty.toString()}::numeric
      WHERE "id" = ${stockItemId} AND "tenantId" = ${tenantId} AND "currentQty" >= ${qty.toString()}::numeric
      RETURNING "currentQty"`;
    return rows.length ? new Prisma.Decimal(rows[0].currentQty) : null;
  }

  private movementView(m: any, hideMoney: boolean) {
    return {
      id: m.id, type: m.type, quantity: m.quantity.toNumber(), balanceAfter: m.balanceAfter.toNumber(),
      unitPrice: hideMoney ? null : m.unitPrice?.toNumber() ?? null,
      totalCost: hideMoney ? null : m.totalCost?.toNumber() ?? null,
      supplier: m.supplier, refNo: m.refNo, note: m.note, date: m.date,
      voidedAt: m.voidedAt, createdAt: m.createdAt,
      stockItem: m.stockItem ? { id: m.stockItem.id, name: m.stockItem.name, unit: m.stockItem.unit } : undefined,
      createdBy: m.createdBy?.name,
    };
  }

  // ---------- master item gudang ----------
  async listItems(user: AuthUser, projectId: string) {
    await this.access.assert(user, projectId);
    const items = await this.prisma.stockItem.findMany({ where: { projectId, tenantId: user.tenantId }, orderBy: { name: 'asc' } });
    return items.map((i) => this.itemView(i));
  }

  async createItem(user: AuthUser, projectId: string, dto: CreateStockItemDto) {
    await this.access.assert(user, projectId);
    if (dto.defaultRabItemId) await this.assertRabItem(this.prisma, user.tenantId, projectId, dto.defaultRabItemId);
    const dup = await this.prisma.stockItem.findUnique({ where: { projectId_name: { projectId, name: dto.name } } });
    if (dup) throw new ConflictException(`Material "${dto.name}" sudah ada di gudang proyek ini`);
    const item = await this.prisma.stockItem.create({
      data: { tenantId: user.tenantId, projectId, name: dto.name, unit: dto.unit, minStock: D(dto.minStock ?? 0), defaultRabItemId: dto.defaultRabItemId },
    });
    return this.itemView(item);
  }

  async updateItem(user: AuthUser, projectId: string, id: string, dto: UpdateStockItemDto) {
    await this.access.assert(user, projectId);
    const item = await this.prisma.stockItem.findFirst({ where: { id, projectId, tenantId: user.tenantId } });
    if (!item) throw new NotFoundException('Material tidak ditemukan');
    if (dto.defaultRabItemId) await this.assertRabItem(this.prisma, user.tenantId, projectId, dto.defaultRabItemId);
    const updated = await this.prisma.stockItem.update({
      where: { id },
      data: {
        name: dto.name,
        minStock: dto.minStock !== undefined ? D(dto.minStock) : undefined,
        defaultRabItemId: dto.defaultRabItemId,
      },
    });
    return this.itemView(updated);
  }

  private async assertRabItem(db: Tx | PrismaService, tenantId: string, projectId: string, rabItemId: string) {
    const rab = await db.rabItem.findFirst({ where: { id: rabItemId, projectId, tenantId } });
    if (!rab) throw new NotFoundException('Item RAB tidak ditemukan di proyek ini');
    return rab;
  }

  // ---------- barang masuk (membebani RAB) ----------
  async stockIn(user: AuthUser, projectId: string, dto: StockInDto) {
    const project = await this.access.assert(user, projectId);
    if (project.rabStatus !== 'APPROVED') {
      throw new BadRequestException('RAB belum disetujui. Setujui RAB sebelum mencatat material masuk.');
    }
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.findFirst({ where: { id: dto.stockItemId, projectId, tenantId: user.tenantId } });
      if (!stock) throw new NotFoundException('Material tidak ditemukan di gudang proyek ini');
      const rabItemId = dto.rabItemId ?? stock.defaultRabItemId;
      if (!rabItemId) throw new BadRequestException('Pilih item RAB yang dibebani biaya material ini');
      const rab = await this.assertRabItem(tx, user.tenantId, projectId, rabItemId);

      const qty = D(dto.quantity);
      const total = qty.mul(dto.unitPrice).toDecimalPlaces(2);

      const updated = await tx.stockItem.update({ where: { id: stock.id }, data: { currentQty: { increment: qty } } });

      let realizationId: string | undefined;
      if (total.gt(0)) {
        const r = await tx.realization.create({
          data: {
            tenantId: user.tenantId, projectId, rabItemId: rab.id, date: dto.date,
            description: `Material masuk: ${stock.name} ${dto.quantity} ${stock.unit}${dto.refNo ? ` (${dto.refNo})` : ''}`,
            amount: total, quantity: qty, vendor: dto.supplier, source: 'STOK', createdById: user.userId,
          },
        });
        realizationId = r.id;
      }

      const movement = await tx.stockMovement.create({
        data: {
          tenantId: user.tenantId, projectId, stockItemId: stock.id, type: 'IN', quantity: qty,
          balanceAfter: updated.currentQty, unitPrice: D(dto.unitPrice), totalCost: total,
          supplier: dto.supplier, refNo: dto.refNo, note: dto.note, date: dto.date,
          realizationId, createdById: user.userId,
        },
        include: { stockItem: true, createdBy: true },
      });

      const budget = realizationId ? await checkItemBudget(tx, rab) : null;
      return {
        movement: this.movementView(movement, false),
        stock: this.itemView(updated),
        budgetAlert: budget?.alert ?? null,
        budgetItem: budget?.item ?? null,
      };
    });
  }

  // ---------- pemakaian material (boleh oleh mandor) ----------
  async stockOut(user: AuthUser, projectId: string, dto: StockOutDto) {
    await this.access.assert(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.findFirst({ where: { id: dto.stockItemId, projectId, tenantId: user.tenantId } });
      if (!stock) throw new NotFoundException('Material tidak ditemukan di gudang proyek ini');
      const qty = D(dto.quantity);
      const balance = await this.decrement(tx, stock.id, user.tenantId, qty);
      if (!balance) {
        throw new BadRequestException(`Stok "${stock.name}" tidak cukup. Tersedia ${stock.currentQty.toNumber()} ${stock.unit}.`);
      }
      const movement = await tx.stockMovement.create({
        data: {
          tenantId: user.tenantId, projectId, stockItemId: stock.id, type: 'OUT', quantity: qty.neg(),
          balanceAfter: balance, note: dto.note, date: dto.date, createdById: user.userId,
        },
        include: { stockItem: true, createdBy: true },
      });
      const view = this.itemView({ ...stock, currentQty: balance });
      return { movement: this.movementView(movement, user.role === 'MANDOR'), stock: view, alert: this.stockAlert(view) };
    });
  }

  // ---------- penyesuaian hasil hitung fisik ----------
  async adjust(user: AuthUser, projectId: string, dto: StockAdjustDto) {
    await this.access.assert(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.stockItem.findFirst({ where: { id: dto.stockItemId, projectId, tenantId: user.tenantId } });
      if (!stock) throw new NotFoundException('Material tidak ditemukan di gudang proyek ini');
      const target = D(dto.newQuantity);
      const delta = target.sub(stock.currentQty);
      if (delta.isZero()) throw new BadRequestException('Jumlah fisik sama dengan stok sistem, tidak ada yang perlu disesuaikan');
      // Optimistic lock: gagal bila stok berubah sejak dibaca
      const res = await tx.stockItem.updateMany({ where: { id: stock.id, currentQty: stock.currentQty }, data: { currentQty: target } });
      if (res.count === 0) throw new ConflictException('Stok berubah saat penyesuaian diproses. Silakan ulangi.');
      const movement = await tx.stockMovement.create({
        data: {
          tenantId: user.tenantId, projectId, stockItemId: stock.id, type: 'ADJUST', quantity: delta,
          balanceAfter: target, note: dto.note, date: dto.date, createdById: user.userId,
        },
        include: { stockItem: true, createdBy: true },
      });
      const view = this.itemView({ ...stock, currentQty: target });
      return { movement: this.movementView(movement, false), stock: view, alert: this.stockAlert(view) };
    });
  }

  // ---------- riwayat & pembatalan ----------
  async listMovements(user: AuthUser, projectId: string, stockItemId?: string) {
    await this.access.assert(user, projectId);
    const rows = await this.prisma.stockMovement.findMany({
      where: { projectId, tenantId: user.tenantId, ...(stockItemId ? { stockItemId } : {}) },
      include: { stockItem: true, createdBy: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return rows.map((m) => this.movementView(m, user.role === 'MANDOR'));
  }

  /** Membatalkan transaksi stok (IN/OUT). Biaya RAB yang terkait ikut dihapus. Koreksi lain lewat penyesuaian. */
  async voidMovement(user: AuthUser, projectId: string, movementId: string) {
    await this.access.assert(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.stockMovement.findFirst({ where: { id: movementId, projectId, tenantId: user.tenantId } });
      if (!m) throw new NotFoundException('Transaksi stok tidak ditemukan');
      if (m.voidedAt) throw new BadRequestException('Transaksi sudah dibatalkan');
      if (m.type === 'ADJUST') throw new BadRequestException('Penyesuaian tidak bisa dibatalkan. Lakukan penyesuaian baru.');

      if (m.type === 'IN') {
        const balance = await this.decrement(tx, m.stockItemId, user.tenantId, m.quantity);
        if (!balance) throw new BadRequestException('Material dari transaksi ini sudah terpakai sebagian. Gunakan penyesuaian stok.');
        if (m.realizationId) await tx.realization.deleteMany({ where: { id: m.realizationId, tenantId: user.tenantId } });
      } else {
        await tx.stockItem.update({ where: { id: m.stockItemId }, data: { currentQty: { increment: m.quantity.abs() } } });
      }
      await tx.stockMovement.update({
        where: { id: m.id },
        data: { voidedAt: new Date(), voidedById: user.userId, realizationId: null },
      });
      return { voided: true };
    });
  }
}
