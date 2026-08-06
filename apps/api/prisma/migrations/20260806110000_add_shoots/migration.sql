-- CreateEnum
CREATE TYPE "ShootStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Shoot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT,
    "type" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "crewIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipment" TEXT,
    "notes" TEXT,
    "status" "ShootStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shoot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shoot_organizationId_scheduledAt_idx" ON "Shoot"("organizationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Shoot_clientId_idx" ON "Shoot"("clientId");

-- AddForeignKey
ALTER TABLE "Shoot" ADD CONSTRAINT "Shoot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shoot" ADD CONSTRAINT "Shoot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shoot" ADD CONSTRAINT "Shoot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
