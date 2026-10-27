-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "tutorialSeen" BOOLEAN NOT NULL DEFAULT false;
