// FILE: backend/scripts/create-admin.ts
//
// Crea (o aggiorna) l'account amministratore.
//
//   npm run create-admin
//
// La password si digita al momento e non viene mai:
//   * scritta in un file
//   * passata come argomento (finirebbe nella cronologia della shell e in `ps`)
//   * stampata a schermo
//   * salvata in chiaro nel database
//
// Per questo motivo nel repository non esiste nessuna password: le migration
// creano le tabelle, questo script crea la persona.

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { pool, withTransaction } from '../src/db/pool.js';
import { hashPassword, validatePasswordStrength } from '../src/services/password.js';
import * as users from '../src/repositories/userRepository.js';

/** Legge una riga senza mostrarla a schermo. */
async function askHidden(question: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout, terminal: true });

  // Durante la digitazione l'output viene soppresso: nessun carattere e
  // nessun asterisco, come nei prompt di sistema.
  const originalWrite = stdout.write.bind(stdout);
  let hiding = false;

  const patched = ((chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
    if (hiding) return true;
    return (originalWrite as (c: unknown, ...r: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof stdout.write;

  originalWrite(question);
  hiding = true;
  stdout.write = patched;

  try {
    const answer = await readline.question('');
    return answer;
  } finally {
    hiding = false;
    stdout.write = originalWrite;
    stdout.write('\n');
    readline.close();
  }
}

async function ask(question: string, fallback: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await readline.question(`${question} [${fallback}]: `)).trim();
    return answer === '' ? fallback : answer;
  } finally {
    readline.close();
  }
}

async function main(): Promise<void> {
  console.log('\n— Creazione account amministratore di Nina —\n');

  const firstName = await ask('Nome', 'Teresa');
  const lastName = await ask('Cognome', 'Sardanelli');
  const displayName = await ask('Nome visualizzato', `${firstName} ${lastName}`);
  const email = (await ask('Email', '')).trim().toLowerCase();

  if (email === '' || !email.includes('@')) {
    console.error('\nServe un indirizzo email valido.\n');
    process.exit(1);
  }

  console.log('');
  const password = await askHidden('Password (non verrà mostrata): ');
  const confirm = await askHidden('Ripeti la password:            ');

  if (password !== confirm) {
    console.error('\nLe due password non coincidono. Riprova.\n');
    process.exit(1);
  }

  try {
    validatePasswordStrength(password);
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await users.findUserByEmail(email);

  if (existing) {
    // L'account c'è già: si promuove ad admin e si aggiorna la password.
    // Serve quando si dimentica la password dell'amministratore.
    console.log(`\nEsiste già un account con questa email (${existing.email}).`);
    const confirmUpdate = await ask(
      'Vuoi renderlo amministratore e impostare questa password? (si/no)',
      'no',
    );

    if (confirmUpdate.toLowerCase() !== 'si' && confirmUpdate.toLowerCase() !== 'sì') {
      console.log('\nNessuna modifica.\n');
      await pool.end();
      return;
    }

    await withTransaction(async (client) => {
      await users.updatePasswordHash(existing.id, passwordHash, client);
      await client.query(
        `UPDATE users SET role = 'ADMIN', is_active = TRUE, email_verified_at = COALESCE(email_verified_at, now())
          WHERE id = $1`,
        [existing.id],
      );
    });

    console.log('\n✓ Account aggiornato: ora è amministratore.\n');
    await pool.end();
    return;
  }

  const created = await withTransaction(async (client) => {
    const user = await users.createUser(
      { email, passwordHash, firstName, lastName, displayName, role: 'ADMIN' },
      client,
    );
    await users.createDefaultSettings(user.id, client);

    // L'amministratore non deve passare dalla verifica email: se l'SMTP non è
    // ancora configurato, resterebbe chiuso fuori dal suo stesso pannello.
    await client.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [user.id]);

    return user;
  });

  console.log('\n✓ Amministratore creato.\n');
  console.log(`   Nome:  ${created.first_name} ${created.last_name}`);
  console.log(`   Email: ${created.email}`);
  console.log(`   Ruolo: ADMIN`);
  console.log('\nOra puoi accedere dall\'app con questa email e la password che hai scelto.\n');

  await pool.end();
}

main().catch(async (error: unknown) => {
  console.error('\nNon è stato possibile creare l\'amministratore:');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('\nControlla che DATABASE_URL sia corretto e che le migration siano state eseguite.\n');
  await pool.end().catch(() => undefined);
  process.exit(1);
});
