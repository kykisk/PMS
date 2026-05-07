-- DropForeignKey
ALTER TABLE "ScreenImage" DROP CONSTRAINT "ScreenImage_featureId_fkey";

-- AddForeignKey
ALTER TABLE "ScreenImage" ADD CONSTRAINT "ScreenImage_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestScenario" ADD CONSTRAINT "TestScenario_reqId_fkey" FOREIGN KEY ("reqId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
