# Sicurezza

Cosa protegge Nina, come, e cosa resta da fare a mano.

## La regola che viene prima di tutte

**L'app iOS non contiene nessun segreto.** Non la password del database, non le
credenziali PostgreSQL, non chiavi private, non API key di servizi AI, non la
password dell'amministratrice.

Non è una promessa: è una conseguenza dell'architettura. L'app parla solo con
il backend, tramite HTTPS, con un token di sessione ottenuto facendo login.
Il database non è raggiungibile dall'app nemmeno volendo.

Un'app pubblicata sull'App Store è un file che chiunque può scaricare e aprire.
Qualsiasi stringa dentro il binario è pubblica: le chiavi che ci finiscono
vengono trovate, sempre.

## Password

| | |
|---|---|
| Algoritmo | Argon2id |
| Memoria | 19 456 KiB |
| Iterazioni | 2 |
| Parallelismo | 1 |
| Salt | generato da `argon2`, uno diverso per password |

Sono i parametri consigliati da OWASP. Stanno in `config.ts` e non sparsi nelle
chiamate, così cambiarli è una riga sola.

Le password **non vengono mai salvate in chiaro** e non compaiono nei log: la
lista `redact` in `utils/logger.ts` copre `password`, `newPassword`,
`currentPassword`, `token`, `authorization` e il contenuto del diario.

Il confronto in fase di login usa la verifica di `argon2`, che è a tempo
costante. E login sbagliato ed email inesistente danno **la stessa risposta**:
altrimenti l'endpoint direbbe a chiunque quali email sono registrate. C'è un
test che lo verifica (`auth.test.ts`).

## L'account amministratore

Non esiste nel repository. Le migration creano le tabelle; la persona la crea
`npm run create-admin`, che:

- chiede la password **al momento**, senza mostrarla a schermo;
- non la accetta come argomento da riga di comando (finirebbe nella cronologia
  della shell e sarebbe visibile in `ps`);
- rifiuta le password deboli;
- salva solo l'impronta Argon2id.

Cercare una password nel codice o nelle migration non serve: non c'è.

## Sessioni

| | |
|---|---|
| Access token | JWT HS256, 15 minuti |
| Refresh token | opaco (48 byte casuali), 60 giorni, **ruotato a ogni uso** |
| Come è salvato in DB | HMAC-SHA256 del token, mai il token |
| Dove sta sul telefono | portachiavi iOS, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` |

I refresh token sono opachi e non JWT: un JWT resta valido finché non scade,
anche se lo revochi, a meno di tenere comunque una lista in database. Tanto vale
tenere la lista e basta.

Nel database c'è l'HMAC del token, non il token: un dump del database non
permette di generare sessioni.

**Rilevamento del riuso.** Se un refresh token già consumato torna indietro, o
è una copia rubata o è un client che ha ritentato dopo aver perso la risposta.
In entrambi i casi la reazione è la stessa: l'intera *famiglia* di token nata da
quel login viene revocata, e bisogna riaccedere.

> Questa parte aveva un bug vero, trovato scrivendo i test. Il rilevamento
> funzionava, la revoca partiva — ma stava dentro la stessa transazione
> dell'errore lanciato subito dopo, e il `ROLLBACK` la annullava. Il token
> rubato veniva riconosciuto, segnalato nei log e restava valido. Ora la revoca
> avviene fuori dalla transazione, e `auth.test.ts` verifica che dopo un riuso
> cada tutta la catena.

Il portachiavi usa `...ThisDeviceOnly`: i token non finiscono nel backup di
iCloud e non passano a un telefono nuovo. Su un dispositivo nuovo si rifà
l'accesso, che è quello che deve succedere.

## Autorizzazione

**Ogni controllo è nel backend.** Quelli nell'app iOS servono solo a non
mostrare bottoni inutili.

Ogni query filtra per lo `user_id` preso **dal token**, mai da un parametro
della richiesta. Chiedere `/tasks/<id-di-un'altra-persona>` restituisce 404,
non 403: chi non ha i permessi non deve nemmeno sapere che quella cosa esiste.
Vale anche per il pannello amministrativo: per un utente normale
`/admin/users` è un 404, non un "non hai i permessi".

Cosa un utente non può fare, verificato in
`backend/tests/integration/privacy.test.ts`:

- leggere altri utenti, i loro diari, le loro attività;
- modificare qualcosa di un'altra persona (nemmeno via `/sync/push`: viene
  rifiutato, e la risposta non contiene il contenuto della riga, quindi non
  scopre nemmeno che quell'id esiste);
- accedere a `/admin/*`;
- modificare frasi motivazionali, idee di self care o altri utenti.

## L'amministratrice non legge i diari

È la promessa più delicata dell'app, ed è scritta nella schermata di accesso:
*"Il diario non lo legge nessuno, nemmeno chi gestisce l'app."*

Nessuna rotta amministrativa restituisce `diary_entries.content` o
`friend_messages.content`. Non è una convenzione a cui stare attenti:
l'endpoint non esiste. L'amministratrice vede quante pagine ha scritto una
persona, non cosa c'è dentro.

Un test **legge il codice sorgente** di `routes/admin.ts` e verifica che non
selezioni mai quelle colonne. È un controllo statico apposta: copre anche gli
endpoint che qualcuno aggiungerà in futuro.

## SQL injection

Impossibile per costruzione, non per attenzione.

Tutte le query passano dal tag `sql` di `src/db/sql.ts`, che mette **sempre** i
valori nell'array dei parametri e nel testo scrive `$1, $2, …`. Anche scrivendo

```ts
sql`SELECT * FROM users WHERE email = ${inputNonFidato}`
```

il valore finisce fra i parametri, non nel testo SQL.

Le parti dinamiche legittime (un nome di colonna per l'ordinamento) passano da
`raw()`, che è volutamente scomodo e accetta solo valori presi da liste chiuse
definite nel codice.

Un test scansiona tutti i file di `src/` e fallisce se trova un template
literal interpolato dentro una `.query(...)`: è l'unico modo in cui la SQL
injection potrebbe rientrare.

## Limiti di richiesta

| Rotte | Limite predefinito |
|---|---|
| `/auth/*` (login, registrazione, reset) | 10 al minuto |
| tutto il resto | 300 al minuto |

Il conteggio è **per utente autenticato**, non per IP: due persone sulla stessa
rete di casa non si rubano il limite a vicenda. Chi non è autenticato viene
contato per IP.

Configurabili con `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_MAX` e
`RATE_LIMIT_WINDOW`. Che il blocco funzioni lo verifica
`tests/integration/limiti.test.ts`.

## Trasporto

- HTTPS obbligatorio in produzione.
- HSTS attivo (un anno, sottodomini inclusi) quando `NODE_ENV=production`.
- La connessione a Neon è cifrata: `sslmode=require` e `rejectUnauthorized: true`.
- Header di sicurezza via `@fastify/helmet`, con una Content-Security-Policy
  stretta (`default-src 'none'`) per le due sole pagine HTML servite dal
  backend — quelle aperte dai link nelle email.
- CORS chiuso per impostazione predefinita: `CORS_ORIGINS` vuoto significa
  nessuna origine ammessa. L'app iOS non è un browser e non è soggetta a CORS.

## Cosa non finisce nei log

`utils/logger.ts` redige: `password`, `newPassword`, `currentPassword`,
`confirmPassword`, `passwordHash`, `token`, `accessToken`, `refreshToken`,
`authorization`, i cookie, e — non sono segreti tecnici, ma non c'è ragione che
ci stiano — `content`, `note`, `body.message`.

## Cancellare i propri dati

`DELETE /me` richiede la password **e** la frase di conferma
`ELIMINA IL MIO ACCOUNT`. Cancella davvero le righe: non alza un flag. Un test
lo verifica contando le righe residue in `tasks`, `diary_entries`, `moods`,
`refresh_tokens` e `users`.

## Cosa resta da fare a mano

Nessuna di queste cose può stare nel repository, ed è il motivo:

| Passo | Perché è manuale |
|---|---|
| Generare `JWT_SECRET` e `JWT_REFRESH_SECRET` | sono segreti; se stessero in git sarebbero pubblici |
| Creare l'account amministratore | la password non deve esistere in nessun file |
| Configurare SMTP | credenziali di terzi |
| Mettere il backend dietro HTTPS | dipende dall'hosting scelto |
| Impostare `CORS_ORIGINS` | dipende dai domini reali |
| Ruotare i segreti se sospetti una fuga | scelta umana |

## Se qualcosa va storto

Se pensi che un segreto sia trapelato:

1. **Ruota `JWT_SECRET` e `JWT_REFRESH_SECRET`.** Tutte le sessioni cadono e
   tutti devono riaccedere: è esattamente ciò che serve.
2. **Cambia la password del database su Neon** (Dashboard → Roles → Reset
   password) e aggiorna `DATABASE_URL`.
3. **Rigenera la chiave AI**, se ne usi una.
4. Chiedi a chi usa l'app di cambiare la propria password. `POST
   /auth/change-password` chiude da solo tutte le altre sessioni.
