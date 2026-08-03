/**
 * Splits a Prisma-generated migration file into individually executable
 * statements.
 *
 * Prisma's own migration SQL is machine-generated and predictable: each
 * statement is terminated by `;` at the end of a line, preceded by a `--`
 * comment line (e.g. `-- CreateTable`), and this schema is pure DDL with no
 * data — so no string literal ever contains a semicolon. A structural split
 * on `;\n`, with comment lines stripped from each resulting chunk, is exact
 * for this specific file without needing a real SQL parser.
 *
 * Verified against the actual migration file's structure before use — see
 * the commit that introduced this file.
 */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';\n')
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0)
    .map((statement) => (statement.endsWith(';') ? statement : `${statement};`));
}
