import { ForbiddenException, Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth.types';

/** Memastikan proyek milik tenant pengguna, dan mandor hanya mengakses proyek yang ditugaskan. */
@Injectable()
export class ProjectAccessService {
  constructor(private prisma: PrismaService) {}

  async assert(user: AuthUser, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId: user.tenantId } });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan');
    if (user.role === 'MANDOR') {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: user.userId } },
      });
      if (!member) throw new ForbiddenException('Anda tidak ditugaskan di proyek ini');
    }
    return project;
  }
}

@Global()
@Module({ providers: [ProjectAccessService], exports: [ProjectAccessService] })
export class AccessModule {}
