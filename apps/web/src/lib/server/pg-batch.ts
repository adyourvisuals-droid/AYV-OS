/**
 * Builds a parameterized multi-row INSERT.
 *
 * `pg`'s extended protocol (used whenever a query has bind parameters) is
 * restricted to one statement per call — but a single INSERT with many
 * `VALUES` rows is still one statement, so this is the way to write N rows
 * in one network round trip instead of N.
 */
export function buildMultiRowInsert(
  table: string,
  columns: string[],
  rows: unknown[][],
  onConflict?: string,
): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const rowPlaceholders = rows.map((row) => {
    const placeholders = row.map((value) => {
      values.push(value);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const columnList = columns.map((column) => `"${column}"`).join(', ');
  const text = `INSERT INTO "${table}" (${columnList}) VALUES ${rowPlaceholders.join(', ')}${
    onConflict ? ` ${onConflict}` : ''
  }`;

  return { text, values };
}
