import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { RabModule } from './rab/rab.module';
import { RealizationsModule } from './realizations/realizations.module';
import { AccessModule } from './common/project-access.service';
import { StorageModule } from './storage/storage.service';
import { StockModule } from './stock/stock.module';
import { ProgressModule } from './progress/progress.module';
import { EquipmentModule } from './equipment/equipment.module';
import { OpnameModule } from './opname/opname.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccessModule,
    StorageModule,
    AuthModule,
    ProjectsModule,
    RabModule,
    RealizationsModule,
    StockModule,
    ProgressModule,
    EquipmentModule,
    OpnameModule,
  ],
})
export class AppModule {}
