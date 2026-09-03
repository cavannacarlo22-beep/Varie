# Mettere il sito online su Vercel

Il sito è **statico**: solo HTML, CSS, JavaScript, font e immagini. Non c'è niente da
compilare, non serve Node, non serve un database. Vercel lo pubblica così com'è,
**gratis**, su un indirizzo tipo `teresasardanelli.vercel.app`.

> ⚠️ **Una cosa importante prima di cominciare.**
> In questo repository ci sono **due siti**: nella cartella principale c'è il sito di
> Carlo Cavanna, nella cartella `teresa/` c'è il tuo. Quando configuri Vercel devi
> quindi indicare `teresa` come **Root Directory**. È un campo che trovi nella
> schermata di configurazione: se lo salti, Vercel pubblica il sito sbagliato.

---

## Strada A — collegando GitHub (consigliata, ~5 minuti)

È la strada migliore: ogni volta che il codice cambia su GitHub, il sito si aggiorna
da solo, senza che tu debba rifare niente.

### 1. Crea l'account
Vai su **https://vercel.com/signup** e scegli **Continue with GitHub**.
Accedi con l'account GitHub che possiede questo repository e autorizza Vercel.

### 2. Importa il progetto
Nella dashboard clicca **Add New…** → **Project**.
Nella lista dei repository cerca **`Varie`** e clicca **Import**.

Se non lo vedi nella lista, clicca *Adjust GitHub App Permissions* e concedi a Vercel
l'accesso a quel repository.

### 3. Configura (questo è il passaggio da non sbagliare)

| Campo | Cosa mettere |
|---|---|
| **Project Name** | `teresa-sardanelli` — diventerà `teresa-sardanelli.vercel.app` |
| **Framework Preset** | **Other** |
| **Root Directory** | clicca **Edit** e seleziona la cartella **`teresa`** |
| Build Command | *lascia vuoto* |
| Output Directory | *lascia vuoto* |
| Install Command | *lascia vuoto* |

Il nome del progetto è quello che finisce nell'indirizzo, quindi scegli con calma:
tutto minuscolo, senza spazi, con il trattino al posto degli spazi.

### 4. Scegli il branch giusto
Questo repository non ha un branch `main`: il tuo sito vive sul branch
**`claude/clutch-bag-ecommerce-site-t9r581`**.

Apri **Settings → Git → Production Branch** (lo trovi anche durante l'import, sotto
*Git Branch*) e scrivi esattamente:

```
claude/clutch-bag-ecommerce-site-t9r581
```

### 5. Deploy
Clicca **Deploy** e aspetta 20–40 secondi. Alla fine vedrai un'anteprima con i
coriandoli e il link al sito: **`https://teresa-sardanelli.vercel.app`**. È già online
e visibile a chiunque.

### 6. (Facoltativo) Cambia l'indirizzo
Se il nome non ti piace: **Settings → Domains**. Da lì puoi:
- aggiungere un altro indirizzo `.vercel.app` gratuito (es. `clutch-teresa.vercel.app`);
- collegare un dominio tuo, tipo `teresasardanelli.it`, se ne comprerai uno.
  Vercel ti dirà quali record DNS impostare presso chi ti ha venduto il dominio.

---

## Strada B — senza GitHub, trascinando la cartella (~2 minuti)

Più veloce ma meno comoda: a ogni modifica devi ripetere il caricamento a mano.

1. Scarica il repository come ZIP da GitHub (**Code → Download ZIP**) ed estrailo.
2. Vai su **https://vercel.com/new** e, in fondo alla pagina, cerca l'area
   *deploy a folder* / **Drop your project folder here**.
3. Trascina **solo la cartella `teresa`** (non tutto il repository).
4. Vercel carica i file e pubblica. Alla fine ti dà il link `.vercel.app`.

---

## Strada C — da terminale, con la CLI

Se preferisci la riga di comando:

```bash
npm i -g vercel          # una volta sola
cd teresa                # entra nella cartella del sito
vercel login             # ti arriva un'email di conferma
vercel --prod            # pubblica
```

Alla prima esecuzione la CLI fa alcune domande: rispondi **N** a
*"Want to modify these settings?"* e lascia il resto ai valori proposti.

---

## Dopo la pubblicazione: 3 cose da sistemare

### 1. Metti il tuo numero di WhatsApp
Il pulsante **"Completa l'ordine"** manda il riepilogo del carrello su WhatsApp.
Apri `assets/js/main.js`: le prime righe utili sono queste.

```js
var SHOP = {
  whatsapp: '',                          // ← qui
  email: 'ciao@teresasardanelli.it',     // ← e qui
  shipping: 7,
  freeFrom: 150,
```

Scrivi il numero con il prefisso internazionale, **senza `+`, spazi o zeri iniziali**:

```js
  whatsapp: '393401234567',
```

Se lasci `whatsapp` vuoto, gli ordini partono via email all'indirizzo che metti sotto.
Cambia anche l'email: compare nei contatti e nel piè di pagina.

### 2. Cambia l'indirizzo del sito nei metadati
In `scripts/build.py`, in alto, c'è:

```python
SITE = "https://teresasardanelli.vercel.app"
IG   = "teresasardanelli"
```

Metti l'indirizzo vero che ti ha dato Vercel e il tuo vero profilo Instagram,
poi rigenera il sito con `python3 scripts/build.py`.
Aggiorna anche `robots.txt` e `sitemap.xml` con lo stesso indirizzo.

### 3. Aggiorna il sito quando cambi qualcosa
Se hai seguito la **Strada A**, ti basta salvare le modifiche su GitHub: Vercel
ripubblica da solo in meno di un minuto. Da terminale:

```bash
git add -A
git commit -m "Aggiorno prezzi"
git push
```

---

## Problemi frequenti

**Vedo il sito sbagliato (quello di Carlo).**
Root Directory non è impostata su `teresa`. Vai in **Settings → General → Root
Directory**, scrivi `teresa`, salva e fai **Redeploy** dalla scheda *Deployments*.

**Pagina bianca o senza stili.**
Quasi sempre è ancora la Root Directory sbagliata. Controlla anche che il file
`index.html` sia dentro `teresa/` e non in una sottocartella.

**Ho modificato i prezzi ma il sito mostra ancora i vecchi.**
I prezzi stanno in `scripts/products.json` e vanno "compilati" nel sito:
lancia `python3 scripts/build.py`, poi fai commit e push.

**Il sito è online ma Google non lo trova.**
È normale nei primi giorni. Per accelerare, registra il sito su
[Google Search Console](https://search.google.com/search-console) e invia
`https://iltuosito.vercel.app/sitemap.xml`.
