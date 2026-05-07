-- DropForeignKey
ALTER TABLE "ExternalProjectMember" DROP CONSTRAINT "ExternalProjectMember_projectId_fkey";

-- AddForeignKey
ALTER TABLE "ExternalProjectMember" ADD CONSTRAINT "ExternalProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
