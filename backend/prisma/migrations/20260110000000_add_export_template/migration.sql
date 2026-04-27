CREATE TABLE "ExportTemplate" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExportTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExportTemplate_type_key" ON "ExportTemplate"("type");
