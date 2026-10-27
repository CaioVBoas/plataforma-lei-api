import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { DemandsController } from './demands.controller';
import { DemandsService } from './demands.service';
import { OrgDemandsController } from './orgDemands.controller';
import { OrgDemandsService } from './orgDemands.service';

@Module({
  imports: [PrismaModule],
  controllers: [DemandsController, OrgDemandsController],
  providers: [DemandsService, OrgDemandsService],
  exports: [DemandsService, OrgDemandsService],
})
export class DemandsModule {}
