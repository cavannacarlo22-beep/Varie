# Creare il database su Neon

Questa guida è scritta per chi non ha mai usato un database. Non serve sapere
niente prima: ci sono dieci passi, e ogni passo dice cosa cliccare.

Alla fine avrai una **stringa di connessione** — una riga di testo che il
backend usa per parlare con il database. È l'unica cosa che devi portarti via
da qui.

> ⚠️ Quella stringa contiene una password. Non mandarla su WhatsApp, non
> incollarla in una chat, non metterla in un file che finisce su GitHub.
> Sta bene solo in un posto: il file `backend/.env`, che è già escluso da git.

---

## Cos'è Neon, in due righe

Neon è un servizio che tiene acceso un database PostgreSQL al posto tuo. Non
devi installare niente sul computer e non devi gestire un server. Il piano
gratuito basta ampiamente per un'app usata da poche persone.

PostgreSQL è il database vero e proprio: è il posto dove finiscono le tue
attività, le abitudini, il diario. Neon è la casa in cui vive.

---

## I dieci passi

### 1. Crea l'account

Vai su **https://neon.tech** e clicca **Sign up**. Puoi entrare con GitHub o
con Google. Non serve carta di credito.

### 2. Crea il progetto

Dopo la registrazione Neon propone subito di creare un progetto.

- **Project name**: `nina`
- **Postgres version**: lascia quella proposta (16 o superiore)
- **Region**: scegli quella più vicina a te. Se sei in Italia, `Europe
  (Frankfurt)` — `aws-eu-central-1`.

La regione conta: più è lontana, più l'app aspetta a ogni richiesta. Da Roma
verso Francoforte sono ~25 millisecondi; verso l'Oregon sono ~160.

Clicca **Create project**.

### 3. Dai un nome al database

Neon ne crea uno chiamato `neondb`. Va benissimo, ma un nome che dice cosa c'è
dentro è meglio. Nella barra a sinistra apri **Branches → main → Databases**,
poi **New database**:

- **Name**: `nina`
- **Owner**: lascia l'utente proposto

### 4. Copia la stringa di connessione

Torna sulla **Dashboard** del progetto. In alto c'è un riquadro **Connection
string** con un menù a tendina.

Seleziona:
- **Database**: `nina`
- **Role**: l'utente proposto
- spunta **Pooled connection**

Copia la stringa. Ha questa forma:

```
postgresql://nina_owner:AbCd1234XyZ@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/nina?sslmode=require
```

Le parti, così sai cosa stai guardando:

| Pezzo | Cos'è |
|---|---|
| `nina_owner` | il nome utente |
| `AbCd1234XyZ` | **la password** — è questa che non va condivisa |
| `ep-cool-name-...-pooler...` | l'indirizzo del server |
| `/nina` | il nome del database |
| `?sslmode=require` | "parla solo su connessione cifrata" |

**Perché "pooled".** Il backend apre e chiude connessioni continuamente. La
versione *pooled* dell'indirizzo mette in mezzo un gestore che le riusa: senza
di quello, sotto carico Neon rifiuta le connessioni nuove. La versione non
pooled (senza `-pooler`) serve solo per operazioni amministrative rare, come le
migration su un database molto grande.

### 5. Incolla la stringa nel backend

Nella cartella `backend/` copia il file di esempio:

```bash
cd backend
cp .env.example .env
```

Apri `.env` con un editor di testo e sostituisci la riga `DATABASE_URL=` con la
tua stringa:

```
DATABASE_URL=postgresql://nina_owner:AbCd1234XyZ@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/nina?sslmode=require
```

### 6. Genera i due segreti

Nello stesso file ci sono `JWT_SECRET` e `JWT_REFRESH_SECRET`, vuoti. Servono a
firmare i "biglietti d'ingresso" delle sessioni. Devono essere due valori
**diversi** e lunghi, e li genera il computer — non inventarli a mano.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Esegui il comando **due volte** e incolla un risultato per riga:

```
JWT_SECRET=il-primo-valore-generato
JWT_REFRESH_SECRET=il-secondo-valore-generato
```

Se fossero uguali il backend si rifiuterebbe di partire, e ha ragione: sono due
chiavi separate proprio perché, se una trapela, l'altra continui a proteggere
le sessioni.

### 7. Installa e crea le tabelle

```bash
npm install
npm run migrate
```

Il comando applica in ordine i quattro file di `database/migrations/` e stampa
cosa ha fatto. Da questo momento il database ha le sue tabelle.

Per rivedere lo stato in qualsiasi momento, senza toccare niente:

```bash
npm run migrate:status
```

### 8. Crea l'account amministratore

```bash
npm run create-admin
```

Lo script chiede nome, cognome, email e password. **La password si digita al
momento**: non compare a schermo mentre la scrivi, non finisce nella cronologia
della shell, non è scritta in nessun file del progetto e nel database ne viene
salvata solo l'impronta (Argon2id). Se scegli una password debole lo script la
rifiuta e te ne fa scrivere un'altra.

Per l'account di Teresa Sardanelli: nome `Teresa`, cognome `Sardanelli`, e
l'email che userà per accedere.

Lo stesso comando, eseguito di nuovo con la stessa email, aggiorna la password
invece di creare un secondo account: è anche la procedura di recupero se la
password viene dimenticata.

### 9. Accendi il backend

```bash
npm run dev
```

Dovresti leggere qualcosa come `Server in ascolto su http://0.0.0.0:3000`.
Verifica che sia davvero collegato al database:

```bash
curl http://localhost:3000/health
```

Risposta attesa:

```json
{"status":"ok","database":{"ok":true,"latencyMs":42}}
```

Se `latencyMs` è alto (anche 3000) la prima volta, è normale: Neon mette in
pausa i database inattivi nel piano gratuito, e la prima richiesta li risveglia.
La seconda sarà veloce.

### 10. Guarda dentro

Apri **http://localhost:3000/docs**: è la documentazione interattiva di tutte
le API, generata dal codice. Puoi provare le chiamate da lì.

Su Neon, invece, la voce **SQL Editor** nella barra laterale ti fa scrivere
query direttamente. Per vedere le tabelle create:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

---

## Cose utili da sapere dopo

### Il database si mette in pausa

Nel piano gratuito Neon sospende il database dopo qualche minuto di inattività.
La prima richiesta successiva impiega uno o due secondi in più. Il backend lo
sa: i timeout di connessione sono generosi apposta. Se ti dà fastidio, il piano
a pagamento lo tiene sempre acceso.

### I branch

Neon permette di "ramificare" il database come si fa con il codice: un branch
`sviluppo` con una copia dei dati, su cui provare le migration senza toccare
quello vero. Si crea da **Branches → New branch**, e ha una sua stringa di
connessione da mettere in un `.env` diverso.

### I backup

Neon tiene una cronologia (**Point-in-time restore**) che nel piano gratuito
copre le ultime 24 ore: si può riportare il database a com'era in un momento
preciso, da **Branches → Restore**. Per qualcosa di più solido, vedi la sezione
sui backup in [DEPLOYMENT.md](DEPLOYMENT.md).

### Se qualcosa non funziona

Vedi [TROUBLESHOOTING.md](TROUBLESHOOTING.md): ci sono gli errori più comuni
con la traduzione in italiano e cosa fare.
