ALTER TABLE "Project" ADD COLUMN "code" TEXT;
ALTER TABLE "Project" ADD COLUMN "type" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "ProjectMember" ADD COLUMN "note" TEXT;
CREATE TABLE "ExternalProjectMember" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL, "nameEn" TEXT, "email" TEXT, "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER', "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalProjectMember_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ExternalProjectMember" ADD CONSTRAINT "ExternalProjectMember_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
