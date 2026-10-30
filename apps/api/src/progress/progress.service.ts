import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ProgressFormDto, VerifyProgressDto } from '@buildpro/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ProjectAccessService } from '../common/project-access.service';
import { AuthUser } from '../common/auth.types';
import { detectImage } from './image.util';

export const MAX_PHOTOS = 5;

type ReportWithRels = Prisma.ProgressReportGetPayload<{ include: { photos: true; createdBy: { select: { name: true } } } }>;

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private access: ProjectAccessService,
    private jwt: JwtService,
  ) {}

  /** URL relatif ke endpoint file, ditandatangani 2 jam sehingga <img> bisa memuatnya tanpa header Authorization. */
  private photoUrl(photoId: string, tenantId: string) {
    const sig = this.jwt.sign({ typ: 'file', pid: photoId, tid: tenantId }, { expiresIn: '2h' });
    return `/files/${photoId}?sig=${sig}`;
  }

  private view(r: ReportWithRels) {
    return {
      id: r.id, reportDate: r.reportDate, percent: r.percent.toNumber(), notes: r.notes,
      latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy, capturedAt: r.capturedAt,
      status: r.status, reviewComment: r.reviewComment, reviewedAt: r.reviewedAt,
      createdAt: r.createdAt, createdBy: r.createdBy.name,
      photos: [...r.photos].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({ id: p.id, url: this.photoUrl(p.id, r.tenantId) })),
    };
  }

  async create(user: AuthUser, projectId: string, dto: ProgressFormDto, files: Express.Multer.File[]) {
    await this.access.assert(user, projectId);
    if (!files?.length) throw new BadRequestException('Wajib melampirkan minimal 1 foto kondisi lapangan');
    if (files.length > MAX_PHOTOS) throw new BadRequestException(`Maksimal ${MAX_PHOTOS} foto per laporan`);

    const images = files.map((f, i) => {
      const kind = detectImage(f.buffer);
      if (!kind) throw new BadRequestException(`File ke-${i + 1} bukan gambar yang valid (JPEG, PNG, atau WebP)`);
      return { buffer: f.buffer, size: f.size, ...kind };
    });

    // Persentase kumulatif tidak boleh lebih kecil dari laporan sebelumnya yang tidak ditolak
    const max = await this.prisma.progressReport.aggregate({
      where: { projectId, tenantId: user.tenantId, status: { not: 'REJECTED' } },
      _max: { percent: true },
    });
    const prev = max._max.percent?.toNumber();
    if (prev !== undefined && dto.percent < prev) {
      throw new BadRequestException(`Progres tidak boleh lebih kecil dari laporan terakhir (${prev}%). Hubungi admin bila perlu koreksi.`);
    }

    const keys = images.map((img) => `${user.tenantId}/${projectId}/${randomUUID()}.${img.ext}`);
    await Promise.all(images.map((img, i) => this.storage.save(keys[i], img.buffer)));

    try {
      const report = await this.prisma.progressReport.create({
        data: {
          tenantId: user.tenantId, projectId, createdById: user.userId,
          reportDate: dto.reportDate ?? new Date(), percent: new Prisma.Decimal(dto.percent),
          notes: dto.notes, latitude: dto.latitude, longitude: dto.longitude, accuracy: dto.accuracy, capturedAt: dto.capturedAt,
          photos: {
            create: images.map((img, i) => ({ tenantId: user.tenantId, storageKey: keys[i], mimeType: img.mime, size: img.size, sortOrder: i })),
          },
        },
        include: { photos: true, createdBy: { select: { name: true } } },
      });
      return this.view(report);
    } catch (e) {
      await Promise.all(keys.map((k) => this.storage.remove(k).catch(() => undefined)));
      throw e;
    }
  }

  async list(user: AuthUser, projectId: string) {
    await this.access.assert(user, projectId);
    const rows = await this.prisma.progressReport.findMany({
      where: { projectId, tenantId: user.tenantId },
      include: { photos: true, createdBy: { select: { name: true } } },
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return rows.map((r) => this.view(r));
  }

  async verify(user: AuthUser, projectId: string, id: string, dto: VerifyProgressDto) {
    await this.access.assert(user, projectId);
    const report = await this.prisma.progressReport.findFirst({ where: { id, projectId, tenantId: user.tenantId } });
    if (!report) throw new NotFoundException('Laporan tidak ditemukan');
    const updated = await this.prisma.progressReport.update({
      where: { id },
      data: { status: dto.status, reviewComment: dto.comment, reviewedById: user.userId, reviewedAt: new Date() },
      include: { photos: true, createdBy: { select: { name: true } } },
    });
    return this.view(updated);
  }

  async remove(user: AuthUser, projectId: string, id: string) {
    await this.access.assert(user, projectId);
    const report = await this.prisma.progressReport.findFirst({ where: { id, projectId, tenantId: user.tenantId }, include: { photos: true } });
    if (!report) throw new NotFoundException('Laporan tidak ditemukan');
    await this.prisma.progressReport.delete({ where: { id } });
    await Promise.all(report.photos.map((p) => this.storage.remove(p.storageKey).catch(() => undefined)));
    return { deleted: true };
  }

  /** Dipakai endpoint file: validasi tanda tangan lalu kembalikan metadata foto. */
  async photoForSignature(photoId: string, sig?: string) {
    let payload: { typ?: string; pid?: string; tid?: string };
    try {
      payload = this.jwt.verify(sig ?? '');
    } catch {
      throw new NotFoundException();
    }
    if (payload.typ !== 'file' || payload.pid !== photoId) throw new NotFoundException();
    const photo = await this.prisma.progressPhoto.findFirst({ where: { id: photoId, tenantId: payload.tid } });
    if (!photo) throw new NotFoundException();
    return photo;
  }

  openStream(storageKey: string) {
    return this.storage.stream(storageKey);
  }
}
