// FILE: backend/scripts/migrate.ts
//
// Esegue le migration in ordine e tiene traccia di quelle già applicate.
//
//   npm run migrate           applica quelle mancanti
//   npm run migrate:status    mostra lo stato senza toccare niente
//
// Ogni file viene applicato dentro una transazione, insieme alla riga che lo
// registra: se una migration fallisce a metà, il database resta come prima e
// non risulta applicata. Non esiste lo stato "mezza migrata".
//
// Il checksum serve a un caso preciso e insidioso: qualcuno modifica un file
// già applicato. Il database sarebbe diverso da quello che il file descrive, e
// nessuno se ne accorgerebbe. Qui invece il comando si ferma e lo dice.

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from '../src/db/pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '..', 'database', 'migrations');

interface Migration {
  version: string;
  path: string;
  sql: string;
  checksum: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const migrations: Migration[] = [];

  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = await readFile(path, 'utf8');
    migrations.push({
      version: file.replace(/\.sql$/, ''),
      path,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16),
    });
  }

  return migrations;
}

async function appliedVersions(): Promise<Map<string, string>> {
  // La tabella nasce con la prima migration: se non c'è, non è stato applicato
  // ancora niente.
  const exists = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists`,
  );

  if (!exists.rows[0]?.exists) return new Map();

  const rows = await pool.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM schema_migrations',
  );

  return new Map(rows.rows.map((row) => [row.version, row.checksum]));
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes('--status');

  const migrations = await loadMigrations();
  if (migrations.length === 0) {
    console.error(`Nessuna migration trovata in ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const applied = await appliedVersions();

  // Controllo di coerenza prima di applicare qualsiasi cosa.
  const modified = migrations.filter((migration) => {
    const previous = applied.get(migration.version);
    return previous !== undefined && previous !== migration.checksum;
  });

  if (modified.length > 0) {
    console.error('\n⚠️  Migration già applicate ma modificate dopo:\n');
    for (const migration of modified) {
      console.error(`   ${migration.version}`);
    }
    console.error(
      '\nIl database non corrisponde più a questi file. Non modificare una migration\n' +
        'già applicata: creane una nuova con il numero successivo.\n',
    );
    process.exit(1);
  }

  const pending = migrations.filter((migration) => !applied.has(migration.version));

  console.log(`\nMigration trovate: ${migrations.length}`);
  console.log(`Già applicate:     ${applied.size}`);
  console.log(`Da applicare:      ${pending.length}\n`);

  for (const migration of migrations) {
    const state = applied.has(migration.version) ? '✓ applicata' : '· da applicare';
    console.log(`  ${state.padEnd(16)} ${migration.version}`);
  }
  console.log('');

  if (statusOnly || pending.length === 0) {
    if (pending.length === 0 && !statusOnly) console.log('Tutto aggiornato. Niente da fare.\n');
    await pool.end();
    return;
  }

  for (const migration of pending) {
    process.stdout.write(`Applico ${migration.version} … `);

    try {
      await withTransaction(async (client) => {
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)
           ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum`,
          [migration.version, migration.checksum],
        );
      });
      console.log('fatto');
    } catch (error) {
      console.log('FALLITA');
      console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
      console.error(`File: ${migration.path}`);
      console.error('Il database è rimasto come prima di questa migration.\n');
      await pool.end();
      process.exit(1);
    }
  }

  console.log(`\n✓ ${pending.length} migration applicate.\n`);
  await pool.end();
}

main().catch(async (error: unknown) => {
  console.error('\nErrore durante le migration:');
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    '\nSe è un problema di connessione, controlla DATABASE_URL nel file .env.\n' +
      'Su Neon la stringa deve finire con ?sslmode=require\n',
  );
  await pool.end().catch(() => undefined);
  process.exit(1);
});
