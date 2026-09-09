# Nina — Architettura

## Perché "Nina"

L'app deve sembrare **una persona**, non un prodotto. Per questo il nome è un nome
proprio e non una parola-concetto: si dice "che dice Nina oggi?", non "che dice
la mia app di produttività". È corto (4 lettere), italiano ma leggibile in ogni
lingua, femminile senza essere infantile, e richiama *ninna* — qualcosa di dolce
e familiare. Nell'interfaccia non compare mai il nome dell'app come marchio:
compare Nina che ti parla.

## Vista d'insieme

```
   iPhone                      iPad
      │                          │
      └────────────┬─────────────┘
                   │  HTTPS (TLS) — REST + SSE
                   │  Bearer JWT (access, 15 min)
                   ▼
        ┌──────────────────────┐
        │  Backend Nina        │
        │  Node.js 20 + TS     │
        │  Fastify             │
        │                      │
        │  auth · authz · API  │
        │  sync engine · SSE   │
        │  AI proxy            │
        └──────────┬───────────┘
                   │  pg (pool, query parametrizzate, TLS)
                   ▼
        ┌──────────────────────┐
        │  Neon PostgreSQL     │
        │  (database autorevole)│
        └──────────────────────┘
```

Sul dispositivo, **SwiftData** è solo cache + coda di modifiche. La verità è
sempre il database Neon. L'app non conosce la connection string: parla solo con
il backend.

## Flusso dei dati

```
   Utente tocca "fatto"
          │
          ▼
   Repository (iOS)  ──scrive──►  SwiftData (subito, UI aggiornata)
          │
          └──accoda──►  Outbox (SwiftData)
                            │
                            │ quando c'è rete
                            ▼
                     SyncEngine.push()
                            │  POST /sync/push
                            ▼
                        Backend  ──►  Neon
                            │
                            │ SSE "changed"
                            ▼
                   altri dispositivi dello stesso utente
                            │
                            ▼
                     SyncEngine.pull()  GET /sync/changes?since=<cursor>
```

## Sincronizzazione: come funziona davvero

Il problema di ogni app multi-dispositivo è: *quali righe sono cambiate da
quando ho guardato l'ultima volta?* La risposta di Nina è un **contatore
monotòno per utente**.

- Ogni utente ha un contatore (`sync_sequence.current`).
- Ogni riga sincronizzabile ha una colonna `sync_seq`.
- Un trigger PostgreSQL assegna a ogni INSERT/UPDATE un nuovo `sync_seq`
  prendendo il numero successivo del contatore dell'utente.

Il client tiene un **cursore**: l'ultimo `sync_seq` che ha visto. Per
sincronizzare chiede `GET /sync/changes?since=<cursore>` e riceve, in ordine,
tutte le righe cambiate — comprese le cancellazioni (soft delete, `deleted_at`
valorizzato, che a sua volta genera un nuovo `sync_seq`).

Vantaggi rispetto a "filtra per `updated_at > X`":

- niente righe perse quando due scritture avvengono nello stesso millisecondo;
- niente dipendenza dall'orologio del client;
- paginazione naturale e ripartenza esatta dopo un'interruzione.

Il `sync_seq` è **per utente**, quindi il cursore di un utente non rivela nulla
sul traffico di altri utenti.

### Realtime

Il push in tempo reale è **Server-Sent Events** (`GET /sync/stream`), non
WebSocket. Motivi:

- è HTTP normale: attraversa proxy e load balancer senza configurazione;
- è unidirezionale, che è esattamente ciò che serve (il client scrive con POST);
- si consuma nativamente in Swift con `URLSession.bytes(for:)`;
- riconnessione automatica gestita dal protocollo.

L'evento SSE **non trasporta i dati**: dice solo "qualcosa è cambiato, il
cursore ora è N". Il client fa poi una `pull()` normale. Così esiste un solo
percorso di lettura dei dati, e realtime e offline non possono divergere.

Se SSE cade (rete mobile, app in background), il client fa polling adattivo:
ogni 30 s in foreground, e una `pull()` a ogni ritorno in primo piano. La
correttezza non dipende mai da SSE.

### Risoluzione dei conflitti

Ogni riga ha `version` (intero, incrementato dal trigger) e `client_updated_at`
(quando la modifica è avvenuta *sul dispositivo*), più `last_device_id`.

La decisione è **una sola espressione SQL**, valutata dentro la `WHERE` di una
`UPDATE`. Il vincitore lo sceglie il database, in modo atomico: non c'è nessuna
finestra fra "leggo la versione attuale" e "scrivo la mia".

```sql
UPDATE tasks
   SET ...
 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
   AND (    $3::timestamptz >  client_updated_at
         OR ($3::timestamptz =  client_updated_at
             AND COALESCE($4, '') > COALESCE(last_device_id, '')) )
```

In parole:

| Situazione | Comportamento del server | Esito |
|---|---|---|
| La riga non esiste ancora per questo utente | La inserisce. È un elemento creato offline che arriva per la prima volta. | `applied` |
| `client_updated_at` in arrivo è **più recente** di quello sul server | Applica. | `applied` |
| `client_updated_at` in arrivo è **più vecchio** | Rifiuta e restituisce la riga autorevole, che il dispositivo adotta. | `rejected` |
| I due `client_updated_at` sono **identici** | Vince il `device_id` alfabeticamente maggiore. | `applied` o `rejected` |
| La riga sul server è **cancellata** (`deleted_at` non nullo) | Rifiuta: la cancellazione vince sempre. Non si "resuscita" niente. | `rejected` |
| Il payload non contiene nessun campo riconosciuto | Non tocca niente e restituisce lo stato attuale. | `ignored` |
| L'id esiste ma appartiene a un altro account, o mancano campi obbligatori per una riga nuova | Rifiuta quella singola riga; le altre del lotto proseguono. `server` è `null`, quindi chi ha spinto la modifica non scopre nemmeno che quell'id esiste. | `rejected` |

Due note su come è implementato, perché non sono ovvie.

**Non si usa `INSERT ... ON CONFLICT (id) DO UPDATE`.** PostgreSQL valida i
vincoli `NOT NULL` del ramo `INSERT` *anche quando* la riga esiste già e verrà
soltanto aggiornata. Siccome il caso normale è un aggiornamento parziale — il
dispositivo manda solo i campi che ha cambiato — ogni singolo push fallirebbe su
ogni colonna obbligatoria non inclusa. Quindi: prima `UPDATE`, e solo se non ha
toccato righe si guarda se la riga esiste, per distinguere "non c'è ancora" da
"ha perso il conflitto".

**L'`INSERT` finale sta dentro un `SAVEPOINT`.** Se fallisce (id di un altro
utente, campi obbligatori mancanti) la transazione sarebbe inutilizzabile e
l'intero lotto andrebbe perso, comprese le modifiche valide. Il rollback al
savepoint rifiuta quella riga sola e lascia proseguire le altre.

`base_version` viaggia nel payload ma **non partecipa alla decisione**: serve
solo a raccontare l'esito nei log e a un'eventuale diagnostica. Il criterio
autorevole è l'istante della modifica sul dispositivo, perché è l'unica cosa
che ha un significato per la persona che l'ha fatta.

Nessuna scrittura viene mai persa in silenzio: la risposta di `/sync/push`
contiene un esito per ogni riga inviata e, tranne nel caso dell'id altrui, lo
stato autorevole che il dispositivo adotta. Un dispositivo rifiutato non
ritenta all'infinito: si riallinea.

I test che coprono tutto questo stanno in
`backend/tests/integration/sync.test.ts`.

## Sicurezza — le decisioni

| Scelta | Perché |
|---|---|
| Argon2id per le password | Resistente ad attacchi con GPU/ASIC, vincitore della Password Hashing Competition. Parametri in `config.ts`, non hardcoded nelle chiamate. |
| Access token JWT da 15 minuti | Breve abbastanza da limitare il danno di un token rubato. |
| Refresh token opachi, hashati in DB | Un dump del database non permette di generare sessioni. Rotazione a ogni uso. |
| Rilevamento riuso del refresh token | Se un refresh già usato ritorna, l'intera famiglia di token viene revocata: è la firma di un furto. |
| Autorizzazione nel backend, sempre | I controlli nell'app iOS servono solo a non mostrare bottoni inutili. Ogni query filtra per `user_id` preso dal token, mai dal body. |
| Query parametrizzate ovunque | Nessuna concatenazione di SQL. Il layer `db/sql.ts` non espone un modo per interpolare stringhe. |
| Chiavi AI solo sul backend | L'app non ha mai una API key di un provider AI. |
| Diari mai leggibili dall'admin | Le API admin non hanno alcun endpoint che restituisca `diary_entries.content`. Non è una convenzione: l'endpoint non esiste. |

## Struttura del repository

```
nina/
├── backend/
│   ├── src/
│   │   ├── routes/          un file per area API
│   │   ├── repositories/    unico posto che scrive SQL
│   │   ├── services/        logica applicativa (auth, sync, AI, stats)
│   │   ├── middleware/      autenticazione, ruoli, errori, rate limit
│   │   ├── realtime/        hub SSE
│   │   ├── db/              pool e helper query
│   │   └── utils/           logger, errori, validazione
│   ├── database/migrations/ SQL numerato, eseguito in ordine
│   ├── scripts/             migrate, seed, create-admin
│   └── tests/
├── ios/
│   ├── project.yml          sorgente del progetto Xcode (XcodeGen)
│   ├── Nina/
│   │   ├── App/             entry point, root view, routing
│   │   ├── Core/            sessione, ambiente, errori
│   │   ├── DesignSystem/    colori, tipografia, spaziature, componenti base
│   │   ├── Models/          modelli SwiftData + DTO API
│   │   ├── Networking/      APIClient, endpoint, SSE
│   │   ├── Persistence/     container SwiftData, outbox
│   │   ├── Sync/            SyncEngine
│   │   ├── Notifications/   notifiche locali
│   │   ├── Components/      componenti riusabili
│   │   └── Features/        una cartella per schermata
│   ├── NinaWidgets/
│   └── NinaTests/
└── docs/
```

## Perché Fastify e non Express

Fastify valida input e output con JSON Schema **prima** che il codice della rotta
venga eseguito. Questo significa che la validazione degli input non è una cosa
che ci si deve ricordare di fare: è nella definizione della rotta o la rotta non
parte. Lo stesso schema genera la documentazione OpenAPI, quindi la
documentazione non può andare fuori sincrono con il codice.

## Perché `pg` e non un ORM

Le migration sono SQL puro (richiesta esplicita). Un ORM con le sue migration
sopra a SQL scritto a mano crea due fonti di verità sullo schema. Con `pg` e
query parametrizzate lo schema ha una sola definizione — i file in
`database/migrations/` — e le query sono leggibili da chiunque sappia SQL.
