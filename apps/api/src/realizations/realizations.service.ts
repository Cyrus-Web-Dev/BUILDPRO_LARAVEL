import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateRealizationDto } from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { budgetStatus, usagePercent } from '../common/budget.util';
import { AuthUser } from '../common/auth.types';

@Injectable()
export class RealizationsService {
  constructor(private prisma: PrismaService) {}

  async create(user: AuthUser, projectId: string, dto: CreateRealizationDto) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId: user.tenantId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan');
    if (project.rabStatus !== 'APPROVED') {
      throw new BadRequestException('RAB belum disetujui. Setujui RAB sebelum mencatat realisasi biaya.');
    }

    // Atomic: catat biaya + hitung ulang total item dalam satu transaksi
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.rabItem.findFirst({ where: { id: dto.rabItemId, projectId, tenantId: user.tenantId } });
      if (!item) throw new NotFoundException('Item RAB tidak ditemukan di proyek ini');

      const realization = await tx.realization.create({
        data: {
          tenantId: user.tenantId,
          projectId,
          rabItemId: item.id,
          date: dto.date,
          description: dto.description,
          amount: new Prisma.Decimal(dto.amount),
          quantity: dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : undefined,
          vendor: dto.vendor,
          receiptUrl: dto.receiptUrl,
          source: 'MANUAL',
          createdById: user.userId,
        },
      });

      const agg = await tx.realization.aggregate({ where: { rabItemId: item.id }, _sum: { amount: true } });
      const realized = agg._sum.amount ?? new Prisma.Decimal(0);
      const status = budgetStatus(item.budget, realized);

      return {
        realization,
        item: {
          id: item.id,
          code: item.code,
          name: item.name,
          budget: item.budget.toNumber(),
          realized: realized.toNumber(),
          remaining: item.budget.sub(realized).toNumber(),
          usagePercent: usagePercent(item.budget, realized),
          status,
        },
        alert:
          status === 'OK'
            ? null
            : {
                level: status,
                message:
                  status === 'OVER'
                    ? `Biaya "${item.name}" MELEBIHI anggaran RAB`
                    : `Biaya "${item.name}" sudah mencapai 80% atau lebih dari anggaran RAB`,
              },
      };
    });
  }

  async list(tenantId: string, projectId: string, rabItemId?: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan');
    return this.prisma.realization.findMany({
      where: { tenantId, projectId, ...(rabItemId ? { rabItemId } : {}) },
      orderBy: { date: 'desc' },
      include: { rabItem: { select: { code: true, name: true, category: true } } },
    });
  }

  async remove(tenantId: string, projectId: string, id: string) {
    const r = await this.prisma.realization.findFirst({ where: { id, projectId, tenantId } });
    if (!r) throw new NotFoundException('Data realisasi tidak ditemukan');
    if (r.source !== 'MANUAL') {
      throw new BadRequestException('Realisasi otomatis dari modul lain hanya bisa dibatalkan dari modul asalnya');
    }
    await this.prisma.realization.delete({ where: { id } });
    return { deleted: true };
  }
}
