-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'difficult');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'LEAD_GUIDE', 'GUIDE');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "summary" TEXT,
    "duration" INTEGER,
    "maxGroupSize" INTEGER,
    "difficulty" "Difficulty",
    "price" DECIMAL(10,2) NOT NULL,
    "priceDiscount" DECIMAL(10,2),
    "ratingsAverage" DECIMAL(2,1) NOT NULL DEFAULT 4.5,
    "ratingsQuantity" INTEGER NOT NULL DEFAULT 0,
    "imageCover" TEXT NOT NULL,
    "images" TEXT[],
    "startDates" TIMESTAMP(3)[],
    "startLocation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TourCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tour_slug_key" ON "Tour"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "_TourCategories_AB_unique" ON "_TourCategories"("A", "B");

-- CreateIndex
CREATE INDEX "_TourCategories_B_index" ON "_TourCategories"("B");

-- AddForeignKey
ALTER TABLE "_TourCategories" ADD CONSTRAINT "_TourCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TourCategories" ADD CONSTRAINT "_TourCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
