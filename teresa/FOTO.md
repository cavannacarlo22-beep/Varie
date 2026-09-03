# Le foto delle borse

Sul sito, al momento, ci sono **disegni**, non fotografie. Servono a farti vedere il
sito finito, ma per vendere devono sparire: nessuno compra una borsa da 90 euro senza
vedere com'è fatta davvero, e il punto a uncinetto è proprio la cosa che va vista da
vicino.

La buona notizia è che le borse ce le hai tu, e per foto di questo tipo **il telefono
basta e avanza**. Sotto c'è come farle e come metterle sul sito.

---

## 1. Come scattarle

### La luce (è il 90% del risultato)
Mettiti **davanti a una finestra**, di giorno, con il cielo coperto o senza sole
diretto. La borsa a un metro dalla finestra, tu con le spalle alla finestra.

- ❌ Mai il flash: appiattisce il punto e fa sparire il rilievo.
- ❌ Mai la luce del lampadario di sera: viene tutto giallo.
- ❌ Mai il sole pieno: fa ombre nere e brucia i colori chiari.
- ✅ Un foglio di carta bianca (o un lenzuolo) sul lato in ombra rischiara il fianco
  scuro. Costa zero e cambia tutto.

### Lo sfondo
Un cartoncino bianco o crema, o un tessuto di lino chiaro senza pieghe, curvato
dietro la borsa così non si vede la linea fra il piano e il muro. Va bene anche un
tavolo di legno chiaro. **Sempre lo stesso per tutte le foto**: è quello che fa
sembrare un negozio vero invece di otto foto scollegate.

### L'inquadratura
Tieni il telefono **alla stessa altezza della borsa**, non dall'alto. Lascia un po' di
spazio intorno: le ritagli dopo. Se il tuo telefono ha l'obiettivo "1x" e "2x", usa il
**2x**: deforma meno.

### Le foto che servono per ogni borsa
Sul sito ne serve **una principale**, ma quando scrivi a una cliente le altre fanno
la differenza:

1. **Di fronte, in piedi** — è quella che va sul sito. Borsa centrata, dritta.
2. **Il punto da vicino** — riempi tutta l'inquadratura con il punto. È la foto che
   convince chi sa cos'è l'uncinetto.
3. **Aperta, con la fodera in vista** — la fodera cucita a mano è il tuo argomento
   di vendita più forte, e non si vede da fuori.
4. **In mano o sotto il braccio** — dà la misura reale meglio di qualsiasi centimetro.
5. **Il dettaglio del manico** o della chiusura.

### Un trucco che vale il tempo che costa
Fai **tutte** le foto principali nella stessa mezz'ora, stesso posto, stesso sfondo,
stessa distanza. Otto borse in trenta minuti. Le foto scattate in giorni diversi non
stanno mai bene insieme in una griglia.

---

## 2. Come prepararle per il sito

1. **Ritaglia quadrate** (1:1). Dalla galleria del telefono: *Modifica → Ritaglia →
   1:1*. Il sito le mostra in un riquadro quadrato: se le mandi rettangolari le taglia
   lui, e magari taglia male.
2. **Raddrizza** se la borsa pende, e alza un filo la luminosità se è venuta scura.
   Non esagerare con la saturazione: il colore deve essere quello vero del filato,
   o arrivano i resi.
3. **Rimpicciolisci a 1000 × 1000 pixel** e salvale in JPG. Una foto da telefono pesa
   4–5 MB: sul sito diventerebbe lentissima. Puoi usare
   [squoosh.app](https://squoosh.app) (gratis, si apre nel browser, non carica niente
   online): trascini la foto, a destra scegli *Resize → 1000*, qualità 80, e scarichi.
   L'obiettivo è **sotto i 200 kB** per foto.
4. **Rinomina** con modello e colore, tutto minuscolo, senza spazi né accenti:
   `aurora-azzurro.jpg`, `granny-panna.jpg`, `luna-notte.jpg`.

---

## 3. Come metterle sul sito

Le foto vanno nella cartella **`teresa/assets/img/products/`**.

Poi apri `teresa/scripts/products.json`, trova il modello e compila il campo `photos`,
che adesso è vuoto (`"photos": {}`). Una riga per ogni colore che hai fotografato:

```json
"colors": ["azzurro", "panna", "notte", "cipria"],
"photos": {
  "azzurro": "aurora-azzurro.jpg",
  "notte": "aurora-notte.jpg"
}
```

Infine rigenera il sito:

```bash
python3 scripts/build.py
```

**Non devi fare tutto insieme.** Il sito è costruito apposta per andare avanti a pezzi:

- Se un colore ha la foto, quando la cliente clicca quella pastiglia vede **la foto**.
- Se quel colore non ce l'ha ancora, vede **il disegno**, con il filato del colore giusto.
- Quando avrai tutte le foto, i disegni non si vedranno più da nessuna parte.

Quindi puoi cominciare da una foto sola, per il modello che vendi di più, e aggiungere
le altre man mano.

---

## 4. Quando hai finito

Quando ogni colore di ogni modello ha la sua foto, i disegni diventano peso morto.
Dimmelo e li tolgo dal codice: il sito diventa più leggero e la cartella `scripts/`
si semplifica parecchio.

Nel frattempo, una cosa da tenere a mente: finché in vetrina ci sono i disegni,
**scrivilo alla cliente** se te lo chiede. Sono disegni fedeli al punto e alla forma,
ma non sono fotografie del pezzo che riceverà — e la fiducia, in un negozio piccolo,
è tutto quello che hai.
