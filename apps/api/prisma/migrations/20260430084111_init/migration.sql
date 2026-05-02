-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessDate" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openedByUserId" TEXT,
    "closedByUserId" TEXT,
    CONSTRAINT "Shift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Shift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StayGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stayId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StayGuest_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StayGuest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stayId" TEXT NOT NULL,
    "shiftId" TEXT,
    "receivedByUserId" TEXT,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalReference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Payment_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Charge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stayId" TEXT,
    "roomId" TEXT,
    "productId" TEXT,
    "guestId" TEXT,
    "chargeType" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'ROOM_ACCOUNT',
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Charge_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Charge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Charge_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Charge_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Charge" ("createdAt", "description", "id", "paymentMethod", "productId", "quantity", "roomId", "status", "stayId", "totalCents", "unitPriceCents") SELECT "createdAt", "description", "id", "paymentMethod", "productId", "quantity", "roomId", "status", "stayId", "totalCents", "unitPriceCents" FROM "Charge";
DROP TABLE "Charge";
ALTER TABLE "new_Charge" RENAME TO "Charge";
CREATE INDEX "Charge_stayId_idx" ON "Charge"("stayId");
CREATE INDEX "Charge_roomId_idx" ON "Charge"("roomId");
CREATE INDEX "Charge_guestId_idx" ON "Charge"("guestId");
CREATE INDEX "Charge_productId_idx" ON "Charge"("productId");
CREATE TABLE "new_Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL DEFAULT 'DNI',
    "documentNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthDate" DATETIME,
    "district" TEXT NOT NULL DEFAULT '',
    "occupation" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Guest" ("createdAt", "district", "documentNumber", "documentType", "email", "fullName", "id", "phone", "updatedAt") SELECT "createdAt", "district", "documentNumber", "documentType", "email", "fullName", "id", "phone", "updatedAt" FROM "Guest";
DROP TABLE "Guest";
ALTER TABLE "new_Guest" RENAME TO "Guest";
CREATE INDEX "Guest_documentNumber_idx" ON "Guest"("documentNumber");
CREATE TABLE "new_Stay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "checkInShiftId" TEXT,
    "checkOutShiftId" TEXT,
    "checkedInByUserId" TEXT,
    "checkedOutByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "timingStatus" TEXT NOT NULL DEFAULT 'ON_TIME',
    "checkInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedCheckOutAt" DATETIME,
    "checkOutAt" DATETIME,
    "stayHours" INTEGER NOT NULL,
    "extraMinutes" INTEGER NOT NULL DEFAULT 0,
    "rateCents" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Stay_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Stay_checkInShiftId_fkey" FOREIGN KEY ("checkInShiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Stay_checkOutShiftId_fkey" FOREIGN KEY ("checkOutShiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Stay_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Stay_checkedOutByUserId_fkey" FOREIGN KEY ("checkedOutByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Stay" ("checkInAt", "checkOutAt", "createdAt", "guestId", "id", "notes", "plannedCheckOutAt", "rateCents", "roomId", "status", "stayHours", "updatedAt") SELECT "checkInAt", "checkOutAt", "createdAt", "guestId", "id", "notes", "plannedCheckOutAt", "rateCents", "roomId", "status", "stayHours", "updatedAt" FROM "Stay";
DROP TABLE "Stay";
ALTER TABLE "new_Stay" RENAME TO "Stay";
CREATE INDEX "Stay_roomId_status_idx" ON "Stay"("roomId", "status");
CREATE INDEX "Stay_guestId_idx" ON "Stay"("guestId");
CREATE INDEX "Stay_checkInShiftId_idx" ON "Stay"("checkInShiftId");
CREATE INDEX "Stay_checkOutShiftId_idx" ON "Stay"("checkOutShiftId");
CREATE INDEX "Stay_checkedInByUserId_idx" ON "Stay"("checkedInByUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Shift_businessDate_status_idx" ON "Shift"("businessDate", "status");

-- CreateIndex
CREATE INDEX "Shift_openedByUserId_idx" ON "Shift"("openedByUserId");

-- CreateIndex
CREATE INDEX "StayGuest_guestId_idx" ON "StayGuest"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "StayGuest_stayId_guestId_role_key" ON "StayGuest"("stayId", "guestId", "role");

-- CreateIndex
CREATE INDEX "Payment_stayId_idx" ON "Payment"("stayId");

-- CreateIndex
CREATE INDEX "Payment_shiftId_idx" ON "Payment"("shiftId");

-- CreateIndex
CREATE INDEX "Payment_receivedByUserId_idx" ON "Payment"("receivedByUserId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");
