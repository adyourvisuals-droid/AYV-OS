-- CreateEnum
CREATE TYPE "CapiEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'TEST');

-- CreateTable
CREATE TABLE "MetaCapiConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "pixelId" TEXT NOT NULL,
    "datasetId" TEXT,
    "accessTokenCipher" TEXT NOT NULL,
    "testEventCode" TEXT,
    "defaultEventName" TEXT NOT NULL DEFAULT 'Lead',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaCapiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapiEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "configId" TEXT,
    "leadId" TEXT,
    "eventName" TEXT NOT NULL,
    "status" "CapiEventStatus" NOT NULL DEFAULT 'PENDING',
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "eventId" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "fbTraceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "CapiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaCapiConfig_clientId_key" ON "MetaCapiConfig"("clientId");

-- CreateIndex
CREATE INDEX "MetaCapiConfig_organizationId_idx" ON "MetaCapiConfig"("organizationId");

-- CreateIndex
CREATE INDEX "CapiEvent_organizationId_clientId_createdAt_idx" ON "CapiEvent"("organizationId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "CapiEvent_leadId_idx" ON "CapiEvent"("leadId");

-- AddForeignKey
ALTER TABLE "MetaCapiConfig" ADD CONSTRAINT "MetaCapiConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaCapiConfig" ADD CONSTRAINT "MetaCapiConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapiEvent" ADD CONSTRAINT "CapiEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapiEvent" ADD CONSTRAINT "CapiEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapiEvent" ADD CONSTRAINT "CapiEvent_configId_fkey" FOREIGN KEY ("configId") REFERENCES "MetaCapiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
