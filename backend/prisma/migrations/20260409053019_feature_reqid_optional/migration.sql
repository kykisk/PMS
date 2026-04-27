-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_reqId_fkey";

-- AlterTable
ALTER TABLE "Feature" ALTER COLUMN "reqId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_reqId_fkey" FOREIGN KEY ("reqId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
