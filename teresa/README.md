# Teresa Sardanelli — clutch bag fatte a mano

Sito e-commerce vetrina per clutch artigianali. Statico, senza framework e senza
build in produzione: 8 modelli, 3 misure, 8 colori, carrello con ordine via
WhatsApp o email.

**Per pubblicarlo online → leggi [DEPLOY.md](DEPLOY.md).**

---

## Com'è fatto

```
teresa/
├── index.html              ← generato, non modificarlo a mano
├── assets/
│   ├── css/style.css       ← tutto lo stile
│   ├── css/fonts.css       ← dichiarazioni dei font
│   ├── js/main.js          ← carrello, quick view, animazioni  ⚙️ QUI I CONTATTI
│   ├── js/products.js      ← generato: dati prodotto per il carrello
│   ├── fonts/              ← Cormorant + Jost, self-hostati
│   └── img/                ← favicon, icona, immagine social
├── scripts/
│   ├── products.json       ← ⭐ IL CATALOGO: prezzi, misure, colori
│   ├── bags.py             ← disegna le illustrazioni SVG delle borse
│   ├── template.html       ← i testi delle pagine
│   └── build.py            ← genera index.html + products.js
├── vercel.json             ← cache e header di sicurezza
├── robots.txt / sitemap.xml
└── DEPLOY.md               ← guida per andare online
```

Peso della home: ~68 kB di HTML, ~20 kB fra CSS e JS, più i font (~130 kB).
Nessuna libreria esterna, nessun cookie, nessun tracciamento.

---

## Modificare il catalogo

Tutto quello che riguarda i prodotti sta in **`scripts/products.json`**.
Dopo ogni modifica rigenera il sito:

```bash
python3 scripts/build.py
```

### Cambiare un prezzo
```json
{ "id": "media", "name": "Media", "dim": "26 × 15 × 5 cm", "price": 125 }
```
Cambia `125` e rigenera. Il prezzo si aggiorna nella scheda, nel quick view,
nel carrello e nei dati per Google.

### Aggiungere un colore a un modello
I colori disponibili sono definiti una volta sola in cima al file, nella sezione
`palette`. Per aggiungerne uno nuovo:

```json
"lavanda": { "name": "Lavanda", "hex": "#D8CCE8" }
```

Poi aggiungi la chiave alla lista `colors` del modello che vuoi:

```json
"colors": ["azzurro", "avorio", "lavanda"]
```

Le sfumature chiara e scura vengono calcolate da sole: basta il colore base.

### Aggiungere un modello nuovo
Copia un blocco esistente dentro `products`, cambia `slug` (deve essere unico,
minuscolo, senza spazi) e i testi. Il campo `shape` sceglie il disegno della borsa
fra: `busta`, `mezzaluna`, `puffy`, `perline`, `onda`, `pochette`, `rafia`, `tonda`.
`hardware` può essere `oro` o `argento`, `category` può essere `sera` o `giorno`.

---

## Mettere le foto vere al posto dei disegni

Le borse in pagina sono **illustrazioni vettoriali**, disegnate su misura per questo
sito: si ricolorano dal vivo quando si clicca una pastiglia colore, pesano pochissimo
e restano nitide su qualsiasi schermo. Non sono fotografie delle borse reali.

Quando avrai le foto vere, il passaggio è semplice:

1. Metti le immagini in `assets/img/products/` — quadrate, almeno 1000 × 1000 px,
   sfondo chiaro e uniforme, la borsa centrata. Rinominale con nomi semplici
   (`aurora-azzurro.jpg`).
2. In `products.json`, dentro il modello, aggiungi la riga `photo`:

```json
{
  "slug": "aurora",
  "photo": "aurora-azzurro.jpg",
  ...
}
```

3. Rigenera con `python3 scripts/build.py`.

La scheda userà la fotografia al posto del disegno. Attenzione: con la foto il
cambio colore dal vivo non funziona più su quel modello (una foto non si ricolora),
quindi conviene passare alle foto quando ne avrai una per ogni combinazione,
oppure tenere i disegni per i modelli con tante varianti.

---

## Modificare i testi

I testi delle sezioni (storia dell'atelier, misure, su misura, recensioni, contatti)
stanno in **`scripts/template.html`**; le domande frequenti in cima a
**`scripts/build.py`**. Anche qui, dopo la modifica: `python3 scripts/build.py`.

---

## Come funziona l'ordine

Non c'è un sistema di pagamento online. Il carrello vive nel browser di chi visita
(`localStorage`), e il pulsante **Completa l'ordine** apre WhatsApp — o l'email, se il
numero non è impostato — con il riepilogo già scritto: modelli, misure, colori,
quantità, subtotale, spedizione e totale. Teresa conferma e manda i dati per il
pagamento.

È la soluzione giusta per una produzione su ordinazione: niente commissioni, niente
adempimenti da negozio online, e ogni ordine passa comunque da una conversazione.
Se un domani servirà il pagamento con carta direttamente sul sito, si può aggiungere
Stripe o Shopify Lite senza rifare il resto.

⚙️ **Il numero e l'email si impostano in cima a `assets/js/main.js`** (variabile `SHOP`).

---

## Accessibilità e prestazioni

- Contrasti conformi a WCAG AA, focus visibile su tutti gli elementi interattivi.
- Modali con `aria-modal`, focus intrappolato e chiusura con `Esc`.
- Tutte le animazioni si disattivano con *Riduci movimento* del sistema operativo.
- Font self-hostati con `font-display: swap`: nessuna chiamata a server esterni.
- Dati strutturati Schema.org (Organization, ItemList di prodotti, FAQPage).
