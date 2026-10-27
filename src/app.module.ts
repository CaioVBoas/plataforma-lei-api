import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { OrgPortalModule } from './modules/org-portal/orgPortal.module';
import { OrgProfileModule } from './modules/orgProfile/orgProfile.module';
import { ProjectsModule } from './modules/projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    OrgPortalModule,
    AccountModule,
    CalendarModule,
    OrgProfileModule,
  ],
})
export class AppModule {}
