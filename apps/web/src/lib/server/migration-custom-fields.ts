/**
 * Second migration, embedded the same way as migration-sql.ts's initial one
 * — see that file's header for why. Source of truth:
 * apps/api/prisma/migrations/20260804174252_add_custom_fields/migration.sql
 */

export const MIGRATION_NAME = '20260804174252_add_custom_fields';
export const MIGRATION_CHECKSUM = '7e5ce6d5a8a409827e4b1025e8d5527c0c92cc173f2f75810cc346e735717bfb';

export const MIGRATION_SQL = "-- AlterTable\nALTER TABLE \"Client\" ADD COLUMN     \"customFields\" JSONB NOT NULL DEFAULT '{}';\n\n-- AlterTable\nALTER TABLE \"Lead\" ADD COLUMN     \"customFields\" JSONB NOT NULL DEFAULT '{}';\n\n-- AlterTable\nALTER TABLE \"Project\" ADD COLUMN     \"customFields\" JSONB NOT NULL DEFAULT '{}';\n\n-- AlterTable\nALTER TABLE \"Task\" ADD COLUMN     \"customFields\" JSONB NOT NULL DEFAULT '{}';\n\n-- CreateTable\nCREATE TABLE \"CustomFieldDefinition\" (\n    \"id\" TEXT NOT NULL,\n    \"organizationId\" TEXT NOT NULL,\n    \"entityType\" TEXT NOT NULL,\n    \"key\" TEXT NOT NULL,\n    \"label\" TEXT NOT NULL,\n    \"fieldType\" TEXT NOT NULL,\n    \"options\" TEXT[],\n    \"required\" BOOLEAN NOT NULL DEFAULT false,\n    \"position\" INTEGER NOT NULL DEFAULT 0,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"CustomFieldDefinition_pkey\" PRIMARY KEY (\"id\")\n);\n\n-- CreateIndex\nCREATE INDEX \"CustomFieldDefinition_organizationId_entityType_idx\" ON \"CustomFieldDefinition\"(\"organizationId\", \"entityType\");\n\n-- CreateIndex\nCREATE UNIQUE INDEX \"CustomFieldDefinition_organizationId_entityType_key_key\" ON \"CustomFieldDefinition\"(\"organizationId\", \"entityType\", \"key\");\n";
