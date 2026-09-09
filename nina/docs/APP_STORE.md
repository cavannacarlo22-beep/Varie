# Pubblicare Nina sull'App Store

Questa è la parte che nessuno script può fare al posto tuo: richiede un account
Apple Developer, decisioni tue, e la revisione di Apple.

## Prima di tutto: cosa devi cambiare

Nel repository ci sono valori segnaposto. Vanno sostituiti **prima** del primo
archivio, altrimenti l'app non firma o non si collega a niente.

| Dove | Valore adesso | Cosa metterci |
|---|---|---|
| `ios/project.yml` → `DEVELOPMENT_TEAM` | `""` | il tuo Team ID (10 caratteri, sta in App Store Connect → Membership) |
| `ios/project.yml` → `PRODUCT_BUNDLE_IDENTIFIER` | `it.nina.app` | un identificatore su un dominio che controlli, es. `it.tuodominio.nina` |
| idem, target NinaWidgets | `it.nina.app.widgets` | `<il tuo bundle id>.widgets` |
| `ios/Nina/Nina.entitlements` e `ios/NinaWidgets/NinaWidgets.entitlements` | `group.it.nina.app` | `group.<il tuo bundle id>` — **identico nei due file** |
| `ios/Nina/Core/DatiCondivisi.swift` → `gruppo` | `group.it.nina.app` | lo stesso valore di sopra |
| `ios/Nina/Networking/ClientAPI.swift` → ramo `#else` | `https://api.nina.example` | l'indirizzo HTTPS vero del tuo backend |

L'App Group deve coincidere in **tre** posti: i due `.entitlements` e la
costante Swift. Se uno solo è diverso, i widget mostrano dati vuoti e non c'è
nessun errore a dirtelo.

## Generare il progetto Xcode

Nel repository non c'è un `.xcodeproj`: c'è `ios/project.yml`, che lo descrive
in trenta righe leggibili. Il file `.xcodeproj` è enorme, illeggibile, e genera
un conflitto di merge ogni volta che due persone toccano il progetto.

```bash
brew install xcodegen      # una volta sola
cd ios
xcodegen generate
open Nina.xcodeproj
```

Va rigenerato ogni volta che si aggiungono file o si cambia `project.yml`.

## Capability da attivare

In **App Store Connect → Certificates, Identifiers & Profiles → Identifiers**,
per l'identificatore dell'app:

- **App Groups** — con il gruppo scelto sopra. Serve alla fotografia dei dati
  che l'app scrive per i widget.

E basta. Nina **non** usa: Push Notifications (le notifiche sono tutte locali),
iCloud, Sign in with Apple, HealthKit, posizione, fotocamera, microfono,
rubrica, Apple Pay.

Meno capability significa meno domande in revisione e meno permessi chiesti a
chi installa l'app.

Va creato anche l'identificatore dell'estensione widget
(`<bundle id>.widgets`), con lo stesso App Group.

## Permessi chiesti a chi usa l'app

Uno solo: **le notifiche**. Vengono chieste al momento giusto — quando si attiva
un promemoria — e non all'avvio. Se vengono negate, l'app funziona lo stesso:
semplicemente non avvisa.

Nessun altro permesso viene richiesto, e nell'`Info.plist` non c'è nessuna
`NS…UsageDescription` perché non serve.

## Privacy

### La scheda "Privacy Nutrition Label"

In App Store Connect, alla voce **App Privacy**, dichiara:

| Categoria | Raccolti? | Collegati all'identità? | Usati per tracciare? |
|---|---|---|---|
| Contatti (nome, email) | Sì | Sì | No |
| Contenuti dell'utente (attività, diario, note) | Sì | Sì | No |
| Identificatori | Sì (id account, id dispositivo) | Sì | No |
| Dati d'uso | No | — | — |
| Diagnostica | No | — | — |
| Posizione, salute, finanza, contatti in rubrica, foto | No | — | — |

**Tracking: no.** Nina non ha SDK di analytics, non ha pubblicità, non manda
niente a terze parti. Se un giorno aggiungi un servizio di analytics, questa
tabella va rifatta — e la risposta su "usati per tracciare" cambia.

I dati sono raccolti perché **sono l'app**: senza le attività non c'è la lista
delle cose da fare. Sono conservati sul database dell'account, non sono venduti,
non sono condivisi.

### Il file di privacy manifest

Da maggio 2024 Apple richiede `PrivacyInfo.xcprivacy` per le app che usano certe
API. Nina usa `UserDefaults`, che è nell'elenco delle "required reason API".
Crea `ios/Nina/PrivacyInfo.xcprivacy` con:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array/>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array><string>CA92.1</string></array>
        </dict>
    </array>
</dict>
</plist>
```

`CA92.1` è il codice per "accedo a UserDefaults solo per dati della mia app".

### L'informativa

Serve un URL pubblico raggiungibile: App Store Connect lo richiede e la
revisione lo controlla. Deve dire, in italiano semplice: quali dati raccogli
(quelli della tabella sopra), dove stanno (il tuo database su Neon, in Europa se
hai scelto Francoforte), che non sono condivisi con nessuno, che il diario non è
leggibile da chi gestisce l'app, e come si cancella tutto (dalle impostazioni
dell'app, voce *Elimina il mio account*).

## Icona

`ios/Nina/Assets.xcassets/AppIcon.appiconset/` contiene `icona-1024.png`. Xcode
15+ genera le altre misure da quella.

Requisiti Apple: 1024×1024, PNG, **nessuna trasparenza**, nessun angolo
arrotondato disegnato a mano (li mette iOS), niente testo piccolo.

## Screenshot

Servono per due misure di iPhone e una di iPad:

| Dispositivo | Risoluzione | Quanti |
|---|---|---|
| iPhone 6.9" (16 Pro Max) | 1320 × 2868 | 3–10 |
| iPhone 6.5" (11 Pro Max) | 1242 × 2688 | 3–10 |
| iPad Pro 13" | 2064 × 2752 | 3–10 |

Si catturano dal simulatore con `⌘S`. Le cinque schermate che raccontano meglio
l'app:

1. **Home** con qualche cosa da fare e il saluto ("Buongiorno, Giulia 🌸")
2. **Pensiero del giorno**, la schermata con le virgolette grandi
3. **To Do** con qualcosa di spuntato
4. **Abitudini**, con una serie in corso
5. **Me**, per far vedere che c'è di più

Riempi i dati di esempio con contenuti veri e credibili prima di catturare: gli
screenshot con "Test 1", "Test 2" si riconoscono a un chilometro.

> Negli screenshot non deve comparire **niente** di un diario vero. Usa un
> account di prova.

## Metadati

- **Nome**: `Nina` (30 caratteri max). Se è già preso, `Nina — la tua amica`.
- **Sottotitolo** (30 caratteri): `La tua piccola migliore amica`
- **Categoria primaria**: Produttività. **Secondaria**: Stile di vita.
- **Età**: 4+ (nessun contenuto sensibile, nessun accesso web illimitato).
- **Parole chiave** (100 caratteri, separate da virgola, senza spazi):
  `to do,agenda,abitudini,diario,mood,promemoria,organizzazione,wishlist,self care`
- **Lingua principale**: Italiano.

Bozza di descrizione:

> Nina è come un'amica che ti aiuta a organizzare le giornate — senza farti
> sentire in colpa quando qualcosa non va come previsto.
>
> Le cose da fare, le abitudini che stai costruendo, come ti senti oggi, il
> diario, la wishlist. Tutto in un posto, tutto sincronizzato fra iPhone e iPad,
> tutto disponibile anche senza connessione.
>
> • **To Do e calendario** — con ripetizioni, priorità e promemoria
> • **Abitudini** — con le serie di giorni e la striscia della settimana
> • **Mood tracker** — un tocco al giorno, e col tempo si vede l'andamento
> • **Diario privato** — nessuno lo legge, nemmeno chi gestisce l'app
> • **Wishlist** — le cose che ti piacerebbero, anche solo per guardarle
> • **Widget** — le cose di oggi sulla schermata Home
> • **Siri** — "Cosa devo fare oggi su Nina?"
>
> Il diario è tuo e solo tuo. E ogni tanto Nina ti ricorderà anche di respirare.

## Note per la revisione

Nel campo **Notes** di App Store Connect, scrivi:

> L'app richiede un account. Credenziali di prova:
> email `demo@esempio.it`, password `<quella che hai impostato>`.
>
> L'account demo ha già dati di esempio.
> Le notifiche sono tutte locali: nessun server di push.
> Nessun contenuto generato da altri utenti, nessuna funzione social.

**Crea davvero l'account di prova** e lascialo funzionante: un revisore che non
riesce ad accedere respinge l'app senza aprirla.

## Prima di archiviare

```
[ ] DEVELOPMENT_TEAM impostato
[ ] Bundle id cambiati (app e widget)
[ ] App Group identico nei tre posti
[ ] ClientAPI punta al backend HTTPS vero
[ ] MARKETING_VERSION e CURRENT_PROJECT_VERSION aggiornati
[ ] xcodegen generate rieseguito
[ ] Build in Release su un dispositivo vero, non solo simulatore
[ ] Test unitari e di interfaccia verdi (⌘U)
[ ] Widget provato su iPhone e su iPad
[ ] Provato in Dark Mode
[ ] Provato con il testo grande (Impostazioni → Schermo → Dimensioni testo)
[ ] Provato in aereo: si crea, si modifica, e al ritorno della rete si allinea
[ ] PrivacyInfo.xcprivacy aggiunto
[ ] URL dell'informativa raggiungibile
[ ] Account demo creato e funzionante
```

## Archiviare e caricare

1. In Xcode: schema **Nina**, destinazione **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. Nell'Organizer: **Distribute App → App Store Connect → Upload**.
4. Attendi l'elaborazione (10–30 minuti), poi compila i metadati e invia.

Prima revisione: di solito 24–48 ore. I motivi di rigetto più comuni sono
banali — account demo che non funziona, screenshot che non corrispondono
all'app, informativa irraggiungibile. Tutti e tre sono nella lista qui sopra.

## Dopo il primo rilascio

- `CURRENT_PROJECT_VERSION` va incrementato **a ogni caricamento**, anche se
  `MARKETING_VERSION` resta uguale.
- L'indirizzo del backend è compilato dentro l'app: cambiarlo richiede un nuovo
  rilascio e una nuova revisione. Scegli il dominio una volta e tienilo, anche
  se cambi hosting.
- Prima di cambiare l'API in modo incompatibile, ricorda che sui telefoni ci
  sono ancora le versioni vecchie dell'app. Le rotte esistenti vanno mantenute
  finché non sei sicuro che nessuno le usi più.
