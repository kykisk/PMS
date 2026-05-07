CREATE TABLE "UseCase" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "code" TEXT NOT NULL,
    "title" TEXT NOT NULL, "actor" TEXT, "description" TEXT,
    "precondition" TEXT, "mainFlow" JSONB, "altFlow" JSONB, "postcondition" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium', "status" TEXT NOT NULL DEFAULT 'draft',
    "requirementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UseCase_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserStory" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "code" TEXT NOT NULL,
    "title" TEXT NOT NULL, "asA" TEXT, "iWantTo" TEXT, "soThat" TEXT,
    "acceptanceCriteria" JSONB, "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'draft', "storyPoints" INTEGER,
    "requirementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserStory_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "UseCase" ADD CONSTRAINT "UseCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
ALTER TABLE "UseCase" ADD CONSTRAINT "UseCase_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL;
ALTER TABLE "UserStory" ADD CONSTRAINT "UserStory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
ALTER TABLE "UserStory" ADD CONSTRAINT "UserStory_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL;
