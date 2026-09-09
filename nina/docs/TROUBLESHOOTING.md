# Quando qualcosa non funziona

Gli errori che capitano davvero, cosa significano e cosa fare.

---

## Il backend non parte

### `Configurazione non valida: manca la variabile d'ambiente DATABASE_URL`

Non esiste il file `backend/.env`, oppure quella riga è vuota.

```bash
cd backend
cp .env.example .env
```

Poi compila `DATABASE_URL` seguendo [NEON_SETUP.md](NEON_SETUP.md).

### `JWT_SECRET e JWT_REFRESH_SECRET devono essere diversi`

Hai incollato lo stesso valore due volte. Generane un secondo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Sono due chiavi separate perché, se una trapela, l'altra deve continuare a
proteggere le sessioni.

### `JWT_SECRET è troppo corto (12 caratteri)`

Succede solo con `NODE_ENV=production`. Usa il comando qui sopra: 48 byte
casuali, non una frase inventata.

### `EADDRINUSE: address already in use :::3000`

C'è già qualcosa sulla porta 3000 — quasi sempre un `npm run dev` rimasto
aperto in un altro terminale.

```bash
lsof -ti:3000 | xargs kill
```

Oppure cambia porta: `PORT=3001 npm run dev`.

---

## Il database

### `getaddrinfo ENOTFOUND ep-qualcosa.aws.neon.tech`

L'indirizzo nella stringa di connessione è sbagliato, o il progetto Neon è stato
cancellato. Ricopia la stringa dalla dashboard di Neon.

### `password authentication failed for user "..."`

La password nella `DATABASE_URL` non è più valida. Su Neon, **Roles → Reset
password**, poi ricopia l'intera stringa: cambia solo la password, ma è più
sicuro incollare tutto.

### `SSL connection is required` / `no pg_hba.conf entry`

Manca `?sslmode=require` in fondo alla stringa. Neon accetta solo connessioni
cifrate.

### `Connection terminated due to connection timeout`

Quasi sempre è **Neon che si sta svegliando**: nel piano gratuito il database
va in pausa dopo qualche minuto di inattività e la prima richiesta impiega uno o
due secondi. Riprova.

Se succede sempre, controlla di stare usando la stringa **pooled** — quella con
`-pooler` nell'indirizzo.

### `too many connections for role`

Stai usando la stringa **non** pooled. Sotto carico ogni connessione conta.
Riprendi la stringa con `-pooler` dalla dashboard.

### `relation "users" does not exist`

Le migration non sono mai state applicate.

```bash
npm run migrate:status   # per vedere lo stato
npm run migrate
```

### `La migration 003_constraints.sql è cambiata dopo essere stata applicata`

Qualcuno ha modificato un file `.sql` già eseguito. Il database ora è diverso da
quello che il file descrive.

**Non forzare.** Rimetti il file com'era (`git checkout`) e scrivi una nuova
migration `005_…` con la modifica che ti serve. Una migration applicata non si
tocca mai: è la regola che rende ripetibile la ricostruzione dello schema.

---

## Accesso e sessioni

### L'app dice `Sessione non valida. Accedi di nuovo.`

Il refresh token non esiste più. Cause normali: sono passati 60 giorni, oppure
è stata cambiata la password (che chiude tutte le sessioni di proposito), oppure
si è fatto *Esci da tutti i dispositivi*.

### `TOKEN_REUSED` — "Per sicurezza abbiamo chiuso questa sessione"

Un refresh token già consumato è tornato indietro. Due possibilità:

1. **Una copia rubata.** È lo scenario per cui il meccanismo esiste: l'intera
   catena di sessioni nata da quel login viene revocata.
2. **Un client che ha ritentato** dopo aver perso la risposta di rete.

Non è possibile distinguerli, e la reazione sicura è la stessa. Basta
riaccedere. Se capita spesso allo stesso account, guarda nei log del backend le
righe con `level: "warn"` e `"Riuso di un refresh token"`: contengono lo
`userId` e la famiglia coinvolta.

### `429 RATE_LIMITED` durante i test

I limiti sono per rotta e per utente: dieci tentativi di accesso al minuto. In
`tests/setup.ts` sono alzati apposta. Se lo vedi in un test tuo, probabilmente
quel file registra molti utenti: la registrazione passa da `/auth/register`, che
ha il limite stretto.

### Non arriva l'email di verifica

Se `SMTP_HOST` è vuoto, le email **non vengono spedite**: vengono stampate nei
log del backend, link compreso. È il comportamento previsto in sviluppo. Cerca
nel terminale la riga con l'indirizzo `/auth/verify-email?token=…`.

---

## Sincronizzazione

### L'iPad non vede quello che ho scritto sull'iPhone

In ordine:

1. **Sono lo stesso account?** Impostazioni → in alto c'è l'email.
2. **C'è rete su entrambi?** Le modifiche restano in coda finché non torna.
3. **Quante modifiche in attesa?** Impostazioni lo mostra. Se il numero non
   scende, la sincronizzazione sta fallendo.
4. Chiudi e riapri l'app: tornare in primo piano fa partire un giro completo.
5. Nei log del backend, cerca le richieste a `/sync/push` e `/sync/changes` di
   quell'utente.

### Ho modificato la stessa cosa su due dispositivi e ne è rimasta una sola

È il comportamento previsto: vince la modifica fatta **più tardi sul
dispositivo**, e l'altra viene rifiutata con lo stato autorevole in risposta.

Il numero di conflitti risolti è visibile nelle impostazioni. La regola completa
è in [SYNC.md](SYNC.md).

### Ho cancellato una cosa e sull'altro dispositivo è ricomparsa

Non dovrebbe: le cancellazioni vincono sempre sulle modifiche successive, e
viaggiano come cancellazione logica. Se succede davvero, è un bug — il caso è
coperto da due test in `backend/tests/integration/sync.test.ts`, quindi vale la
pena guardare i log di `/sync/push` per quell'id.

### Il tempo reale non funziona (le modifiche arrivano solo riaprendo l'app)

Il flusso `GET /sync/stream` è Server-Sent Events: tiene aperta una connessione
a lungo, e un proxy configurato male la interrompe o la mette in buffer.

- Con **nginx**: serve `proxy_buffering off;` sul percorso `/sync/stream`.
- Con **Caddy**: funziona senza configurazione.
- Il timeout del proxy sulle connessioni inattive deve essere lungo.

Non è un problema di correttezza: i dati arrivano comunque alla prossima
sincronizzazione. È solo più lento.

---

## App iOS

### `xcodegen: command not found`

```bash
brew install xcodegen
```

### Xcode: "Signing for 'Nina' requires a development team"

`DEVELOPMENT_TEAM` in `ios/project.yml` è vuoto. Metti il tuo Team ID e
riesegui `xcodegen generate`. Vedi [APP_STORE.md](APP_STORE.md).

### I widget mostrano dati vuoti

L'App Group non coincide. Deve essere **identico** in tre posti:

- `ios/Nina/Nina.entitlements`
- `ios/NinaWidgets/NinaWidgets.entitlements`
- `ios/Nina/Core/DatiCondivisi.swift`, costante `gruppo`

E deve essere registrato in App Store Connect, sia per l'app sia per
l'estensione. Se uno solo è diverso, non compare nessun errore: i widget leggono
un contenitore vuoto.

### I widget non si aggiornano

WidgetKit concede all'incirca 40–70 ricariche al giorno per widget. È un
budget, non un timer, e quando è finito il widget resta fermo. Non è un bug del
codice: è il funzionamento normale.

Mentre sviluppi, attiva **Impostazioni → Sviluppatore → WidgetKit Developer
Mode** sul dispositivo per togliere il limite.

L'app riscrive comunque la fotografia dei dati per i widget ogni volta che va in
background.

### L'app sul telefono non raggiunge il backend

In `DEBUG` l'app punta a `http://localhost:3000`, che dal simulatore funziona ma
da un iPhone vero significa "il telefono stesso".

Metti l'indirizzo IP del Mac sulla rete Wi-Fi in
`ios/Nina/Networking/ClientAPI.swift` (per esempio
`http://192.168.1.20:3000`), e assicurati che il backend sia in ascolto su
`HOST=0.0.0.0` — è già così di default.

### Le notifiche non arrivano

1. Il permesso è stato concesso? Impostazioni di iOS → Nina → Notifiche.
2. Le notifiche sono attive nelle impostazioni dell'app?
3. Sul **simulatore** le notifiche locali funzionano, ma i tempi non sono
   affidabili. Provale su un dispositivo vero.

Nina non usa notifiche push: sono tutte locali, programmate dal telefono. Se il
telefono è spento all'ora prevista, la notifica non arriva.

---

## Test

### I test di integrazione falliscono tutti con un errore di connessione

Serve un PostgreSQL raggiungibile.

```bash
createdb nina_test
export DATABASE_URL="postgresql://localhost:5432/nina_test"
npm test
```

### Un test passa da solo ma fallisce insieme agli altri

I file non girano in parallelo (`fileParallelism: false`) proprio per evitarlo,
e ogni file ricostruisce lo schema da zero. Se succede lo stesso, la causa più
probabile è uno stato di processo condiviso: una variabile d'ambiente cambiata
da un file di test e non ripristinata. Per questo `tests/setup.ts` **assegna**
i limiti di richiesta invece di usare `??=`.

### I test hanno cancellato il mio database

`ricreaSchema()` esegue `DROP SCHEMA public CASCADE` sul database indicato da
`DATABASE_URL`. Non puntare mai i test al database di sviluppo o di produzione.

---

## Non è nell'elenco

Guarda i log del backend: in sviluppo sono leggibili, in produzione sono JSON.
Password, token e contenuto del diario sono redatti — se ti serve vedere un
campo che è stato censurato, è perché non deve finire in un log.

Poi:

- `curl http://localhost:3000/health` dice se il database risponde;
- `npm run migrate:status` dice se lo schema è aggiornato;
- `npm test` dice se qualcosa si è rotto in modo evidente;
- `http://localhost:3000/docs` permette di provare una singola API a mano.
