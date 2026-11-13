# Petalo — il tuo gestionale personale e universitario

Agenda, calcolatrice e fogli di calcolo, liste, archivio documenti, quaderni
universitari con oltre 300 font, libretto esami, timer di studio e benessere.
Funziona su **iPad, iPhone, Mac, Windows e Android**, anche **offline**, e
salva tutto **sul dispositivo** (nessun account, nessun server).

## Cosa c'è dentro

| Sezione | Funzioni |
|---|---|
| **Home** | Saluto e frase motivazionale personalizzabili, data, orologio con numero di settimana, mini calendario, prossimi appuntamenti, attività da fare, ultimi appunti, documenti rapidi, calcolo veloce, promemoria, studio e benessere. I riquadri si nascondono e si riordinano (icona 👁 in alto a destra). |
| **Agenda** | Vista giorno / settimana / mese / elenco, categorie colorate (modificabili), note, luogo, ripetizioni, promemoria con notifiche, esportazione in Calendario Apple / Google (.ics). |
| **Calcoli** | Calcolatrice con percentuali, potenze, radici, parentesi, memoria (MC MR M+ M− MS) e funzioni scientifiche. Tabelle stile Excel con formule (`=SOMMA(A1:A10)`, `=MEDIA`, `=MEDIA.PONDERATA`, `=PERCENTUALE`, `=SE`…), righe e colonne aggiungibili, annulla, copia/incolla, import/export CSV, modelli “media voti” e “budget”. Storico di tutti i calcoli. |
| **Liste** | Liste illimitate per studio, lavoro, casa, spesa, viaggi…; spunta, trascina per riordinare, scadenze, priorità, note, barra di avanzamento, duplica, fissa in alto. |
| **Archivio** | Carica PDF, Word, Excel, immagini e qualsiasi file; cartelle e sottocartelle, rinomina, sposta, preferiti, etichette, ricerca, anteprima PDF/Word/immagini, **annotazioni a mano con Apple Pencil su PDF e immagini** (salvate nel PDF). |
| **Quaderni** | Un quaderno per materia con copertina personalizzabile (colore, motivo, icona o foto) e foglio a righe/quadretti/puntini. Capitoli e sottocapitoli (trascina o sposta), editor completo: titoli, elenchi, checklist, grassetto/corsivo/sottolineato, evidenziatore, colori, allineamento, interlinea, tabelle, immagini, allegati, **disegni e scrittura a mano**, link, apice/pedice, cerca e sostituisci, conteggio parole, salvataggio automatico, esportazione PDF e Word, stampa, modalità concentrazione. |
| **Font** | 302 famiglie Google Fonts verificate, in 10 categorie, con ricerca, anteprima personalizzabile, dimensione e colore, preferiti, confronto e font predefinito dei quaderni. Si caricano solo quando servono e restano disponibili offline. |
| **Studio** *(extra)* | Libretto con media ponderata e aritmetica, CFU, base di laurea su 110 o 100, lodi; conto alla rovescia agli esami (con aggiunta automatica in agenda); timer di concentrazione con statistiche settimanali. |
| **Benessere** *(extra)* | Umore, diario, “tre cose belle”, acqua, sonno, abitudini settimanali, calendario del ciclo con previsione. |
| **Impostazioni** | Nome, 5 temi (Rosa cipria, Lavanda, Cielo, Pesca, Notte rosa), colore principale, cuoricini, notifiche, preferenze dei quaderni, font preferiti, **backup completo** (anche cifrato con password), ripristino, copie automatiche giornaliere, blocco con PIN. |

## Usarla su iPad (importante)

1. Apri l'indirizzo dell'app in **Safari**.
2. Tocca **Condividi → Aggiungi alla schermata Home**.
3. Apri Petalo dall'icona: è a schermo intero, funziona offline, riceve le
   notifiche e Safari non cancella i dati dopo settimane di inutilizzo.

Apple Pencil: nel quaderno tocca ✒️ (*Disegna / scrivi a mano*); nell'archivio
apri un PDF o un'immagine e tocca *Annota*. Con **Solo Pencil** attivo le dita
scorrono la pagina e puoi appoggiare il palmo. Nel testo normale funziona anche
lo **Scribble** di iPadOS (scrivi a mano e diventa testo).

## Dove sono i miei dati

Tutto è salvato nel database del browser (IndexedDB) del dispositivo, con
richiesta di archiviazione permanente. Ogni giorno viene fatta una copia
automatica di appunti, agenda e liste (le ultime 10).

**Il backup completo** (Impostazioni → *Scarica backup completo*) contiene tutto,
documenti compresi: salvalo in iCloud Drive o Google Drive. Serve anche per
spostare i dati da un dispositivo all'altro (*Ripristina*).

> I dispositivi non si sincronizzano da soli: per farlo servirebbe un server
> con account. È un'estensione possibile in una fase successiva.

## Sviluppo

```bash
cd petalo
npm install
npm run dev          # http://localhost:5173
npm test             # 31 test unitari (formule, tabelle, font, backup, agenda, medie, ciclo)
npm run build
npx vite preview --port 4173 &  npm run e2e   # 18 controlli end-to-end nel browser
npm run check-fonts  # riverifica i font su Google Fonts e rigenera l'elenco
```

Tecnologie: React 18 + TypeScript + Vite, Dexie (IndexedDB), TipTap
(ProseMirror) per l'editor, pdf.js e pdf-lib per PDF e annotazioni, mammoth per
l'anteprima Word, JSZip e WebCrypto (AES-256-GCM) per i backup, Workbox per
l'uso offline.

```
src/
  db/          schema del database e impostazioni
  lib/         motore delle formule, tabelle, date, font, backup, PDF, export
  editor/      editor del quaderno ed estensioni (font size, interlinea, disegni, allegati, ricerca)
  components/  interfaccia condivisa (finestre, disegno, selettore font, visualizzatore file)
  pages/       le sezioni dell'app
tests/         test unitari ed end-to-end
```

## Pubblicarla online (Vercel, gratis)

1. Su [vercel.com](https://vercel.com) → **Add New… → Project** → importa il
   repository `varie`.
2. **Root Directory**: `petalo` (Vercel riconosce Vite: build `npm run build`,
   output `dist`, già impostati in `petalo/vercel.json`).
3. **Deploy**. Ottieni un indirizzo tipo `petalo.vercel.app`: aprilo da Safari
   sull'iPad e aggiungilo alla schermata Home.

Essendo un'app che salva tutto sul dispositivo, l'indirizzo pubblico non espone
i tuoi dati: ognuno vede solo i propri.
