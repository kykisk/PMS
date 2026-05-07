CREATE TABLE "DbTable" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "featureId" TEXT,
    "name" TEXT NOT NULL, "description" TEXT, "columns" JSONB NOT NULL, "indexes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DbTable_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApiSpec" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "featureId" TEXT,
    "method" TEXT NOT NULL, "path" TEXT NOT NULL, "summary" TEXT NOT NULL,
    "description" TEXT, "requestBody" JSONB, "responseBody" JSONB, "parameters" JSONB, "statusCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApiSpec_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "code" TEXT NOT NULL,
    "title" TEXT NOT NULL, "description" TEXT, "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft', "priority" TEXT NOT NULL DEFAULT 'medium',
    "requestedBy" TEXT, "approvedBy" TEXT, "affectedItems" JSONB, "aiAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChangeRequestRequirement" (
    "id" TEXT NOT NULL, "changeRequestId" TEXT NOT NULL, "requirementId" TEXT NOT NULL,
    CONSTRAINT "ChangeRequestRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChangeRequest_projectId_code_key" ON "ChangeRequest"("projectId", "code");
CREATE UNIQUE INDEX "ChangeRequestRequirement_changeRequestId_requirementId_key" ON "ChangeRequestRequirement"("changeRequestId", "requirementId");
ALTER TABLE "DbTable" ADD CONSTRAINT "DbTable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
ALTER TABLE "DbTable" ADD CONSTRAINT "DbTable_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL;
ALTER TABLE "ApiSpec" ADD CONSTRAINT "ApiSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
ALTER TABLE "ApiSpec" ADD CONSTRAINT "ApiSpec_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL;
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
ALTER TABLE "ChangeRequestRequirement" ADD CONSTRAINT "ChangeRequestRequirement_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE;
ALTER TABLE "ChangeRequestRequirement" ADD CONSTRAINT "ChangeRequestRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE;
