import { Module } from '@nestjs/common';
import { RabController } from './rab.controller';
import { RabService } from './rab.service';

@Module({ controllers: [RabController], providers: [RabService] })
export class RabModule {}
