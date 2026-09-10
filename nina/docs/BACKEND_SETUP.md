# Il backend: come si avvia e come è fatto

Per la parte "creo il database e lo collego" vai su
[NEON_SETUP.md](NEON_SETUP.md). Questo documento è per chi lavora sul codice.

## Cosa serve

| Strumento | Versione | Perché |
|---|---|---|
| Node.js | ≥ 20.11 | il backend usa `node:` import e top-level await |
| npm | quella di Node | — |
| Un database PostgreSQL | 16+ | Neon in produzione, oppure un PostgreSQL locale per i test |

## Avvio rapido

Il percorso più corto è `../avvia.sh`, che fa tutti i passi qui sotto in un
comando solo e genera i segreti da sé. Questa sezione serve a chi vuole
capire cosa succede, o a chi deve rifare un pezzo singolo.

```bash
cd backend
cp .env.example .env      # poi compila DATABASE_URL e i due segreti
npm install
npm run migrate
npm run create-admin
npm run dev
```

## I comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | avvia con ricarica automatica a ogni modifica |
| `npm run build` | compila TypeScript in `dist/` |
| `npm start` | esegue la versione compilata (è ciò che gira in produzione) |
| `npm run typecheck` | controlla i tipi senza generare file |
| `npm run migrate` | applica le migration mancanti |
| `npm run migrate:status` | mostra quali migration sono applicate, senza toccare niente |
| `npm run create-admin` | crea o aggiorna l'amministratrice, chiedendo la password a schermo |
| `npm run openapi` | riscrive `docs/openapi.json` dalle rotte |
| `npm test` | esegue tutta la suite |
| `npm run test:watch` | riesegue i test a ogni salvataggio |

## Come è organizzato

```
backend/
├── database/migrations/     le migration SQL, in ordine
├── scripts/                 migrate, create-admin, export-openapi
├── src/
│   ├── config.ts            tutte le variabili d'ambiente, validate all'avvio
│   ├── app.ts               costruzione di Fastify: sicurezza, docs, rotte
│   ├── server.ts            apre la porta (separato da app.ts per i test)
│   ├── db/
│   │   ├── pool.ts          connessione a Neon, transazioni
│   │   └── sql.ts           il tag `sql`: rende impossibile la SQL injection
│   ├── middleware/          autenticazione, gestione degli errori
│   ├── repositories/        le query. Nessuna logica di business qui
│   ├── routes/              una per area: auth, tasks, habits, sync, admin…
│   ├── services/            la logica: password, token, ricorrenze, AI
│   └── utils/               errori applicativi, logger con redazione
└── tests/
    ├── unit/                logica pura
    └── integration/         contro un PostgreSQL vero
```

Le due regole che tengono in piedi la struttura:

1. **Una rotta non scrive SQL.** Chiama un repository. Se una query compare in
   `routes/`, è nel posto sbagliato.
2. **Un repository non decide.** Legge e scrive. Se una condizione riguarda le
   regole dell'app (chi può fare cosa, quando scade un token), sta in
   `services/`.

## Perché queste librerie

| Scelta | Motivo |
|---|---|
| **Fastify** invece di Express | Validazione di richiesta e risposta integrata, e la stessa dichiarazione produce la documentazione OpenAPI. Con Express servirebbero tre librerie che possono divergere. |
| **TypeBox** | Uno schema TypeBox è contemporaneamente validazione a runtime, tipo TypeScript e voce nella documentazione. Scriverli separati significa che prima o poi non coincidono più. |
| **`pg` senza ORM** | Le migration SQL sono l'unica descrizione dello schema. Un ORM ne aggiungerebbe una seconda, e le due diventerebbero diverse. Le query qui sono semplici; la parte difficile è la sincronizzazione, che un ORM complicherebbe. |
| **argon2** | Argon2id ha vinto la Password Hashing Competition ed è quello che OWASP consiglia oggi. I parametri sono in `config.ts`, non sparsi nelle chiamate. |
| **pino** | Il logger di Fastify. La lista `redact` in `utils/logger.ts` è la parte che conta: password, token e contenuto del diario non finiscono mai nei log. |

## I test

```bash
npm test
```

I test di integrazione girano contro **un database PostgreSQL vero**, non
contro finti oggetti. È una scelta: metà del valore di questo backend sta nei
vincoli del database, nei trigger di sincronizzazione e nelle transazioni, e
nessun mock li riproduce.

Serve quindi un PostgreSQL raggiungibile. In locale:

```bash
createdb nina_test
export DATABASE_URL="postgresql://localhost:5432/nina_test"
npm test
```

Se non imposti `DATABASE_URL`, i test usano
`postgresql://nina:ninadev@127.0.0.1:5432/nina_test`.

Ogni file di test **ricostruisce lo schema da zero** applicando le migration,
così nessun test può dipendere da quello che ha lasciato il precedente. Per lo
stesso motivo i file non girano in parallelo (`fileParallelism: false` in
`vitest.config.ts`): condividono un database solo.

> Il database indicato da `DATABASE_URL` viene **cancellato e ricreato** a ogni
> file di test (`DROP SCHEMA public CASCADE`). Non puntarlo mai al database di
> produzione.

Nei test i limiti di richiesta sono alzati (`tests/setup.ts`): con dieci
tentativi di accesso al minuto, ogni file si bloccherebbe da solo dopo dieci
registrazioni. Che il blocco funzioni davvero lo verifica
`tests/integration/limiti.test.ts`, che li riabbassa apposta.

## La documentazione delle API

Con il backend acceso in sviluppo: **http://localhost:3000/docs**.

In produzione l'interfaccia è disattivata (`app.ts` la registra solo se
`NODE_ENV !== 'production'`), ma il file `docs/openapi.json` resta aggiornabile
con `npm run openapi`.

## Le variabili d'ambiente

Tutte in `.env.example`, con una riga di spiegazione ciascuna. Le uniche
obbligatorie sono `DATABASE_URL`, `JWT_SECRET` e `JWT_REFRESH_SECRET`: senza,
il backend non parte — di proposito. Un errore chiaro all'avvio è meglio di una
richiesta che fallisce in modo incomprensibile fra tre settimane.

Due dettagli che è facile sbagliare:

- `JWT_SECRET` e `JWT_REFRESH_SECRET` devono essere **diversi**. Il controllo è
  in `config.ts` e blocca l'avvio.
- In produzione un segreto più corto di 32 caratteri blocca l'avvio. In
  sviluppo no, per non intralciare.

## L'AI

`AI_PROVIDER=none` è il valore predefinito e **non costa niente**: risponde
`src/services/ninaBrain.ts`, il motore conversazionale incluso nel backend, che
riconosce decine di argomenti in italiano.

Con `AI_PROVIDER=anthropic` e una chiave, le risposte le genera un modello
linguistico. La chiave sta **solo** sul backend: l'app iOS non la vede mai e
non parla mai con un provider AI direttamente. Se il modello non risponde o la
chiave è scaduta, interviene comunque il motore locale: la schermata "La mia
amica" non è mai rotta.
