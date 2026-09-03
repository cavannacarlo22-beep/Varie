# Pubblicare il sito su Vercel (dominio di prova gratuito)

Il sito è un sito **statico**: solo HTML, CSS, JavaScript e font. Non c'è niente da
compilare e non serve Node. Vercel lo pubblica così com'è, gratis, su un dominio
tipo `carlocavanna.vercel.app`.

Scegli **una** delle due strade qui sotto. La prima è la più comoda: ogni volta che
il codice cambia su GitHub, il sito si aggiorna da solo.

---

## Strada A — da GitHub (consigliata, ~3 minuti)

1. Vai su **https://vercel.com/signup** e registrati con **Continue with GitHub**.
   Autorizza Vercel a leggere i tuoi repository.

2. Nella dashboard clicca **Add New… → Project**.

3. Nella lista dei repository cerca **`varie`** e clicca **Import**.
   Se non lo vedi, clicca *Adjust GitHub App Permissions* e dai a Vercel accesso
   a quel repository.

4. Nella schermata di configurazione lascia tutto com'è:

   | Campo | Valore |
   |---|---|
   | Framework Preset | **Other** |
   | Root Directory | `./` (la radice) |
   | Build Command | *vuoto* |
   | Output Directory | *vuoto* |
   | Install Command | *vuoto* |

   È un sito statico: non serve nessun comando di build.

5. Apri **Git Branch** (o *Production Branch* nelle impostazioni avanzate) e
   seleziona il branch `claude/carlo-cavanna-showcase-site-dcc7ra`, che è dove
   vive il sito. In alternativa unisci prima quel branch in `main` e lascia `main`.

6. Clicca **Deploy** e aspetta ~30 secondi.

7. Il sito è online. Vercel ti dà subito un indirizzo tipo:

   ```
   https://varie-carlocavanna.vercel.app
   ```

### Scegliere un indirizzo `.vercel.app` più bello

Project → **Settings** → **Domains** → **Edit** accanto al dominio generato.
Puoi scrivere il nome che vuoi, purché libero, per esempio:

```
carlocavanna.vercel.app
```

Se lo cambi, aggiorna anche i tre punti in cui l'indirizzo è scritto nel codice
(vedi *Dopo la pubblicazione* più sotto).

### Aggiornamenti futuri

Da qui in avanti ogni `git push` sul branch di produzione ripubblica il sito
automaticamente. I push sugli altri branch generano un'anteprima con un link
separato, utile per far vedere le modifiche a un cliente prima di renderle live.

---

## Strada B — dal terminale, senza GitHub (~2 minuti)

Utile per mettere online una copia al volo.

```bash
# 1. installa la CLI di Vercel (una volta sola)
npm i -g vercel

# 2. accedi (apre il browser)
vercel login

# 3. dalla cartella del sito, pubblica l'anteprima
cd /percorso/della/cartella
vercel

# 4. quando sei soddisfatto, pubblica in produzione
vercel --prod
```

Alle domande della CLI rispondi così:

| Domanda | Risposta |
|---|---|
| Set up and deploy? | `y` |
| Which scope? | il tuo account personale |
| Link to existing project? | `n` |
| Project name? | `carlocavanna` (diventa `carlocavanna.vercel.app`) |
| In which directory is your code located? | `./` |
| Want to modify these settings? | `n` |

Al termine la CLI stampa l'URL pubblico.

---

## Dopo la pubblicazione

Quando conosci l'indirizzo definitivo, sostituisci `carlocavanna.vercel.app` nei
tre file che lo contengono, così anteprime social e Google puntano all'indirizzo giusto:

- `index.html` → tag `canonical`, `og:url` e il blocco `application/ld+json`
- `robots.txt` → riga `Sitemap:`
- `sitemap.xml` → tag `<loc>`

Da terminale, in un colpo solo:

```bash
grep -rl 'carlocavanna.vercel.app' . --exclude-dir=.git \
  | xargs sed -i 's|carlocavanna\.vercel\.app|IL-TUO-INDIRIZZO|g'
```

### Collegare un dominio vero (quando lo comprerai)

Project → **Settings** → **Domains** → **Add**, scrivi `tuodominio.it` e Vercel ti
mostra i record DNS da inserire dal fornitore dove hai comprato il dominio
(di solito un record `A` verso `76.76.21.21` e un `CNAME` `www` verso
`cname.vercel-dns.com`). Il certificato HTTPS lo emette Vercel da solo, gratis.

---

## Cosa c'è nel progetto

```
index.html              la pagina, unica
vercel.json             cache dei file statici + header di sicurezza
robots.txt              istruzioni per i motori di ricerca
sitemap.xml             mappa del sito
assets/css/style.css    tutto lo stile
assets/css/fonts.css    dichiarazioni dei font self-hosted
assets/js/main.js       animazioni, form, menu, FAQ
assets/js/bg.js         sfondo WebGL animato
assets/fonts/           font in locale (nessuna chiamata a Google)
assets/img/og.png       anteprima quando condividi il link
assets/img/favicon.svg  icona della scheda del browser
```

## Provare il sito in locale prima di pubblicarlo

Serve un mini server web: aprire `index.html` con doppio clic non basta, perché
i percorsi dei file partono da `/`.

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```
