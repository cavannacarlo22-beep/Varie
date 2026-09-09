# Come si sincronizzano iPhone e iPad

Il problema, detto semplice: la stessa persona ha due dispositivi, li usa
entrambi, a volte senza rete, e non deve perdere niente. Nemmeno quando
modifica la stessa cosa su tutti e due.

## L'idea in una frase

Ogni account ha **un contatore che sale di uno a ogni modifica**. Un
dispositivo che ha visto fino al numero N chiede "cosa è cambiato dopo N?" e
riceve esattamente quello.

Non ci sono timestamp da confrontare fra orologi diversi, non c'è "l'ultimo
aggiornamento delle 14:32" da interpretare. C'è un numero che sale.

## Il contatore

Nel database c'è una tabella `sync_sequence` con una riga per utente. Una
funzione la incrementa in modo atomico:

```sql
CREATE OR REPLACE FUNCTION nina_next_sync_seq(p_user_id UUID)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_next BIGINT;
BEGIN
    INSERT INTO sync_sequence AS s (user_id, current) VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET current = s.current + 1
    RETURNING s.current INTO v_next;
    RETURN v_next;
END; $$;
```

Un trigger `BEFORE INSERT OR UPDATE` su **ogni tabella sincronizzabile** chiama
quella funzione e scrive il risultato nella colonna `sync_seq` della riga, oltre
a incrementare `version`.

Due conseguenze importanti:

1. **Il contatore è per utente**, quindi le modifiche di una persona non fanno
   avanzare il cursore di un'altra: un account tranquillo non scarica niente
   solo perché qualcun altro sta lavorando.
2. **È condiviso fra tutte le tabelle** dello stesso utente. Mettere insieme le
   righe di tabelle diverse e ordinarle per `sync_seq` ricostruisce
   *esattamente* l'ordine in cui le modifiche sono avvenute. Senza questo, un
   completamento di abitudine potrebbe arrivare prima dell'abitudine.

Nessuna rotta scrive `sync_seq` a mano. Lo fa il trigger, sempre, anche per le
scritture fatte da uno script: è per questo che è un trigger e non una riga di
codice nel backend.

## Le tre rotte

| Rotta | Cosa fa |
|---|---|
| `GET /sync/cursor` | dice a che numero è arrivato il contatore adesso |
| `GET /sync/changes?since=N&limit=200` | tutte le righe con `sync_seq > N`, ordinate, di tutte le entità |
| `POST /sync/push` | invia le modifiche fatte in locale e riceve un esito per ciascuna |

`GET /sync/changes?since=0` restituisce l'intero contenuto dell'account: è il
primo avvio su un dispositivo nuovo. Se la risposta ha `hasMore: true`, si
richiama con il nuovo `cursor` finché non diventa falso.

## Il giro completo, lato app

Sempre nello stesso ordine (`ios/Nina/Sync/MotoreSync.swift`):

1. **push** — manda le modifiche locali non ancora inviate;
2. **pull** — chiede tutto ciò che è cambiato dopo il cursore;
3. salva il nuovo cursore.

L'ordine conta. Si spinge *prima* di tirare, così se il server rifiuta una
nostra modifica — perché ne aveva una più recente — la pull successiva ci
consegna subito la versione autorevole, e la copia locale si allinea nello
stesso giro invece che al successivo.

## La coda di uscita

Non c'è una tabella "modifiche in attesa". Ogni oggetto locale ha un campo
`daInviare: Bool`: **quel flag è la coda**.

Ogni scrittura locale fa tre cose (`ios/Nina/Persistence/Deposito.swift`):

1. modifica l'oggetto — la schermata si aggiorna subito, senza aspettare la rete;
2. aggiorna `clientUpdatedAt`, l'istante che deciderà eventuali conflitti;
3. alza `daInviare`.

L'oggetto stesso sa di dover essere inviato. Non c'è niente da tenere allineato
fra due strutture, e quindi non c'è niente che possa disallinearsi.

Le scritture ravvicinate vengono accorpate: spuntare cinque cose di fila fa
partire **una** richiesta, non cinque (`sincronizzaFraPoco`).

## Chi vince, quando due dispositivi modificano la stessa cosa

La decisione è **una sola espressione SQL**, valutata dentro la `WHERE` di una
`UPDATE`. Decide il database, in modo atomico: non esiste una finestra fra
"leggo la versione attuale" e "scrivo la mia".

| Situazione | Esito |
|---|---|
| La riga non esiste ancora per questo utente | inserita — `applied` |
| La modifica in arrivo è **più recente** | applicata — `applied` |
| La modifica in arrivo è **più vecchia** | rifiutata, con lo stato autorevole in risposta — `rejected` |
| Stesso identico istante | vince il `device_id` alfabeticamente maggiore |
| La riga sul server è cancellata | rifiutata: la cancellazione vince sempre — `rejected` |
| Nessun campo riconosciuto nel payload | non tocca niente — `ignored` |
| L'id appartiene a un altro account | rifiutata, e la risposta **non contiene la riga** — `rejected` con `server: null` |

Il pareggio esatto sembra un caso di scuola e invece capita: due dispositivi
sincronizzati via NTP, la stessa azione automatica, lo stesso millisecondo. La
regola del `device_id` esiste perché il criterio deve essere **deterministico**:
due dispositivi che risolvono lo stesso conflitto senza parlarsi devono arrivare
alla stessa conclusione.

**Un rifiuto non è mai silenzioso.** La risposta contiene lo stato autorevole,
il dispositivo lo adotta, e il conteggio finisce in `conflittiRisolti`, visibile
nelle impostazioni. E soprattutto: dopo un rifiuto la modifica **non resta in
coda**. Ritentare all'infinito qualcosa che il server ha già rifiutato è il modo
migliore per bloccare la coda per sempre.

## Le cancellazioni

Cancellare non elimina la riga: scrive `deleted_at`.

Se si cancellasse davvero, l'altro dispositivo non riceverebbe niente — una riga
sparita non compare fra "le cose cambiate" — e continuerebbe a mostrare
l'attività per sempre. Con la cancellazione logica la riga cambia, il trigger
alza il contatore, e la cancellazione viaggia come qualsiasi altra modifica.

Le righe cancellate restano nel database. È il prezzo, ed è basso: sono poche e
piccole. L'unica cancellazione vera è quella dell'account, che è una `DELETE`
completa.

## Il tempo reale

`GET /sync/stream` è un flusso **Server-Sent Events**. Quando qualcosa cambia
su un dispositivo, gli altri ricevono:

```
event: changed
data: {"cursor":1043}
```

L'evento contiene **solo il cursore**, mai i dati. Chi lo riceve chiama
`GET /sync/changes` e legge da lì.

Sembra un giro in più e invece è il punto: se i dati viaggiassero nell'evento,
un evento perso significherebbe un dato perso. Così un evento perso significa
solo un aggiornamento in ritardo — al massimo fino alla prossima apertura
dell'app, che sincronizza comunque.

Perché SSE e non WebSocket: il traffico è in una direzione sola (il server
avvisa), SSE riparte da solo dopo una disconnessione, e passa attraverso
qualsiasi proxy HTTP. Un WebSocket sarebbe più potente e non servirebbe a
niente di più.

Il flusso si ferma quando l'app va in background e riparte quando torna in
primo piano, con una sincronizzazione completa: mentre l'app è sospesa gli
eventi non arrivano, e va bene così.

## Offline

Tutto continua a funzionare. Le schermate leggono e scrivono **solo** il
magazzino locale: nessuna vista chiama il backend direttamente. La
sincronizzazione è un dettaglio che avviene dopo.

- Si crea, modifica, cancella normalmente.
- Le modifiche si accumulano con `daInviare = true`.
- Quando torna la rete, il primo giro le manda tutte, a lotti da 100.
- Gli elementi creati offline hanno già il loro UUID, generato dal dispositivo:
  arrivano al server e vengono inseriti con quell'id. Nessun rischio di
  duplicato quando la stessa riga viene inviata due volte, perché l'id è già
  deciso.
- Se durante l'assenza di rete la stessa cosa è cambiata anche altrove, si
  applica la regola dei conflitti qui sopra.

L'app dice che è offline con una frase, non con un errore rosso: *"Non c'è rete,
ma tranquilla: salvo tutto qui e sincronizzo dopo 💗"*.

## Le date di calendario sono stringhe

Il giorno di un'attività è `"2026-09-09"`, non una `Date`.

Una `Date` è un istante, e un istante ha un fuso orario. Il 9 settembre non ce
l'ha. Salvarlo come `Date` significa che chi apre l'app in aereo, o dopo il
cambio dell'ora, vede le attività spostate di un giorno. È un bug classico ed è
il motivo per cui il database usa il tipo `DATE` e l'app usa una stringa.

Le conversioni stanno tutte in `ios/Nina/Core/CalendarioNina.swift`: un posto
solo da controllare, e un posto solo da testare
(`ios/NinaTests/CalendarioNinaTests.swift`).

## Dove guardare nel codice

| Cosa | File |
|---|---|
| Contatore, trigger, funzione | `backend/database/migrations/003_constraints.sql` |
| Regola dei conflitti | `backend/src/repositories/syncRepository.ts` |
| Le tre rotte + SSE | `backend/src/routes/sync.ts` |
| Chi è connesso adesso | `backend/src/realtime/hub.ts` |
| Il giro completo lato app | `ios/Nina/Sync/MotoreSync.swift` |
| Lettura del flusso SSE | `ios/Nina/Sync/FlussoEventi.swift` |
| Conversione modelli ↔ JSON | `ios/Nina/Sync/Traduttore.swift` |
| Coda di uscita e magazzino | `ios/Nina/Persistence/Deposito.swift` |
| Test | `backend/tests/integration/sync.test.ts`, `ios/NinaTests/TraduttoreTests.swift` |
