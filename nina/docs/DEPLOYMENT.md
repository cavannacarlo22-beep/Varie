# Mettere Nina in produzione

Tre ambienti, un percorso solo. Se stai partendo da zero, leggi prima
[NEON_SETUP.md](NEON_SETUP.md).

## I tre ambienti

| | Sviluppo | Staging | Produzione |
|---|---|---|---|
| Dove gira | il tuo computer | un piccolo server o un servizio PaaS | lo stesso, con un piano serio |
| Database | branch Neon `sviluppo` o PostgreSQL locale | branch Neon `staging` | branch Neon `main` |
| `NODE_ENV` | `development` | `production` | `production` |
| Documentazione `/docs` | attiva | disattivata | disattivata |
| HTTPS | no (localhost) | sì | sì |
| Email | stampate nei log | SMTP di prova | SMTP vero |
| AI | `none` | `none` | come preferisci |
| Log | leggibili (pino-pretty) | JSON | JSON |

I branch di Neon sono lo strumento giusto per staging: un branch è una copia del
database di produzione, si crea in pochi secondi e ha una sua stringa di
connessione. Si prova una migration lì prima di applicarla al vero.

## Prima di ogni rilascio

```bash
cd backend
npm run typecheck    # zero errori
npm test             # tutta la suite verde
npm run build        # compila in dist/
```

Se uno dei tre fallisce, non si rilascia. Non c'è un caso in cui abbia senso.

## Il rilascio, passo per passo

### 1. Le variabili d'ambiente

Sul server (o nel pannello del servizio che usi) servono:

```
NODE_ENV=production
DATABASE_URL=postgresql://…-pooler…/nina?sslmode=require
JWT_SECRET=<48 byte casuali, diversi da quelli di sviluppo>
JWT_REFRESH_SECRET=<altri 48 byte casuali>
PUBLIC_BASE_URL=https://api.tuodominio.it
CORS_ORIGINS=https://tuodominio.it
LOG_LEVEL=info
SMTP_HOST=…
SMTP_PORT=587
SMTP_USER=…
SMTP_PASSWORD=…
SMTP_FROM="Nina <ciao@tuodominio.it>"
```

**I segreti di produzione devono essere diversi da quelli di sviluppo.** Se
riusi gli stessi, un token generato sul tuo portatile vale anche sul server
vero.

In produzione un segreto più corto di 32 caratteri blocca l'avvio: è un
controllo in `config.ts`, non un consiglio.

### 2. Le migration

```bash
npm run migrate:status   # cosa manca
npm run migrate          # applica
```

Ogni file viene applicato dentro una transazione insieme alla riga che lo
registra: se fallisce a metà, il database resta come prima e la migration non
risulta applicata. Non esiste lo stato "mezza migrata".

C'è anche un checksum su ogni migration già applicata. Se qualcuno modifica un
file già eseguito, il comando si ferma e lo dice: il database sarebbe diverso da
quello che il file descrive, e senza il checksum nessuno se ne accorgerebbe.

Per lo stesso motivo: **una migration applicata non si modifica mai**. Se serve
un cambiamento, si aggiunge `005_qualcosa.sql`.

### 3. L'amministratrice

Sul server di produzione, una volta:

```bash
npm run create-admin
```

La password si digita al momento e non finisce da nessuna parte se non nel
database, come impronta Argon2id. Se l'hosting non ti dà un terminale
interattivo, esegui lo script da un ambiente che può raggiungere lo stesso
`DATABASE_URL`.

### 4. Avvio

```bash
npm run build
npm start
```

Il processo deve essere riavviato automaticamente se cade. A seconda di dove
gira: `systemd`, il process manager del PaaS, o Docker con `restart: always`.

### 5. Verifica

```bash
curl https://api.tuodominio.it/health
```

Risposta attesa:

```json
{"status":"ok","database":{"ok":true,"latencyMs":12}}
```

Un `503` con `"status":"degraded"` significa che il backend è vivo ma non
raggiunge il database.

Poi, in ordine:

- registra un account di prova e accedi;
- crea un'attività, chiudi l'app, riaprila: deve esserci;
- accedi con lo stesso account su un secondo dispositivo e verifica che
  l'attività arrivi;
- prova il link di verifica email (deve aprirsi una pagina, non un JSON);
- controlla che `https://api.tuodominio.it/docs` risponda **404**: in produzione
  l'interfaccia della documentazione è disattivata.

## Davanti al backend

Il backend parla HTTP e si aspetta di stare dietro qualcosa che fa HTTPS
(Caddy, nginx, o il router del servizio PaaS). Con `NODE_ENV=production`,
Fastify si fida dell'header `X-Forwarded-For`: serve perché il limite di
richieste veda l'IP vero e non quello del proxy. Se metti il backend
direttamente su internet senza proxy, quell'header diventa falsificabile — non
farlo.

Esempio minimo con Caddy:

```
api.tuodominio.it {
    reverse_proxy localhost:3000
}
```

Caddy ottiene e rinnova il certificato da solo.

## Server-Sent Events e proxy

`GET /sync/stream` tiene aperta una connessione a lungo. Due accorgimenti:

- **buffering disattivato**: nginx richiede `proxy_buffering off;` sul percorso
  `/sync/stream`, altrimenti gli eventi arrivano a blocchi o non arrivano;
- **timeout lungo**: se il proxy chiude le connessioni inattive dopo 60 secondi,
  il flusso cade di continuo. L'app si riconnette, quindi nessun dato va perso,
  ma è traffico sprecato.

Con Caddy funziona senza configurazione aggiuntiva.

## Backup e conservazione

| Cosa | Come | Ogni quanto | Per quanto |
|---|---|---|---|
| Point-in-time restore | incluso in Neon | continuo | 24 h nel piano gratuito, di più a pagamento |
| Dump completo | `pg_dump` in cron | notturno | 30 giorni |
| Verifica del ripristino | ripristinare un dump su un branch di prova | mensile | — |

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner \
  --file="nina-$(date +%F).dump"
```

Il dump contiene **i diari delle persone**. Va cifrato e va tenuto in un posto
con l'accesso ristretto:

```bash
gpg --symmetric --cipher-algo AES256 "nina-$(date +%F).dump"
shred -u "nina-$(date +%F).dump"
```

> Un backup che non è mai stato ripristinato non è un backup: è un file. La
> verifica mensile su un branch Neon di prova serve a questo, e costa dieci
> minuti.

Politica di conservazione consigliata: 30 giorni per i dump, poi cancellazione.
Non serve tenere per anni il diario di qualcuno che ha cancellato l'account
l'anno scorso — e, se qualcuno chiede la cancellazione dei propri dati, i
backup vecchi sono l'unico posto in cui potrebbero sopravvivere.

## Rollback

Se un rilascio va male:

1. **Il codice** torna alla versione precedente (git tag, o l'immagine
   precedente).
2. **Le migration non tornano indietro.** Non ci sono `down`, di proposito:
   una `down` scritta male perde dati, e una scritta bene è rara. Il percorso è
   sempre in avanti — si scrive una nuova migration che sistema.
3. Se la migration ha davvero rovinato i dati, si usa il **point-in-time
   restore** di Neon per riportare il database all'istante prima del rilascio.
   È il motivo per cui si applica sempre prima su un branch di staging.

## Monitoraggio minimo

Non serve una piattaforma. Servono tre cose:

- un controllo esterno su `/health` ogni minuto, che avvisa se risponde male;
- i log salvati da qualche parte, ricercabili (sono JSON in produzione);
- un'occhiata ai log con `level: "warn"`: lì compaiono i riusi di refresh token,
  che sono l'unico segnale automatico di un possibile furto di sessione.

## L'app iOS

Il rilascio dell'app è un percorso separato: vedi [APP_STORE.md](APP_STORE.md).

L'unica cosa da ricordare qui: l'indirizzo del backend è compilato dentro
l'app. Cambiarlo richiede un nuovo rilascio e l'attesa della revisione Apple,
quindi il dominio va scelto una volta e tenuto — anche se cambi hosting.
