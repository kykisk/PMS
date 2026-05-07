import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { RequirementModule } from './requirement/requirement.module';
import { VersionModule } from './version/version.module';
import { FeatureModule } from './feature/feature.module';
import { TaskModule } from './task/task.module';
import { TestManagementModule } from './test-management/test-management.module';
import { TraceabilityModule } from './traceability/traceability.module';
import { AdminModule } from './admin/admin.module';
import { AIModule } from './ai/ai.module';
import { ExportModule } from './export/export.module';
import { DesignModule } from './design/design.module';
import { ChangeRequestModule } from './change-request/change-request.module';
import { UsecaseModule } from './usecase/usecase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProjectModule,
    RequirementModule,
    VersionModule,
    FeatureModule,
    TaskModule,
    TestManagementModule,
    TraceabilityModule,
    AdminModule,
    AIModule,
    ExportModule,
    DesignModule,
    ChangeRequestModule,
    UsecaseModule,
  ],
})
export class AppModule {}
