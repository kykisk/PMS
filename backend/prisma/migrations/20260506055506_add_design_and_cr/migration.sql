-- DropForeignKey
ALTER TABLE "ApiSpec" DROP CONSTRAINT "ApiSpec_featureId_fkey";

-- DropForeignKey
ALTER TABLE "ApiSpec" DROP CONSTRAINT "ApiSpec_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ChangeRequest" DROP CONSTRAINT "ChangeRequest_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ChangeRequestRequirement" DROP CONSTRAINT "ChangeRequestRequirement_changeRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ChangeRequestRequirement" DROP CONSTRAINT "ChangeRequestRequirement_requirementId_fkey";

-- DropForeignKey
ALTER TABLE "DbTable" DROP CONSTRAINT "DbTable_featureId_fkey";

-- DropForeignKey
ALTER TABLE "DbTable" DROP CONSTRAINT "DbTable_projectId_fkey";

-- DropIndex
DROP INDEX "ChangeRequest_projectId_code_key";

-- AddForeignKey
ALTER TABLE "DbTable" ADD CONSTRAINT "DbTable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DbTable" ADD CONSTRAINT "DbTable_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiSpec" ADD CONSTRAINT "ApiSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiSpec" ADD CONSTRAINT "ApiSpec_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestRequirement" ADD CONSTRAINT "ChangeRequestRequirement_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestRequirement" ADD CONSTRAINT "ChangeRequestRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
