import { Module } from '@nestjs/common';
import { OrgPortalController } from './orgPortal.controller';
import { OrgPortalService } from './orgPortal.service';

@Module({
  controllers: [OrgPortalController],
  providers: [OrgPortalService],
})
export class OrgPortalModule {}
