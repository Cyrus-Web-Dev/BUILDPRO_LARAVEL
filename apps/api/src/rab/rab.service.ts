import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RabItemDto, UpdateRabItemDto } from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { budgetStatus, usagePercent } from '../common/budget.util';

@Injectable()
export class RabService {
  constructor(private prisma: PrismaService) {}

  private async editableProject(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan');
    if (project.rabStatus === 'APPROVED') {
      throw new BadRequestException('RAB sudah disetujui dan terkunci, tidak bisa diubah');
    }
    return project;
  }

  private calcBudget(volume: number | Prisma.Decimal, unitPrice: number | Prisma.Decimal) {
    return new Prisma.Decimal(volume).mul(unitPrice).toDecimalPlaces(2);
  }

  async list(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan');
    return this.prisma.rabItem.findMany({
      where: { projectId, tenantId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async add(tenantId: string, projectId: string, dto: RabItemDto) {
    await this.editableProject(tenantId, projectId);
    const dup = await this.prisma.rabItem.findUnique({ where: { projectId_code: { projectId, code: dto.code } } });
    if (dup) throw new BadRequestException(`Kode item "${dto.code}" sudah ada di RAB ini`);
    return this.prisma.rabItem.create({
      data: { ...dto, tenantId, projectId, budget: this.calcBudget(dto.volume, dto.unitPrice) },
    });
  }

  /** Impor banyak item sekaligus (mis. tempel dari Excel). Semua berhasil atau tidak sama sekali. */
  async bulkAdd(tenantId: string, projectId: string, items: RabItemDto[]) {
    await this.editableProject(tenantId, projectId);
    const codes = items.map((i) => i.code);
    const dupInFile = codes.find((c, idx) => codes.indexOf(c) !== idx);
    if (dupInFile) throw new BadRequestException(`Kode "${dupInFile}" muncul lebih dari sekali di data impor`);
    const existing = await this.prisma.rabItem.findMany({ where: { projectId, code: { in: codes } }, select: { code: true } });
    if (existing.length) {
      throw new BadRequestException(`Kode sudah ada di RAB: ${existing.map((e) => e.code).join(', ')}`);
    }
    const last = await this.prisma.rabItem.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    let order = (last._max.sortOrder ?? -1) + 1;
    await this.prisma.$transaction(
      items.map((it) =>
        this.prisma.rabItem.create({
          data: { ...it, tenantId, projectId, sortOrder: it.sortOrder ?? order++, budget: this.calcBudget(it.volume, it.unitPrice) },
        }),
      ),
    );
    return { imported: items.length };
  }

  async update(tenantId: string, projectId: string, id: string, dto: UpdateRabItemDto) {
    await this.editableProject(tenantId, projectId);
    const item = await this.prisma.rabItem.findFirst({ where: { id, projectId, tenantId } });
    if (!item) throw new NotFoundException('Item RAB tidak ditemukan');
    if (dto.code && dto.code !== item.code) {
      const dup = await this.prisma.rabItem.findUnique({ where: { projectId_code: { projectId, code: dto.code } } });
      if (dup) throw new BadRequestException(`Kode item "${dto.code}" sudah ada di RAB ini`);
    }
    const volume = dto.volume ?? item.volume;
    const unitPrice = dto.unitPrice ?? item.unitPrice;
    return this.prisma.rabItem.update({
      where: { id },
      data: { ...dto, budget: this.calcBudget(volume, unitPrice) },
    });
  }

  async remove(tenantId: string, projectId: string, id: string) {
    await this.editableProject(tenantId, projectId);
    const item = await this.prisma.rabItem.findFirst({ where: { id, projectId, tenantId } });
    if (!item) throw new NotFoundException('Item RAB tidak ditemukan');
    const [rentals, orders, stocks] = await Promise.all([
      this.prisma.equipmentRental.count({ where: { rabItemId: id } }),
      this.prisma.workOrder.count({ where: { rabItemId: id } }),
      this.prisma.stockItem.count({ where: { defaultRabItemId: id } }),
    ]);
    if (rentals + orders + stocks > 0) {
      throw new BadRequestException('Item RAB dipakai oleh sewa alat, SPK, atau material gudang. Lepaskan dulu keterkaitannya.');
    }
    await this.prisma.rabItem.delete({ where: { id } });
    return { deleted: true };
  }

  /** Inti modul 2: perbandingan RAB vs Realisasi per item, per kategori, dan total proyek. */
  async summary(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan');

    const [items, sums] = await Promise.all([
      this.prisma.rabItem.findMany({ where: { projectId, tenantId }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      this.prisma.realization.groupBy({
        by: ['rabItemId'],
        where: { projectId, tenantId },
        _sum: { amount: true },
      }),
    ]);
    const realizedMap = new Map(sums.map((s) => [s.rabItemId, s._sum.amount ?? new Prisma.Decimal(0)]));

    const zero = () => new Prisma.Decimal(0);
    let totalBudget = zero();
    let totalRealized = zero();
    const byCat = new Map<string, { budget: Prisma.Decimal; realized: Prisma.Decimal }>();

    const rows = items.map((it) => {
      const realized = realizedMap.get(it.id) ?? zero();
      totalBudget = totalBudget.add(it.budget);
      totalRealized = totalRealized.add(realized);
      const c = byCat.get(it.category) ?? { budget: zero(), realized: zero() };
      byCat.set(it.category, { budget: c.budget.add(it.budget), realized: c.realized.add(realized) });
      return {
        id: it.id,
        code: it.code,
        name: it.name,
        category: it.category,
        unit: it.unit,
        volume: it.volume.toNumber(),
        unitPrice: it.unitPrice.toNumber(),
        budget: it.budget.toNumber(),
        realized: realized.toNumber(),
        remaining: it.budget.sub(realized).toNumber(),
        usagePercent: usagePercent(it.budget, realized),
        status: budgetStatus(it.budget, realized),
      };
    });

    return {
      project: { id: project.id, code: project.code, name: project.name, rabStatus: project.rabStatus },
      totals: {
        budget: totalBudget.toNumber(),
        realized: totalRealized.toNumber(),
        remaining: totalBudget.sub(totalRealized).toNumber(),
        usagePercent: usagePercent(totalBudget, totalRealized),
        status: budgetStatus(totalBudget, totalRealized),
      },
      byCategory: [...byCat.entries()].map(([category, v]) => ({
        category,
        budget: v.budget.toNumber(),
        realized: v.realized.toNumber(),
        usagePercent: usagePercent(v.budget, v.realized),
        status: budgetStatus(v.budget, v.realized),
      })),
      items: rows,
      alerts: rows
        .filter((r) => r.status !== 'OK')
        .map((r) => ({ itemId: r.id, code: r.code, name: r.name, status: r.status, usagePercent: r.usagePercent })),
    };
  }
}
