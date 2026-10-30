import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateWorkOrderDto, OpnameDto, PayOpnameDto } from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/project-access.service';
import { AuthUser } from '../common/auth.types';
import { checkItemBudget } from '../common/budget-check';

type Tx = Prisma.TransactionClient;
const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);
type WoWithLines = Prisma.WorkOrderGetPayload<{ include: { lines: true } }>;
type OpnameFull = Prisma.OpnameGetPayload<{ include: { lines: { include: { line: true } }; workOrder: true } }>;

@Injectable()
export class OpnameService {
  constructor(private prisma: PrismaService, private access: ProjectAccessService) {}

  // ------------------------------------------------------------ SPK
  async createWorkOrder(user: AuthUser, projectId: string, dto: CreateWorkOrderDto) {
    await this.access.assert(user, projectId);
    const rab = await this.prisma.rabItem.findFirst({ where: { id: dto.rabItemId, projectId, tenantId: user.tenantId } });
    if (!rab) throw new NotFoundException('Item RAB tidak ditemukan di proyek ini');
    const dup = await this.prisma.workOrder.findUnique({ where: { projectId_code: { projectId, code: dto.code } } });
    if (dup) throw new ConflictException(`Kode SPK "${dto.code}" sudah dipakai di proyek ini`);
    const wo = await this.prisma.workOrder.create({
      data: {
        tenantId: user.tenantId, projectId, code: dto.code, contractorName: dto.contractorName, title: dto.title,
        rabItemId: dto.rabItemId, retentionPercent: D(dto.retentionPercent ?? 0), notes: dto.notes, createdById: user.userId,
        lines: {
          create: dto.lines.map((l, i) => ({
            description: l.description, unit: l.unit, contractVolume: D(l.contractVolume), unitPrice: D(l.unitPrice), sortOrder: i,
          })),
        },
      },
    });
    return { id: wo.id };
  }

  async listWorkOrders(user: AuthUser, projectId: string) {
    await this.access.assert(user, projectId);
    const rows = await this.prisma.workOrder.findMany({
      where: { projectId, tenantId: user.tenantId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        opnames: { where: { status: { not: 'CANCELLED' } }, include: { lines: true }, orderBy: { number: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((wo) => {
      const certified = wo.opnames.filter((o) => o.status === 'APPROVED' || o.status === 'PAID');
      const last = certified[certified.length - 1];
      const certVol = new Map((last?.lines ?? []).map((l) => [l.lineId, l.cumulativeVolume]));
      const sum = (arr: typeof wo.opnames, f: (o: (typeof wo.opnames)[number]) => Prisma.Decimal) => arr.reduce((a, o) => a.add(f(o)), D(0));
      const contractValue = wo.lines.reduce((a, l) => a.add(l.contractVolume.mul(l.unitPrice)), D(0));
      const certifiedGross = sum(certified, (o) => o.grossAmount);
      return {
        id: wo.id, code: wo.code, title: wo.title, contractorName: wo.contractorName, status: wo.status,
        retentionPercent: wo.retentionPercent.toNumber(), rabItemId: wo.rabItemId, notes: wo.notes,
        contractValue: contractValue.toNumber(),
        certifiedGross: certifiedGross.toNumber(),
        progressPercent: contractValue.gt(0) ? certifiedGross.div(contractValue).mul(100).toDecimalPlaces(2).toNumber() : 0,
        retentionHeld: sum(certified, (o) => o.retentionAmount).toNumber(),
        paidNet: sum(certified.filter((o) => o.status === 'PAID'), (o) => o.netAmount).toNumber(),
        unpaidNet: sum(certified.filter((o) => o.status === 'APPROVED'), (o) => o.netAmount).toNumber(),
        hasDraft: wo.opnames.some((o) => o.status === 'DRAFT'),
        lines: wo.lines.map((l) => ({
          id: l.id, description: l.description, unit: l.unit,
          contractVolume: l.contractVolume.toNumber(), unitPrice: l.unitPrice.toNumber(),
          certifiedVolume: (certVol.get(l.id) ?? D(0)).toNumber(),
        })),
      };
    });
  }

  async closeWorkOrder(user: AuthUser, projectId: string, id: string) {
    await this.access.assert(user, projectId);
    const wo = await this.prisma.workOrder.findFirst({ where: { id, projectId, tenantId: user.tenantId } });
    if (!wo) throw new NotFoundException('SPK tidak ditemukan');
    const draft = await this.prisma.opname.count({ where: { workOrderId: id, status: 'DRAFT' } });
    if (draft > 0) throw new BadRequestException('Masih ada opname draft. Setujui atau batalkan dulu.');
    await this.prisma.workOrder.update({ where: { id }, data: { status: 'CLOSED' } });
    return { closed: true };
  }

  async deleteWorkOrder(user: AuthUser, projectId: string, id: string) {
    await this.access.assert(user, projectId);
    const wo = await this.prisma.workOrder.findFirst({ where: { id, projectId, tenantId: user.tenantId } });
    if (!wo) throw new NotFoundException('SPK tidak ditemukan');
    const used = await this.prisma.opname.count({ where: { workOrderId: id, status: { in: ['APPROVED', 'PAID'] } } });
    if (used > 0) throw new BadRequestException('SPK sudah punya opname yang disetujui, tidak bisa dihapus');
    await this.prisma.workOrder.delete({ where: { id } });
    return { deleted: true };
  }

  // ------------------------------------------------------------ opname
  private opnameView(o: OpnameFull) {
    return {
      id: o.id, number: o.number, date: o.date, notes: o.notes, status: o.status,
      grossAmount: o.grossAmount.toNumber(), retentionAmount: o.retentionAmount.toNumber(),
      deduction: o.deduction.toNumber(), netAmount: o.netAmount.toNumber(),
      approvedAt: o.approvedAt, paidAt: o.paidAt, paymentRef: o.paymentRef,
      workOrder: { id: o.workOrder.id, code: o.workOrder.code, title: o.workOrder.title, contractorName: o.workOrder.contractorName },
      lines: o.lines.map((l) => ({
        lineId: l.lineId, description: l.line.description, unit: l.line.unit, unitPrice: l.line.unitPrice.toNumber(),
        contractVolume: l.line.contractVolume.toNumber(),
        previousVolume: l.previousVolume.toNumber(), cumulativeVolume: l.cumulativeVolume.toNumber(),
        thisVolume: l.thisVolume.toNumber(), amount: l.amount.toNumber(),
      })),
    };
  }

  async list(user: AuthUser, projectId: string, workOrderId?: string) {
    await this.access.assert(user, projectId);
    const rows = await this.prisma.opname.findMany({
      where: { projectId, tenantId: user.tenantId, ...(workOrderId ? { workOrderId } : {}) },
      include: { lines: { include: { line: true }, orderBy: { line: { sortOrder: 'asc' } } }, workOrder: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
    return rows.map((o) => this.opnameView(o));
  }

  /** Volume kumulatif terakhir yang sudah disetujui, per item SPK. */
  private async certifiedMap(tx: Tx, workOrderId: string) {
    const last = await tx.opname.findFirst({
      where: { workOrderId, status: { in: ['APPROVED', 'PAID'] } }, orderBy: { number: 'desc' }, include: { lines: true },
    });
    return new Map((last?.lines ?? []).map((l) => [l.lineId, l.cumulativeVolume]));
  }

  /** Menghitung baris, nilai bruto, retensi, dan nilai bersih sebuah opname. */
  private compute(wo: WoWithLines, prev: Map<string, Prisma.Decimal>, dto: OpnameDto) {
    const given = new Map<string, number>();
    for (const l of dto.lines) {
      if (given.has(l.lineId)) throw new BadRequestException('Ada item pekerjaan yang dikirim dua kali');
      if (!wo.lines.some((x) => x.id === l.lineId)) throw new BadRequestException('Ada item yang bukan bagian dari SPK ini');
      given.set(l.lineId, l.cumulativeVolume);
    }
    let gross = D(0);
    let anyNew = false;
    const lines = [...wo.lines].sort((a, b) => a.sortOrder - b.sortOrder).map((wl) => {
      const previous = prev.get(wl.id) ?? D(0);
      const cum = given.has(wl.id) ? D(given.get(wl.id)!) : previous;
      if (cum.lt(previous)) {
        throw new BadRequestException(`Volume "${wl.description}" (${cum.toNumber()}) tidak boleh lebih kecil dari opname sebelumnya (${previous.toNumber()})`);
      }
      if (cum.gt(wl.contractVolume)) {
        throw new BadRequestException(`Volume "${wl.description}" (${cum.toNumber()}) melebihi volume kontrak (${wl.contractVolume.toNumber()}). Perlu addendum SPK.`);
      }
      const thisVolume = cum.sub(previous);
      const amount = thisVolume.mul(wl.unitPrice).toDecimalPlaces(2);
      if (thisVolume.gt(0)) anyNew = true;
      gross = gross.add(amount);
      return { lineId: wl.id, previousVolume: previous, cumulativeVolume: cum, thisVolume, amount };
    });
    if (!anyNew) throw new BadRequestException('Tidak ada volume pekerjaan baru yang diopname');
    const retention = gross.mul(wo.retentionPercent).div(100).toDecimalPlaces(2);
    const deduction = D(dto.deduction ?? 0);
    const net = gross.sub(retention).sub(deduction);
    if (net.lt(0)) throw new BadRequestException('Potongan melebihi nilai bersih opname');
    return { lines, gross, retention, deduction, net };
  }

  private async loadWorkOrder(tx: Tx, user: AuthUser, projectId: string, id: string) {
    const wo = await tx.workOrder.findFirst({ where: { id, projectId, tenantId: user.tenantId }, include: { lines: true } });
    if (!wo) throw new NotFoundException('SPK tidak ditemukan');
    return wo;
  }

  private async fullOpname(tx: Tx, id: string) {
    return tx.opname.findUniqueOrThrow({
      where: { id }, include: { lines: { include: { line: true }, orderBy: { line: { sortOrder: 'asc' } } }, workOrder: true },
    });
  }

  async createOpname(user: AuthUser, projectId: string, workOrderId: string, dto: OpnameDto) {
    await this.access.assert(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const wo = await this.loadWorkOrder(tx, user, projectId, workOrderId);
      if (wo.status !== 'ACTIVE') throw new BadRequestException('SPK sudah ditutup');
      const draft = await tx.opname.count({ where: { workOrderId, status: 'DRAFT' } });
      if (draft > 0) throw new ConflictException('Masih ada opname draft untuk SPK ini. Ubah, setujui, atau batalkan dulu.');
      const c = this.compute(wo, await this.certifiedMap(tx, workOrderId), dto);
      const max = await tx.opname.aggregate({ where: { workOrderId }, _max: { number: true } });
      const created = await tx.opname.create({
        data: {
          tenantId: user.tenantId, projectId, workOrderId, number: (max._max.number ?? 0) + 1, date: dto.date, notes: dto.notes,
          grossAmount: c.gross, retentionAmount: c.retention, deduction: c.deduction, netAmount: c.net, createdById: user.userId,
          lines: { create: c.lines },
        },
      });
      return this.opnameView(await this.fullOpname(tx, created.id));
    });
  }

  async updateOpname(user: AuthUser, projectId: string, id: string, dto: OpnameDto) {
    await this.access.assert(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const o = await tx.opname.findFirst({ where: { id, projectId, tenantId: user.tenantId } });
      if (!o) throw new NotFoundException('Opname tidak ditemukan');
      if (o.status !== 'DRAFT') throw new BadRequestException('Hanya opname draft yang bisa diubah');
      const wo = await this.loadWorkOrder(tx, user, projectId, o.workOrderId);
      const c = this.compute(wo, await this.certifiedMap(tx, wo.id), dto);
      await tx.opnameLine.deleteMany({ where: { opnameId: id } });
      await tx.opname.update({
        where: { id },
        data: {
          date: dto.date, notes: dto.notes, grossAmount: c.gross, retentionAmount: c.retention, deduction: c.deduction, netAmount: c.net,
          lines: { create: c.lines },
        },
      });
      return this.opnameView(await this.fullOpname(tx, id));
    });
  }

  /** Persetujuan Owner: nilai pekerjaan (bruto) otomatis menjadi realisasi biaya RAB. */
  async approve(user: AuthUser, projectId: string, id: string) {
    const project = await this.access.assert(user, projectId);
    if (project.rabStatus !== 'APPROVED') throw new BadRequestException('RAB belum disetujui. Setujui RAB sebelum menyetujui opname.');
    return this.prisma.$transaction(async (tx) => {
      const o = await tx.opname.findFirst({ where: { id, projectId, tenantId: user.tenantId }, include: { lines: true } });
      if (!o) throw new NotFoundException('Opname tidak ditemukan');
      if (o.status !== 'DRAFT') throw new BadRequestException('Opname bukan berstatus draft');
      const wo = await this.loadWorkOrder(tx, user, projectId, o.workOrderId);

      // Pastikan opname sebelumnya tidak berubah sejak draft ini dibuat
      const prev = await this.certifiedMap(tx, wo.id);
      for (const l of o.lines) {
        if (!(prev.get(l.lineId) ?? D(0)).eq(l.previousVolume)) {
          throw new ConflictException('Data opname sebelumnya berubah. Ubah draft ini (simpan ulang) lalu setujui lagi.');
        }
      }
      const rab = await tx.rabItem.findFirst({ where: { id: wo.rabItemId, projectId, tenantId: user.tenantId } });
      if (!rab) throw new NotFoundException('Item RAB untuk SPK ini sudah tidak ada');

      let realizationId: string | undefined;
      if (o.grossAmount.gt(0)) {
        const r = await tx.realization.create({
          data: {
            tenantId: user.tenantId, projectId, rabItemId: rab.id, date: o.date,
            description: `Opname termin ${o.number} - ${wo.code} ${wo.title}`,
            amount: o.grossAmount, vendor: wo.contractorName, source: 'OPNAME', createdById: user.userId,
          },
        });
        realizationId = r.id;
      }
      await tx.opname.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.userId, approvedAt: new Date(), realizationId } });
      const budget = realizationId ? await checkItemBudget(tx, rab) : null;
      return { opname: this.opnameView(await this.fullOpname(tx, id)), budgetAlert: budget?.alert ?? null };
    });
  }

  async pay(user: AuthUser, projectId: string, id: string, dto: PayOpnameDto) {
    await this.access.assert(user, projectId);
    const o = await this.prisma.opname.findFirst({ where: { id, projectId, tenantId: user.tenantId } });
    if (!o) throw new NotFoundException('Opname tidak ditemukan');
    if (o.status !== 'APPROVED') throw new BadRequestException('Hanya opname yang sudah disetujui yang bisa ditandai dibayar');
    await this.prisma.opname.update({ where: { id }, data: { status: 'PAID', paidAt: dto.paidDate, paymentRef: dto.reference } });
    return { paid: true };
  }

  /** Draft: admin. Yang sudah disetujui (belum dibayar): hanya Owner, dan hanya opname terakhir agar rantai volume tetap konsisten. */
  async cancel(user: AuthUser, projectId: string, id: string) {
    await this.access.assert(user, projectId);
    return this.prisma.$transaction(async (tx) => {
      const o = await tx.opname.findFirst({ where: { id, projectId, tenantId: user.tenantId } });
      if (!o) throw new NotFoundException('Opname tidak ditemukan');
      if (o.status === 'CANCELLED') throw new BadRequestException('Opname sudah dibatalkan');
      if (o.status === 'PAID') throw new BadRequestException('Opname yang sudah dibayar tidak bisa dibatalkan');
      if (o.status === 'APPROVED') {
        if (user.role !== 'OWNER') throw new ForbiddenException('Hanya Owner yang dapat membatalkan opname yang sudah disetujui');
        const later = await tx.opname.count({ where: { workOrderId: o.workOrderId, number: { gt: o.number }, status: { not: 'CANCELLED' } } });
        if (later > 0) throw new BadRequestException('Batalkan opname yang lebih baru terlebih dahulu');
        if (o.realizationId) await tx.realization.deleteMany({ where: { id: o.realizationId, tenantId: user.tenantId } });
      }
      await tx.opname.update({ where: { id }, data: { status: 'CANCELLED', realizationId: null } });
      return { cancelled: true };
    });
  }
}
