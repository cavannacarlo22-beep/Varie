# Nina 💗

Un'app per iPhone e iPad che aiuta a organizzare le giornate senza far sentire
in colpa quando qualcosa non va come previsto.

Nina non è un gestore di attività con le emoji: è pensata perché aprirla sia
piacevole. Le cose da fare, le abitudini, come ti senti oggi, il diario, la
wishlist — tutto in un posto, tutto sincronizzato fra iPhone e iPad, tutto
disponibile anche senza connessione.

E ogni tanto ti ricorda anche di respirare 😂

---

## Cosa c'è dentro

```
nina/
├── backend/        Node.js + TypeScript + Fastify, su Neon PostgreSQL
├── ios/            App nativa SwiftUI (iOS/iPadOS 17+), widget, App Intents
└── docs/           Come si installa, come funziona, come si pubblica
```

**Backend** — API REST documentata in OpenAPI, autenticazione con Argon2id e
token a rotazione, motore di sincronizzazione, aggiornamenti in tempo reale via
Server-Sent Events, pannello amministrativo, e un motore conversazionale
italiano che risponde senza costare niente.

**iOS** — app nativa, non una pagina web dentro un contenitore. SwiftUI con
SwiftData per la copia locale, layout separato per iPad (`NavigationSplitView`,
non un iPhone ingrandito), Dark Mode, widget WidgetKit, scorciatoie Siri,
notifiche locali.

## Le funzioni

| | |
|---|---|
| 🏠 **Home** | il saluto giusto per l'ora, le cose di oggi, il pensiero del giorno |
| ✓ **To Do** | priorità, categorie, ripetizioni, promemoria |
| 📅 **Calendario** | mese e settimana, con il conteggio per giorno |
| 💗 **Mood** | un tocco al giorno, e col tempo l'andamento |
| 🔥 **Abitudini** | serie di giorni consecutivi e la striscia della settimana |
| 🧖 **Self care** | idee vere, non "vogliti bene" |
| 📔 **Diario** | privato. Nessuno lo legge, nemmeno chi gestisce l'app |
| ✨ **Wishlist** | le cose che ti piacerebbero, anche solo per guardarle |
| 📈 **Progressi** | quello che hai fatto, senza classifiche |
| 🌸 **La mia amica** | qualcuno con cui parlare, anche alle due di notte |

## Come è fatta, in breve

- Il **database autorevole** è PostgreSQL su Neon. Sul telefono c'è una copia
  locale (SwiftData) che serve a funzionare offline: se la si cancella non si
  perde niente.
- L'app **non parla mai** direttamente con il database. Passa dal backend, con
  un token di sessione.
- Le **schermate leggono e scrivono solo in locale**. La sincronizzazione
  avviene dopo, da sola. È quello che rende l'app utilizzabile in metropolitana
  senza scrivere due volte ogni funzione.
- La sincronizzazione si basa su un **contatore che sale a ogni modifica**, uno
  per account. Un dispositivo chiede "cosa è cambiato dopo il numero N?".
- I **conflitti** hanno una regola sola e deterministica: vince la modifica
  fatta più tardi sul dispositivo; a parità esatta decide l'id del dispositivo;
  le cancellazioni vincono sempre. Nessuna modifica sparisce in silenzio.

Il dettaglio sta in [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md) e
[docs/SYNC.md](docs/SYNC.md).

## Sicurezza, in tre righe

- **L'app non contiene nessun segreto**: né password del database, né chiavi
  private, né API key. Un'app pubblicata è un file che chiunque può aprire.
- **L'account amministratore non esiste nel repository**: lo crea uno script che
  chiede la password al momento, senza mostrarla e senza scriverla da nessuna
  parte.
- **L'amministratrice non può leggere i diari.** Non è una convenzione:
  l'endpoint non esiste, e un test legge il codice per verificarlo.

Tutto il resto in [docs/SICUREZZA.md](docs/SICUREZZA.md).

---

## Partire da zero

### 1. Il database

Serve un account Neon e la stringa di connessione: dieci minuti, gratis, e si
fa anche dal telefono. I passi sono in [docs/NEON_SETUP.md](docs/NEON_SETUP.md),
scritti per chi non ha mai usato un database.

### 2. Tutto il resto, con un comando

```bash
cd nina
./avvia.sh
```

Lo script controlla che ci siano Node e npm, prepara il file della
configurazione, **genera i due segreti al posto tuo**, installa le librerie,
crea le tabelle, crea l'account amministratore e accende il backend. Se trova
XcodeGen genera anche il progetto Xcode.

Chiede una cosa sola: la stringa di connessione del passo precedente — e non la
mostra a schermo mentre la incolli, perché contiene una password e il terminale
tiene una cronologia.

Si può rieseguire quante volte si vuole: ogni passo salta da solo se è già
fatto, e non sovrascrive mai un file `.env` esistente.

<details>
<summary>Preferisci fare i passi a mano?</summary>

```bash
cd backend
cp .env.example .env      # poi compila DATABASE_URL e i due segreti
npm install
npm run migrate
npm run create-admin      # la password si digita qui, non sta in nessun file
npm run dev
```
</details>

Verifica: `curl http://localhost:3000/health` deve rispondere
`{"status":"ok",...}`.
La documentazione interattiva delle API è su http://localhost:3000/docs.

### 3. L'app

Se `avvia.sh` non ha trovato XcodeGen:

```bash
brew install xcodegen     # una volta sola
cd ios
xcodegen generate
open Nina.xcodeproj
```

Poi `⌘R` sul simulatore. In `DEBUG` l'app punta a `http://localhost:3000`; per
provarla su un iPhone vero serve l'IP del Mac sulla stessa rete Wi-Fi — vedi
`ios/Nina/Networking/ClientAPI.swift`.

### 4. I test

```bash
cd backend && npm test    # 104 test, su un PostgreSQL vero
```

In Xcode, `⌘U` per i test dell'app.

---

## Stato del progetto

**Il codice è completo. Non è pubblicabile senza alcuni passaggi manuali**, e
nessuno di questi può stare nel repository — è proprio il motivo per cui sono
manuali.

### Verificato davvero

- Le migration applicate a un PostgreSQL 16 vero; ogni vincolo di integrità
  provato uno a uno.
- Il motore di sincronizzazione: contatori indipendenti per utente, delta
  corretti, conflitti risolti come descritto, cancellazioni che viaggiano,
  elementi creati offline che arrivano.
- Il flusso Server-Sent Events fra due dispositivi simulati.
- Il pannello amministrativo raggiungibile da un'amministratrice e invisibile
  (404) a tutti gli altri.
- `create-admin` guidato da un terminale finto, per verificare che la password
  non compaia mai a schermo e che le password deboli vengano rifiutate.
- 104 test automatici del backend, tutti verdi.

### Non verificato

- **Il codice Swift non è mai stato compilato.** È stato scritto in un ambiente
  Linux, dove non esiste un toolchain Swift né Xcode. Va aperto in Xcode e
  costruito: aspettati di dover sistemare qualcosa la prima volta.
- I test dell'app (`NinaTests`, `NinaUITests`) sono scritti ma mai eseguiti, per
  lo stesso motivo.
- Widget, App Intents e notifiche sono scritti seguendo le regole di WidgetKit e
  App Intents, ma non provati su un dispositivo.

### Passaggi manuali obbligatori

| Cosa | Dove | Perché non è già fatto |
|---|---|---|
| Creare l'account Neon e ottenere `DATABASE_URL` | [NEON_SETUP.md](docs/NEON_SETUP.md) | è un account tuo |
| Generare `JWT_SECRET` e `JWT_REFRESH_SECRET` | `backend/.env` | sono segreti: in git sarebbero pubblici |
| Creare l'amministratrice | `npm run create-admin` | la password non deve esistere in nessun file |
| Configurare SMTP | `backend/.env` | credenziali di terzi |
| Impostare il Team ID Apple | `ios/project.yml` | è il tuo account sviluppatore |
| Cambiare i bundle id e l'App Group | `project.yml`, i due `.entitlements`, `DatiCondivisi.swift` | dipendono da un dominio che controlli |
| Puntare l'app al backend vero | `ios/Nina/Networking/ClientAPI.swift` | dipende da dove lo pubblichi |
| Mettere il backend dietro HTTPS | il tuo hosting | dipende dall'hosting |
| Generare il progetto Xcode | `cd ios && xcodegen generate` | il `.xcodeproj` non è versionato di proposito |

La lista completa, con la spunta da fare prima di archiviare, è in
[docs/APP_STORE.md](docs/APP_STORE.md).

---

## Documentazione

| Documento | Per chi |
|---|---|
| [NEON_SETUP.md](docs/NEON_SETUP.md) | chi non ha mai creato un database. Dieci passi |
| [BACKEND_SETUP.md](docs/BACKEND_SETUP.md) | chi lavora sul backend |
| [ARCHITETTURA.md](docs/ARCHITETTURA.md) | le decisioni tecniche e perché |
| [SYNC.md](docs/SYNC.md) | come iPhone e iPad restano allineati |
| [SICUREZZA.md](docs/SICUREZZA.md) | cosa è protetto e come |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | sviluppo, staging, produzione, backup |
| [APP_STORE.md](docs/APP_STORE.md) | pubblicare l'app |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | gli errori che capitano davvero |

---

## Una nota sul tono

Le frasi dell'app stanno tutte in `ios/Nina/Core/VoceDiNina.swift`. Sono più di
novanta, divise per situazione, e non si ripetono mai due volte di fila.

Le regole che le tengono insieme:

- si dà del tu, sempre;
- non si dice mai "utente", "elemento", "operazione";
- l'ironia serve ad alleggerire, mai a commentare un momento difficile;
- nessun messaggio è colpevolizzante: le cose non fatte non sono colpe.

"Attività completata" e "Fatta! Una cosa in meno 😌" costano lo stesso da
scrivere. La seconda però fa sorridere, e chi sorride torna domani.

C'è una suite di test che verifica tutto questo — che le frasi siano almeno
cinquanta, che non si ripetano, che il saluto corrisponda all'ora, e che nei
momenti storti non arrivi una battuta.
