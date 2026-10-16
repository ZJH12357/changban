/** The small D1-shaped interface consumed by the shared account/care handlers.
 * This is NOT a general SQLite compatibility layer. Only the application's SQL
 * forms are supported; values always remain separate, bound parameters.
 */
type Row = Record<string, unknown>;
type Value = string | number | null;
type Result = { rows: Row[]; rowCount?: number | null };
export type PgConnection = {
  query(sql: string, values?: unknown[]): Promise<Result>;
  release(): void;
};
export type PgPool = {
  query(sql: string, values?: unknown[]): Promise<Result>;
  connect(): Promise<PgConnection>;
};

export function postgresSql(input: string) {
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(input);
  const source = input.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');
  const tokens = source.match(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|--[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z_0-9]*|\?|[\s\S]/g) ?? [];
  let parameter = 0, previous = '';
  const sql = tokens.map(token => {
    if (/^\s+$/.test(token) || token.startsWith('--') || token.startsWith('/*')) return token;
    let out = token;
    if (token === '?') out = '$' + (++parameter);
    else if (token.startsWith('`')) out = '"' + token.slice(1, -1) + '"';
    else if (/^[A-Za-z_]\w*$/.test(token) && (token.toLowerCase() === 'user' || previous.toUpperCase() === 'AS')) out = '"' + token + '"';
    previous = token;
    return out;
  }).join('').replace(/;\s*$/, '');
  return { sql: sql + (ignore ? ' ON CONFLICT DO NOTHING' : ''), parameters: parameter };
}

export function createPostgresDatabase(getPool: () => PgPool): D1Database {
  class Statement {
    constructor(readonly sql: string, readonly count: number, readonly values: Value[] = []) {}
    bind(...values: Value[]) { return new Statement(this.sql, this.count, values); }
    async execute(client: Pick<PgConnection, 'query'>) {
      if (this.count !== this.values.length) throw new Error('Database parameter count mismatch');
      const result = await client.query(this.sql, this.values);
      return { results: result.rows, success: true, meta: { changes: result.rowCount ?? result.rows.length } };
    }
    async first<T = Row>(column?: string): Promise<T | null> {
      const row = (await this.execute(getPool())).results[0];
      if (!row) return null;
      return (column ? row[column] : row) as T;
    }
    async all() { return this.execute(getPool()); }
    async run() { return this.execute(getPool()); }
  }
  return {
    prepare(sql: string) {
      const converted = postgresSql(sql);
      return new Statement(converted.sql, converted.parameters);
    },
    async batch(statements: Statement[]) {
      if (!statements.every(s => s instanceof Statement)) throw new Error('Mixed database statements');
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const results = [];
        for (const statement of statements) results.push(await statement.execute(client));
        await client.query('COMMIT');
        return results;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  } as unknown as D1Database;
}
