import { existsSync, readFileSync, readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { closeDatabase, getPool, initDatabase } from './connection'

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith('--'))
}

function isSessionStatement(statement: string): boolean {
  return /^USE\s+/i.test(statement)
}

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

function resolveMigrationsDir(): string {
  const candidates = [
    process.env.DB_MIGRATIONS_DIR,
    join(process.cwd(), 'database', 'migrations'),
    resolve(__dirname, '../../database/migrations'),
    resolve(__dirname, '../../../database/migrations'),
    join(dirname(process.execPath), 'database', 'migrations'),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(`No se encontró el directorio de migraciones. Revisados: ${candidates.join(', ')}`)
}

export async function runMigrations(): Promise<void> {
  await initDatabase()
  const pool = getPool()
  const migrationsDir = resolveMigrationsDir()
  const includeBaseline = process.env.DB_INCLUDE_BASELINE === 'true'

  await ensureMigrationsTable()

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .filter((file) => includeBaseline || !file.startsWith('001_'))
    .sort()

  for (const file of files) {
    const alreadyApplied = await pool.execute(
      'SELECT id FROM schema_migrations WHERE file_name = ? LIMIT 1',
      [file]
    )
    const rows = alreadyApplied[0] as { id: number }[]
    if (rows.length > 0) continue

    const sqlPath = join(migrationsDir, file)
    if (!existsSync(sqlPath)) continue

    const statements = splitStatements(readFileSync(sqlPath, 'utf-8'))
    console.log(`[Migration] Ejecutando ${file} con ${statements.length} statements`)

    for (const statement of statements) {
      if (isSessionStatement(statement)) continue
      await pool.query(statement)
    }

    await pool.execute('INSERT INTO schema_migrations (file_name) VALUES (?)', [file])
  }

  console.log('[Migration] Migraciones aplicadas correctamente')
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await closeDatabase()
    })
    .catch(async (error) => {
      console.error('[Migration] Error fatal:', error)
      await closeDatabase()
      process.exit(1)
    })
}
