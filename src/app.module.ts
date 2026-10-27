import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { DemandsModule } from './modules/demands/demands.module';
import { DisciplinesModule } from './modules/disciplines/disciplines.module';
import { OrgPortalModule } from './modules/org-portal/orgPortal.module';
import { OrgProfileModule } from './modules/orgProfile/orgProfile.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SkillsModule } from './modules/skills/skills.module';

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
    DisciplinesModule,
    SkillsModule,
    OrganizationsModule,
    DemandsModule,
  ],
})
export class AppModule {}

