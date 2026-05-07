CREATE TABLE "ScreenImage" (
    "id" TEXT NOT NULL, "featureId" TEXT NOT NULL,
    "filename" TEXT NOT NULL, "originalName" TEXT NOT NULL,
    "url" TEXT NOT NULL, "size" INTEGER, "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreenImage_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ScreenImage" ADD CONSTRAINT "ScreenImage_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE;
