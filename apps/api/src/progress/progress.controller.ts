import {
  BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Query,
  Res, StreamableFile, UploadedFiles, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { VerifyProgressDto, progressFormSchema, verifyProgressSchema } from '@buildpro/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MAX_PHOTOS, ProgressService } from './progress.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/progress')
export class ProgressController {
  constructor(private progress: ProgressService) {}

  /** multipart/form-data: percent, notes, latitude, longitude, accuracy, capturedAt, reportDate + file "photos" (maks 5) */
  @Post()
  @UseInterceptors(FilesInterceptor('photos', MAX_PHOTOS, { limits: { fileSize: 12 * 1024 * 1024 } }))
  create(
    @CurrentUser() u: AuthUser,
    @Param('projectId') pid: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const parsed = progressFormSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validasi gagal',
        errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    return this.progress.create(u, pid, parsed.data, files ?? []);
  }

  @Get()
  list(@CurrentUser() u: AuthUser, @Param('projectId') pid: string) {
    return this.progress.list(u, pid);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id/verify')
  verify(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string, @Body(new ZodValidationPipe(verifyProgressSchema)) dto: VerifyProgressDto) {
    return this.progress.verify(u, pid, id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('projectId') pid: string, @Param('id') id: string) {
    return this.progress.remove(u, pid, id);
  }
}

/** Menyajikan foto. Otorisasi memakai tanda tangan pada URL (lihat ProgressService.photoUrl), bukan header. */
@Controller('files')
export class FilesController {
  constructor(private progress: ProgressService) {}

  @Get(':photoId')
  @Header('Cache-Control', 'private, max-age=3600')
  async file(@Param('photoId') photoId: string, @Query('sig') sig: string | undefined, @Res({ passthrough: true }) res: Response) {
    const photo = await this.progress.photoForSignature(photoId, sig);
    res.setHeader('Content-Type', photo.mimeType);
    return new StreamableFile(this.progress.openStream(photo.storageKey));
  }
}
