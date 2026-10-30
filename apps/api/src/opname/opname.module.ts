import { Module } from '@nestjs/common';
import { OpnameController } from './opname.controller';
import { OpnameService } from './opname.service';

@Module({ controllers: [OpnameController], providers: [OpnameService] })
export class OpnameModule {}
