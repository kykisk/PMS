CREATE TABLE "SpecDocument" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpecDocument_projectId_idx" ON "SpecDocument"("projectId");
