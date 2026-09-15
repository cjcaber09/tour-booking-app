-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guideId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_guideId_idx" ON "Booking"("guideId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
