/** Entity types that carry a `customFields Json` column — see apps/api/prisma/schema.prisma. */
export const ENTITY_TYPES = ['LEAD', 'CLIENT', 'PROJECT', 'TASK'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

interface DefinitionLike {
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
}

/**
 * Validates a record's custom field values against its entity type's
 * definitions, coercing to the right JS type per fieldType and dropping any
 * key that isn't a known definition — the customFields JSON blob only ever
 * holds values an admin has explicitly defined a field for.
 */
export function validateCustomFieldValues(
  definitions: DefinitionLike[],
  values: Record<string, unknown>,
): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const cleaned: Record<string, unknown> = {};

  for (const definition of definitions) {
    const raw = values[definition.key];

    if (raw === undefined || raw === null || raw === '') {
      if (definition.required) return { ok: false, error: `${definition.label} is required` };
      continue;
    }

    switch (definition.fieldType) {
      case 'TEXT':
        if (typeof raw !== 'string') return { ok: false, error: `${definition.label} must be text` };
        cleaned[definition.key] = raw;
        break;
      case 'NUMBER': {
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isNaN(num)) return { ok: false, error: `${definition.label} must be a number` };
        cleaned[definition.key] = num;
        break;
      }
      case 'DATE':
        if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
          return { ok: false, error: `${definition.label} must be a valid date` };
        }
        cleaned[definition.key] = raw;
        break;
      case 'BOOLEAN':
        cleaned[definition.key] = raw === true || raw === 'true';
        break;
      case 'SELECT':
        if (typeof raw !== 'string' || !definition.options.includes(raw)) {
          return { ok: false, error: `${definition.label} must be one of: ${definition.options.join(', ')}` };
        }
        cleaned[definition.key] = raw;
        break;
      default:
        return { ok: false, error: `Unknown field type for ${definition.label}` };
    }
  }

  return { ok: true, values: cleaned };
}

export function presentDefinition(definition: {
  id: string;
  entityType: string;
  key: string;
  label: string;
  fieldType: string;
  options: string[];
  required: boolean;
  position: number;
  createdAt: Date;
}) {
  return {
    id: definition.id,
    entityType: definition.entityType,
    key: definition.key,
    label: definition.label,
    fieldType: definition.fieldType,
    options: definition.options,
    required: definition.required,
    position: definition.position,
    createdAt: definition.createdAt.toISOString(),
  };
}
