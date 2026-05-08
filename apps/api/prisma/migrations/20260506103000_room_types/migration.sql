-- DropForeignKey
ALTER TABLE "OvertimeRule" DROP CONSTRAINT "OvertimeRule_roomGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Rate" DROP CONSTRAINT "Rate_roomGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_roomGroupId_fkey";

-- DropIndex
DROP INDEX "OvertimeRule_roomGroupId_idx";

-- DropIndex
DROP INDEX "Rate_roomGroupId_idx";

-- DropIndex
DROP INDEX "Room_roomGroupId_idx";

-- AlterTable
ALTER TABLE "OvertimeRule" DROP COLUMN "roomGroupId",
ADD COLUMN     "roomTypeId" TEXT;

-- AlterTable
ALTER TABLE "Rate" DROP COLUMN "roomGroupId",
ADD COLUMN     "roomTypeId" TEXT;

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "roomGroupId",
DROP COLUMN "type",
ADD COLUMN     "roomTypeId" TEXT;

-- DropTable
DROP TABLE "RoomGroup";

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomTypeFeature" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomTypeFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_name_key" ON "RoomType"("name");

-- CreateIndex
CREATE INDEX "RoomTypeFeature_roomTypeId_idx" ON "RoomTypeFeature"("roomTypeId");

-- CreateIndex
CREATE INDEX "OvertimeRule_roomTypeId_idx" ON "OvertimeRule"("roomTypeId");

-- CreateIndex
CREATE INDEX "Rate_roomTypeId_idx" ON "Rate"("roomTypeId");

-- CreateIndex
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTypeFeature" ADD CONSTRAINT "RoomTypeFeature_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRule" ADD CONSTRAINT "OvertimeRule_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
