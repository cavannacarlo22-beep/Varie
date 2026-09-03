# Teresa Sardanelli — clutch bag all'uncinetto

Sito e-commerce vetrina per borsette lavorate a uncinetto. Statico, senza framework
e senza build in produzione: 8 modelli, 6 punti, 2 misure per modello, 8 colori di
filato, carrello con ordine via WhatsApp o email.

- **Per pubblicarlo online → [DEPLOY.md](DEPLOY.md)**
- **Per sostituire i disegni con le tue foto → [FOTO.md](FOTO.md)** ← comincia da qui

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
│   ├── products.json       ← ⭐ IL CATALOGO: prezzi, misure, colori, FOTO
│   ├── bags.py             ← disegna le borse in SVG (punti a uncinetto)
│   ├── template.html       ← i testi delle pagine
│   └── build.py            ← genera index.html + products.js
├── vercel.json             ← cache e header di sicurezza
├── robots.txt / sitemap.xml
├── DEPLOY.md               ← guida per andare online
└── FOTO.md                 ← come fotografare le borse e metterle sul sito
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
minuscolo, senza spazi) e i testi. Il campo `shape` sceglie la forma
fra `busta`, `mezzaluna`, `puffy`, `granny`, `onda`, `pochette`, `trapezio`, `tonda`;
`stitch` sceglie il punto fra `basso`, `granny`, `ventaglio`, `nocciolina`, `rete`,
`coste`; `hardware` è il manico, fra `legno`, `bambu`, `oro`, `argento`.
`category` può essere `sera` o `giorno`.

---

## Le foto (importante)

Le borse che si vedono adesso sono **disegni vettoriali**, non fotografie. Riproducono
il punto (basso, granny square, ventaglio, nocciolina, rete, coste), la forma e il
colore del filato, e si ricolorano dal vivo quando si clicca una pastiglia — ma restano
disegni. Per vendere davvero servono le foto delle borse vere.

Il sito è costruito per passare alle foto **una alla volta**, senza toccare il codice:

```json
"colors": ["azzurro", "panna", "notte", "cipria"],
"photos": {
  "azzurro": "aurora-azzurro.jpg",
  "notte":   "aurora-notte.jpg"
}
```

Colore con foto → si vede la foto. Colore senza foto → si vede il disegno, nel filato
giusto. Vale per la scheda, per la finestra di dettaglio e per il carrello.

Le istruzioni complete — come scattarle col telefono, come ridimensionarle, dove
metterle — sono in **[FOTO.md](FOTO.md)**.

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
- Schede prodotto apribili anche da touch, senza dipendere dall'hover.
- Modali con `aria-modal`, focus intrappolato e chiusura con `Esc`.
- Tutte le animazioni si disattivano con *Riduci movimento* del sistema operativo.
- Font self-hostati con `font-display: swap`: nessuna chiamata a server esterni.
- Dati strutturati Schema.org (Organization, ItemList di prodotti, FAQPage).
