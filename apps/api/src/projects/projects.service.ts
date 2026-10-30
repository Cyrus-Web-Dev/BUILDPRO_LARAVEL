import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProjectDto, UpdateProjectDto } from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/project-access.service';
import { AuthUser } from '../common/auth.types';
import { budgetStatus, usagePercent } from '../common/budget.util';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService, private access: ProjectAccessService) {}

  private visibility(user: AuthUser): Prisma.ProjectWhereInput {
    return {
      tenantId: user.tenantId,
      ...(user.role === 'MANDOR' ? { members: { some: { userId: user.userId } } } : {}),
    };
  }

  async create(tenantId: string, dto: CreateProjectDto) {
    const dup = await this.prisma.project.findUnique({ where: { tenantId_code: { tenantId, code: dto.code } } });
    if (dup) throw new ConflictException('Kode proyek sudah dipakai');
    return this.prisma.project.create({ data: { ...dto, tenantId } });
  }

  list(user: AuthUser) {
    return this.prisma.project.findMany({ where: this.visibility(user), orderBy: { createdAt: 'desc' } });
  }

  get(user: AuthUser, id: string) {
    return this.access.assert(user, id);
  }

  private async tenantProject(tenantId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, tenantId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan');
    return project;
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto) {
    await this.tenantProject(tenantId, id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  /** Ringkasan semua proyek. Untuk MANDOR: hanya proyek yang ditugaskan dan tanpa data keuangan. */
  async overview(user: AuthUser) {
    const where = this.visibility(user);
    const projects = await this.prisma.project.findMany({ where, orderBy: { createdAt: 'desc' } });
    const ids = projects.map((p) => p.id);
    const [budgets, spent, progress] = await Promise.all([
      this.prisma.rabItem.groupBy({ by: ['projectId'], where: { projectId: { in: ids } }, _sum: { budget: true } }),
      this.prisma.realization.groupBy({ by: ['projectId'], where: { projectId: { in: ids } }, _sum: { amount: true } }),
      this.prisma.progressReport.groupBy({
        by: ['projectId'],
        where: { projectId: { in: ids }, status: { not: 'REJECTED' } },
        _max: { percent: true },
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const bMap = new Map(budgets.map((b) => [b.projectId, b._sum.budget ?? zero]));
    const sMap = new Map(spent.map((s) => [s.projectId, s._sum.amount ?? zero]));
    const pMap = new Map(progress.map((p) => [p.projectId, p._max.percent?.toNumber() ?? 0]));
    const hideFinance = user.role === 'MANDOR';

    return projects.map((p) => {
      const budget = bMap.get(p.id) ?? zero;
      const realized = sMap.get(p.id) ?? zero;
      return {
        ...p,
        progressPercent: pMap.get(p.id) ?? 0,
        budget: hideFinance ? null : budget.toNumber(),
        realized: hideFinance ? null : realized.toNumber(),
        usagePercent: hideFinance ? null : usagePercent(budget, realized),
        budgetStatus: hideFinance ? null : budgetStatus(budget, realized),
      };
    });
  }

  /** Mengunci RAB. Setelah APPROVED, item RAB tidak bisa diubah dan realisasi boleh dicatat. */
  async approveRab(tenantId: string, id: string) {
    const project = await this.tenantProject(tenantId, id);
    if (project.rabStatus === 'APPROVED') throw new BadRequestException('RAB sudah disetujui');
    const count = await this.prisma.rabItem.count({ where: { projectId: id, tenantId } });
    if (count === 0) throw new BadRequestException('RAB masih kosong');
    return this.prisma.project.update({
      where: { id },
      data: { rabStatus: 'APPROVED', rabApprovedAt: new Date(), status: 'ONGOING' },
    });
  }

  /** Membuka kembali RAB untuk revisi. Hanya boleh jika belum ada realisasi biaya. */
  async reopenRab(tenantId: string, id: string) {
    const project = await this.tenantProject(tenantId, id);
    if (project.rabStatus !== 'APPROVED') throw new BadRequestException('RAB masih berstatus draft');
    const used = await this.prisma.realization.count({ where: { projectId: id, tenantId } });
    if (used > 0) throw new BadRequestException('RAB tidak bisa dibuka kembali karena sudah ada realisasi biaya');
    return this.prisma.project.update({ where: { id }, data: { rabStatus: 'DRAFT', rabApprovedAt: null } });
  }

  async updateStatus(tenantId: string, id: string, status: 'PLANNING' | 'ONGOING' | 'DONE') {
    await this.tenantProject(tenantId, id);
    return this.prisma.project.update({ where: { id }, data: { status } });
  }

  // ---- Tim proyek ----
  async listMembers(tenantId: string, projectId: string) {
    await this.tenantProject(tenantId, projectId);
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId, tenantId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.user);
  }

  async addMember(tenantId: string, projectId: string, userId: string) {
    await this.tenantProject(tenantId, projectId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Pengguna tidak ditemukan');
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { tenantId, projectId, userId },
    });
    return { added: true };
  }

  async removeMember(tenantId: string, projectId: string, userId: string) {
    await this.tenantProject(tenantId, projectId);
    await this.prisma.projectMember.deleteMany({ where: { projectId, userId, tenantId } });
    return { removed: true };
  }
}
