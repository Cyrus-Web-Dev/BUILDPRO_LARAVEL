import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesController, ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [AuthModule],
  controllers: [ProgressController, FilesController],
  providers: [ProgressService],
})
export class ProgressModule {}
