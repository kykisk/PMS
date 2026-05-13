CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "entityCode" TEXT,
    "action" TEXT NOT NULL, "changes" JSONB,
    "userId" TEXT, "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_projectId_entityType_entityId_idx" ON "AuditLog"("projectId", "entityType", "entityId");
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");
ALTER TABLE "Feature" ADD COLUMN "outdated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Feature" ADD COLUMN "outdatedReason" TEXT;
ALTER TABLE "Task" ADD COLUMN "outdated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "outdatedReason" TEXT;
ALTER TABLE "TestScenario" ADD COLUMN "outdated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TestScenario" ADD COLUMN "outdatedReason" TEXT;
