// FILE: backend/scripts/export-openapi.ts
//
// Genera docs/openapi.json dalle definizioni delle rotte.
//
//   npm run openapi
//
// Il documento non è scritto a mano: nasce dagli stessi schemi che validano le
// richieste a runtime. Non può quindi descrivere un'API diversa da quella che
// il server espone davvero.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { closePool } from '../src/db/pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(here, '..', '..', 'docs', 'openapi.json');

async function main(): Promise<void> {
  const app = await buildApp();
  await app.ready();

  const document = app.swagger();

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  const paths = Object.keys((document as { paths?: object }).paths ?? {}).length;
  console.log(`✓ ${paths} percorsi scritti in ${OUTPUT}`);

  await app.close();
  await closePool();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  await closePool().catch(() => undefined);
  process.exit(1);
});
