# Il sito è online — come aggiornarlo

**Indirizzo: https://teresa-sardanelli.vercel.app**

La pubblicazione è già fatta, non devi rifare niente. Questo file serve per dopo:
per capire com'è messo in piedi e cosa fare quando vuoi cambiare qualcosa.

---

## Com'è configurato

| Cosa | Valore |
|---|---|
| Progetto Vercel | `teresa-sardanelli` |
| Repository | `cavannacarlo22-beep/Varie` |
| **Root Directory** | **`teresa`** ← la cosa che prima non andava |
| Branch pubblicato | `claude/ui-ux-pro-max-skill-install-rn1tym` (il principale) |
| Build | nessuna: è un sito statico, Vercel copia i file e basta |

### Perché prima vedevi il sito di Carlo
Nel repository ci sono due siti: quello di Carlo nella radice, il tuo nella cartella
`teresa/`. Se non dici a Vercel di guardare dentro `teresa`, lui pubblica la radice —
cioè il sito di Carlo. È l'impostazione **Root Directory**, e adesso è a posto.

### Gli altri due progetti nel tuo account
Nella dashboard trovi anche `varie` e `varie-dldm`: sono i tentativi di prima, puntano
alla radice e quindi mostrano il sito di Carlo. Non danno fastidio a niente, ma se
vuoi fare pulizia puoi cancellarli da **Settings → Advanced → Delete Project**. Non
toccano né il tuo sito né il repository.

---

## Aggiornare il sito

Ogni volta che il codice cambia sul branch principale, **Vercel ripubblica da solo**
in meno di un minuto. Non devi aprire la dashboard.

Se modifichi i file da GitHub direttamente dal browser (matita in alto a destra su un
file → *Commit changes*), il sito si aggiorna da sé. Da terminale:

```bash
git add -A
git commit -m "Aggiorno i prezzi"
git push
```

⚠️ Ricorda: se tocchi `scripts/products.json` (prezzi, colori, misure, foto) devi poi
lanciare `python3 scripts/build.py` **prima** del commit, altrimenti il sito continua
a mostrare i valori vecchi. Il perché è spiegato nel [README](README.md).

---

## Cambiare indirizzo

Ora è `teresa-sardanelli.vercel.app`. In **Settings → Domains** puoi:

- **aggiungere un altro indirizzo `.vercel.app` gratuito** — per esempio
  `clutchdiTeresa.vercel.app`. Scrivi il nome, Vercel controlla se è libero e lo attiva
  subito. Il vecchio continua a funzionare;
- **collegare un dominio tuo** tipo `teresasardanelli.it`, se lo compri (15–20 euro
  l'anno). Vercel ti dice quali due righe DNS impostare presso chi te l'ha venduto.

Se cambi indirizzo, ricordati di aggiornarlo anche in tre punti:
`scripts/build.py` (riga `SITE = ...`), `robots.txt` e `sitemap.xml`. Poi rigenera con
`python3 scripts/build.py`. Servono per Google e per l'anteprima quando mandi il link
su WhatsApp.

---

## Le due cose ancora da sistemare

### 1. Il numero di WhatsApp (senza, gli ordini non arrivano bene)
Il pulsante **Completa l'ordine** manda il riepilogo del carrello su WhatsApp. Finché
il numero è vuoto, ripiega sull'email. Apri `assets/js/main.js`, in cima:

```js
var SHOP = {
  whatsapp: '',                          // ← il tuo numero
  email: 'ciao@teresasardanelli.it',     // ← la tua email vera
```

Numero con prefisso internazionale, **senza `+`, spazi o zeri iniziali**:

```js
  whatsapp: '393401234567',
```

Cambia anche `IG = "teresasardanelli"` in `scripts/build.py` col tuo profilo Instagram
vero, altrimenti il link nel sito porta a un profilo che non esiste.

### 2. Le foto
In vetrina ci sono ancora i disegni. Vedi **[FOTO.md](FOTO.md)**: si può fare una foto
alla volta, il sito è costruito apposta.

---

## Se qualcosa non va

**Ho modificato un file ma il sito è uguale.**
Guarda su vercel.com → progetto `teresa-sardanelli` → scheda **Deployments**: in cima
c'è l'ultimo tentativo. Se è verde (*Ready*), svuota la cache del browser
(Ctrl+F5, o Cmd+Shift+R su Mac). Se è rosso (*Error*), clicca sopra e leggi il log.

**Ho cambiato i prezzi in products.json ma il sito mostra i vecchi.**
Manca `python3 scripts/build.py` prima del commit.

**Il sito è online ma Google non lo trova.**
Normale nei primi giorni. Per accelerare, registra il sito su
[Google Search Console](https://search.google.com/search-console) e invia
`https://teresa-sardanelli.vercel.app/sitemap.xml`.
