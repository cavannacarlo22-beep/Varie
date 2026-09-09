// FILE: backend/src/services/ninaBrain.ts
//
// Il cervello di Nina: la conversazione che funziona senza nessun servizio a
// pagamento, senza chiave API e senza internet sul server.
//
// Cosa è e cosa non è
// -------------------
// Non è un modello linguistico. Non inventa frasi nuove e non capisce
// davvero. È un motore a intenti: riconosce di cosa si sta parlando, sceglie
// una risposta scritta a mano fra quelle giuste per quel tema, e tiene conto
// di cosa ha già detto per non ripetersi.
//
// Perché allora funziona
// ----------------------
// Perché in questa app la conversazione non deve risolvere problemi: deve
// esserci. Le risposte più utili di un'amica sono corte, riconoscono il tema e
// restano lì. Sono anche le più facili da scrivere bene in anticipo.
//
// Ogni tema qui sotto ha più risposte, e la scelta dipende dal messaggio e da
// quante volte si è già parlato di quell'argomento: al secondo messaggio sullo
// stesso tema Nina approfondisce invece di ripartire da capo.
//
// Se in futuro si configura AI_API_KEY, il modello prende il posto di questo
// motore e questo resta come rete di sicurezza (vedi aiService.ts).

export interface BrainContext {
  /** Nome con cui chiamare la persona. */
  userName: string;
  /** Ora locale (0-23), per distinguere il buongiorno dalla notte fonda. */
  hour: number;
  /** Quante volte di fila si è già parlato di questo tema. */
  repeatCount: number;
}

export interface Topic {
  id: string;
  /** Quanto è specifico: a parità di corrispondenza vince il più alto. */
  weight: number;
  patterns: RegExp[];
  /** Prima risposta su questo tema. */
  replies: string[];
  /** Risposte per quando si continua a parlarne. */
  followUps?: string[];
}

// ---------------------------------------------------------------------------
// I temi
// ---------------------------------------------------------------------------

export const TOPICS: Topic[] = [
  // --- Come sta ------------------------------------------------------------
  {
    id: 'stanchezza',
    weight: 6,
    patterns: [
      /\bstanc/i,
      /\besaust/i,
      /\bdistrutt[ao]\b/i,
      /\bsfinit/i,
      /\bnon\s+ne\s+posso\s+pi[uù]\b/i,
      /\bsono\s+a\s+pezzi\b/i,
      /\bnon\s+ho\s+energie\b/i,
    ],
    replies: [
      'Stanca vera o stanca "ho fatto troppe cose"? Sono due riposi diversi 😌',
      'Ok. Allora oggi il programma è il minimo indispensabile, e va benissimo così.',
      'Sei stanca perché hai fatto tanto, non perché non basti. Non è la stessa cosa.',
      'Hai il permesso di fermarti. Te lo do io, se serve che qualcuno te lo dica.',
      'Quanto hai dormito? Chiedo per un\'amica. L\'amica sono io.',
    ],
    followUps: [
      'Allora è di quelle stanchezze che non passano dormendo. Quelle chiedono di togliere roba, non di aggiungerne.',
      'Senti, se sei stanca da giorni non è pigrizia: è il corpo che ti sta parlando abbastanza chiaramente.',
      'Facciamo una cosa: cosa puoi cancellare dalla giornata di domani? Una cosa sola.',
    ],
  },
  {
    id: 'ansia',
    weight: 7,
    patterns: [
      /\bansi/i,
      /\bagitat/i,
      /\bpanico\b/i,
      /\bin\s+pensiero\b/i,
      /\bpreoccupat[ao]\b/i,
      /\bnon\s+riesco\s+a\s+(stare\s+ferma|calmarmi|rilassarmi)\b/i,
      /\bbatticuore\b/i,
    ],
    replies: [
      'Ok. Una cosa alla volta. Qual è la prima, quella piccola?',
      'L\'ansia fa sembrare tutto contemporaneo. Non lo è. Cosa c\'è oggi, solo oggi?',
      'Respira un attimo prima di rispondermi, poi dimmi qual è la parte che ti agita di più.',
      'La maggior parte delle cose che ti agitano adesso non succederanno. Lo so che non serve a molto saperlo.',
      'Vuoi che ne parliamo o vuoi che ti distragga? Faccio entrambe.',
    ],
    followUps: [
      'Prova a scriverla, la cosa che ti agita. Sulla carta è sempre più piccola che in testa.',
      'Se dovesse andare male davvero: cosa succederebbe? Di solito la risposta è meno catastrofica di quello che sembra.',
      'Quattro secondi dentro, quattro fuori, dieci volte. Non è magia, ma al corpo serve.',
    ],
  },
  {
    id: 'tristezza',
    weight: 7,
    patterns: [
      /\btrist/i,
      /\bgi[uù]\s+di\s+(morale|corda)\b/i,
      /\bpiang(o|ere|endo)\b/i,
      /\bsto\s+(male|di\s+merda|da\s+schifo)\b/i,
      /\bgiornata\s+(di\s+merda|orribile|pessima)\b/i,
      /\bmi\s+sento\s+(un\s+peso|vuota|svuotata)\b/i,
      /\bdepress[ao]\b/i,
    ],
    replies: [
      'Mi dispiace. Non provo a sistemarlo, resto qui.',
      'Va bene stare male. Non devi trasformarlo in qualcosa di utile.',
      'Non ti dico niente di intelligente, oggi non serve. Dimmi il resto, se ti va.',
      'Ti ascolto. Anche se è confuso, anche se non ha senso.',
      'Certe giornate vanno solo attraversate. Questa è una di quelle.',
    ],
    followUps: [
      'Ti va di dirmi da quanto dura? Non per fare la seria, solo per capire.',
      'Se è da un po\' che è così, parlarne con qualcuno di preparato non è un fallimento. È solo una cosa che aiuta.',
      'Intanto: hai mangiato? Hai bevuto? Le cose stupide contano più di quanto sembri.',
    ],
  },
  {
    id: 'felicita',
    weight: 6,
    patterns: [
      /\bfelic/i,
      /\bcontent[ao]/i,
      /\bche\s+bell[ao]\b/i,
      /\bsto\s+(benissimo|una\s+favola|da\s+dio)\b/i,
      /\bce\s+l.?ho\s+fatta\b/i,
      /\b(evviva|urr[aà]|yeee|yesss)\b/i,
      /\bgiornata\s+(bellissima|fantastica|perfetta)\b/i,
    ],
    replies: [
      'Che bello 😄 Raccontami tutto.',
      'Aspetta aspetta, questa me la devi spiegare per bene.',
      'Eccola! Te lo meritavi, davvero.',
      'Mi hai messo di buonumore anche a me, e sono un\'app.',
      'Segnatela questa giornata. Servirà da rileggere in una storta.',
    ],
    followUps: [
      'Continua che mi piace 😌',
      'Ok e adesso come festeggi? Perché va festeggiato.',
      'Vedi che le cose belle succedono anche a te.',
    ],
  },
  {
    id: 'noia',
    weight: 4,
    patterns: [/\bmi\s+annoio\b/i, /\bche\s+noia\b/i, /\bnon\s+so\s+cosa\s+fare\b/i, /\bannoiat[ao]\b/i],
    replies: [
      'Noia buona o noia brutta? La prima è riposo travestito.',
      'Fai una di queste: esci dieci minuti, riordina una superficie, chiama qualcuno. Scegli tu.',
      'La noia è il momento in cui vengono le idee. Lasciala stare un po\' prima di riempirla.',
      'Vuoi che ti tiri fuori un\'idea a caso dalla sezione self care? È fatta apposta.',
    ],
  },

  // --- Studio e lavoro ------------------------------------------------------
  {
    id: 'esami',
    weight: 8,
    patterns: [
      /\besam[ei]\b/i,
      /\buniversit[aà]\b/i,
      /\bstudi(are|o)\b/i,
      /\btesi\b/i,
      /\blaurea\b/i,
      /\binterrogazione\b/i,
      /\bappello\b/i,
      /\bsessione\b/i,
    ],
    replies: [
      'In bocca al lupo. Sei più preparata di quanto ti sembra adesso, funziona sempre così.',
      'La sera prima sembra sempre un disastro. Poi si fa e basta.',
      'Facciamo così: stasera il ripasso essenziale, poi dormi. Domani ci pensa la te di domani.',
      'Studiare tutto non è possibile. Studiare le cose giuste sì. Quali sono?',
      'Quanto manca? Perché la strategia cambia parecchio tra "due giorni" e "due settimane".',
    ],
    followUps: [
      'Venticinque minuti di studio e cinque di pausa. Banale, ma funziona meglio di sei ore fisse.',
      'Se ti blocchi su un argomento, saltalo e torna dopo. Restare fermi lì è il modo più veloce per perdere la giornata.',
      'Ricordati che il voto passa e la laurea resta. Nessuno ti chiederà mai il voto di questo esame.',
    ],
  },
  {
    id: 'lavoro',
    weight: 7,
    patterns: [
      /\blavoro\b/i,
      /\bufficio\b/i,
      /\bcolleg(a|he|hi)\b/i,
      /\bcapo\b/i,
      /\briunione\b/i,
      /\bstage\b/i,
      /\bturno\b/i,
      /\bstraordinari\b/i,
      /\bmi\s+licenzi/i,
    ],
    replies: [
      'Giornata pesante o proprio lavoro pesante? Sono due problemi diversi.',
      'Uff. Racconta, che a volte dirlo basta.',
      'Il lavoro può prendersi le ore. Non deve prendersi anche la serata.',
      'Hai staccato davvero quando sei uscita, o te lo sei portato dietro?',
    ],
    followUps: [
      'Se è sempre così, non sei tu che non reggi: è il posto che chiede troppo.',
      'Una cosa alla volta anche qui. Cosa devi fare domani, di preciso?',
      'Ti do un consiglio non richiesto: scrivi quello che hai fatto oggi. Nelle giornate storte serve vederlo.',
    ],
  },
  {
    id: 'colloquio',
    weight: 8,
    patterns: [/\bcolloquio\b/i, /\bcandidatur/i, /\bcurriculum\b/i, /\bcv\b/i, /\bassunt/i, /\bselezione\b/i],
    replies: [
      'In bocca al lupo davvero. Ricordati che stai valutando anche tu loro, non solo il contrario.',
      'Sii te stessa ma la versione riposata. Serve solo quello.',
      'Preparati una domanda da fare a loro: cambia completamente il tono della conversazione.',
      'Se va male non è un giudizio su di te. È un incastro che non c\'era.',
    ],
    followUps: [
      'Come ti sono sembrati? Il posto ti piaceva davvero o ti serviva e basta?',
      'Ora non pensarci. Non hai più niente in mano, quindi rimuginare non cambia niente.',
    ],
  },
  {
    id: 'soldi',
    weight: 6,
    patterns: [/\bsold[i]\b/i, /\bstipendio\b/i, /\bspes[ae]\b/i, /\baffitto\b/i, /\bbollett/i, /\bal\s+verde\b/i, /\bnon\s+arrivo\s+a\s+fine\s+mese\b/i],
    replies: [
      'I soldi stressano più di quanto si ammetta. Non sei tu che gestisci male.',
      'Vuoi metterci ordine? A volte scrivere le uscite fa già passare metà dell\'ansia.',
      'Fine mese difficile o proprio periodo difficile?',
      'Va bene rinunciare a qualcosa per un po\'. Non è una sconfitta, è una scelta.',
    ],
  },
  {
    id: 'procrastinazione',
    weight: 6,
    patterns: [
      /\brimand(o|are|ato)\b/i,
      /\bprocrastin/i,
      /\bnon\s+riesco\s+a\s+(iniziare|mettermi)\b/i,
      /\bnon\s+ho\s+voglia\b/i,
      /\bdovrei\s+ma\b/i,
      /\bpigr[ao]\b/i,
    ],
    replies: [
      'Fallo per due minuti. Solo due. Poi puoi smettere davvero, promesso.',
      'Di solito la cosa che rimandi da tre settimane dura dieci minuti. È quasi sempre così.',
      'Non aspettare la motivazione, arriva dopo aver iniziato. È scomodo ma è così.',
      'Qual è la prima mossa più piccola possibile? Non il compito: la prima mossa.',
    ],
    followUps: [
      'Se non parte, forse il pezzo è troppo grosso. Spezzalo in una cosa ridicolmente piccola.',
      'A volte non è pigrizia: è che la cosa ti pesa per un motivo. Qual è?',
    ],
  },
  {
    id: 'futuro',
    weight: 6,
    patterns: [
      /\bnon\s+so\s+cosa\s+(fare|voglio)\b/i,
      /\bfuturo\b/i,
      /\bsono\s+indietro\b/i,
      /\btutti\s+(gli\s+altri|le\s+altre)\b/i,
      /\balla\s+mia\s+et[aà]\b/i,
      /\bnon\s+ho\s+combinato\s+niente\b/i,
      /\bcrisi\s+esistenziale\b/i,
    ],
    replies: [
      'Non sei in ritardo. Non esiste un orario, per quanto sembri il contrario.',
      'Le vite degli altri le vedi montate. La tua la vivi in diretta, coi tempi morti.',
      'A questa età quasi nessuno sa cosa sta facendo. Chi sembra saperlo, spesso recita.',
      'Non devi decidere tutta la vita adesso. Devi decidere il prossimo passo.',
    ],
    followUps: [
      'Cosa faresti se non dovessi renderne conto a nessuno? Anche solo per dirlo.',
      'Facciamo il gioco al contrario: cosa non vuoi, di sicuro? Da lì si restringe.',
    ],
  },

  // --- Relazioni ------------------------------------------------------------
  {
    id: 'litigio',
    weight: 10,
    patterns: [/\blitigat/i, /\bdiscussione\b/i, /\barrabbiat[ao]\b/i, /\bincazzat[ao]\b/i, /\boffes[ao]\b/i, /\bnon\s+mi\s+parla\b/i],
    replies: [
      'Uff. Hai ragione tu o hai ragione tu e basta? 😅',
      'Certe cose bruciano anche quando hai ragione. Soprattutto quando hai ragione.',
      'Vuoi sfogarti o vuoi che ti dica cosa penso? Vanno bene entrambe.',
      'Racconta. Prometto di stare dalla tua parte almeno per i primi cinque minuti.',
    ],
    followUps: [
      'Secondo te ci tiene, al di là di come si è comportata?',
      'A volte conviene aspettare un giorno prima di rispondere. Non sempre, ma spesso.',
      'Vale la pena chiarire o è una di quelle cose che passano da sole?',
    ],
  },
  {
    id: 'amicizia',
    weight: 6,
    patterns: [/\bamic[ah]e?\b/i, /\bmigliore\s+amica\b/i, /\bci\s+siamo\s+allontanate\b/i, /\bnon\s+mi\s+cerca\b/i, /\besclusa\b/i],
    replies: [
      'Le amicizie cambiano e non è sempre colpa di qualcuno. A volte è solo la vita che si sposta.',
      'Ti manca lei o ti manca com\'era prima? Non è la stessa cosa.',
      'Va bene sentirsi escluse. Non ti rende drammatica, ti rende umana.',
      'Scriverle costa poco. Se non risponde almeno lo sai.',
    ],
    followUps: [
      'Le amicizie che valgono reggono anche i silenzi lunghi. Quelle che non li reggono forse dicevano già qualcosa.',
      'Sei tu che ti allontani o è lei? Chiedo perché a volte ci si accorge tardi di essere state noi.',
    ],
  },
  {
    id: 'amore',
    weight: 7,
    patterns: [
      /\binnamorat[ao]\b/i,
      /\bmi\s+piace\s+(un[oa]|questo|questa|lui|lei)\b/i,
      /\bcotta\b/i,
      /\bragazz[oa]\b/i,
      /\bfidanzat[ao]\b/i,
      /\bappuntamento\b/i,
      /\buscire\s+con\b/i,
      /\bmi\s+ha\s+scritto\b/i,
    ],
    replies: [
      'Ok racconta tutto, dall\'inizio, senza saltare pezzi 👀',
      'Bene bene bene. Da quanto va avanti questa cosa?',
      'Mi piace questa energia. Dimmi.',
      'E tu che pensi? Perché conta più quello di come si comporta lui.',
    ],
    followUps: [
      'Ti fa stare bene o ti fa stare in ansia? Perché non è la stessa cosa, anche se all\'inizio si confondono.',
      'Non analizzare troppo i messaggi. Lo so che è impossibile, ma provaci.',
    ],
  },
  {
    id: 'rottura',
    weight: 10,
    patterns: [
      /\bex\b/i,
      /\blasciat[ao]\b/i,
      /\brottura\b/i,
      /\bci\s+siamo\s+lasciat/i,
      /\bmi\s+ha\s+lasciat/i,
      /\bcuore\s+spezzato\b/i,
      /\bnon\s+mi\s+risponde\s+pi[uù]\b/i,
      /\bghost/i,
    ],
    replies: [
      'Mi dispiace davvero. Quanto tempo è passato?',
      'Non c\'è un modo giusto di reagire. Fai come viene.',
      'Va bene stare male anche se "era la cosa giusta". Le due cose convivono.',
      'Non scrivergli stasera. Domani magari sì, ma stasera no 😌',
    ],
    followUps: [
      'Passa. Lo so che detto così vale zero, ma passa davvero.',
      'Riprenditi le tue cose: le abitudini, i posti, le canzoni. Una alla volta.',
      'Il primo mese è il peggiore. Poi cominciano le giornate in cui non ci pensi per ore.',
    ],
  },
  {
    id: 'famiglia',
    weight: 6,
    patterns: [/\b(mamma|madre|pap[aà]|padre|genitori|sorella|fratello|nonna|nonno)\b/i, /\bin\s+famiglia\b/i, /\bcasa\s+dei\s+miei\b/i],
    replies: [
      'La famiglia è complicata anche quando vuoi bene a tutti.',
      'Racconta. Con la famiglia le cose piccole pesano il doppio.',
      'Va bene volergli bene e non sopportarli contemporaneamente. È abbastanza normale.',
      'Ti hanno detto qualcosa o è più un\'atmosfera?',
    ],
    followUps: [
      'Con i genitori certe conversazioni non si vincono. A volte si può solo chiuderle prima.',
      'Puoi volere bene e mettere comunque dei limiti. Non sono in contraddizione.',
    ],
  },
  {
    id: 'solitudine',
    weight: 7,
    patterns: [/\bsol[ao]\b/i, /\bsolitudine\b/i, /\bnessuno\s+mi\b/i, /\bmi\s+sento\s+esclus/i, /\bnon\s+ho\s+nessuno\b/i],
    replies: [
      'Sentirsi sole in mezzo alla gente è la versione peggiore. Mi dispiace.',
      'Ci sono io, per quello che vale. E un po\' vale.',
      'Non è sempre questione di quante persone hai intorno. Spesso è questione di una sola.',
      'Ti va di scrivere a qualcuno? Anche solo un "ciao, come stai". Funziona più spesso di quanto pensi.',
    ],
    followUps: [
      'Va bene anche stare da sole per un periodo. Diverso è sentirsi sole. La seconda pesa.',
      'Fai una cosa fuori casa domani, anche minuscola. Non risolve, ma sposta qualcosa.',
    ],
  },

  // --- Corpo e benessere ----------------------------------------------------
  {
    id: 'sonno',
    weight: 6,
    patterns: [/\bnon\s+riesco\s+a\s+dormire\b/i, /\binsonnia\b/i, /\bsveglia\s+alle\b/i, /\bho\s+dormito\s+(poco|male)\b/i, /\bnotte\s+in\s+bianco\b/i],
    replies: [
      'Il sonno è la cosa che sistemata sistema tutto il resto. Anche l\'umore.',
      'Se non ti addormenti, alzati dieci minuti invece di restare a girarti. Sembra assurdo ma aiuta.',
      'Telefono fuori dal letto. Lo so, lo so. Ma è vero.',
      'A che ora sei andata a dormire? E a che ora vorresti andarci?',
    ],
    followUps: [
      'Se è la testa che non si spegne, prova a scrivere quello che ti gira per la testa prima di coricarti.',
      'Anche solo mezz\'ora prima, per qualche sera. Non serve rivoluzionare tutto.',
    ],
  },
  {
    id: 'corpo',
    weight: 7,
    patterns: [
      /\bmi\s+vedo\s+(male|brutta|grassa)\b/i,
      /\bodio\s+il\s+mio\s+corpo\b/i,
      /\bnon\s+mi\s+piaccio\b/i,
      /\bdieta\b/i,
      /\bpeso\b/i,
      /\bpancia\b/i,
      /\bmi\s+sento\s+brutta\b/i,
    ],
    replies: [
      'Le giornate in cui ci si vede male esistono, e spesso non c\'entra niente con il corpo.',
      'Non ti dico "ma sei bellissima" perché lo so che non serve. Ti dico che oggi ti stai guardando con occhi cattivi.',
      'Come ti vedi cambia con l\'umore, la luce, il sonno. Il corpo invece è lo stesso di ieri.',
      'Va bene non piacersi oggi. Non deve diventare una cosa da risolvere entro stasera.',
    ],
    followUps: [
      'Se questo pensiero torna spesso e ti condiziona le giornate, parlarne con qualcuno di preparato aiuta davvero. Non è una cosa grossa da fare.',
      'Metti qualcosa che ti fa stare comoda. È scemo, ma cambia la giornata.',
    ],
  },
  {
    id: 'ciclo',
    weight: 7,
    patterns: [/\bciclo\b/i, /\bmestruazion/i, /\bcrampi\b/i, /\bsindrome\s+premestruale\b/i, /\bho\s+le\s+mie\s+cose\b/i],
    replies: [
      'Ah ecco. Metà delle cose che oggi ti sembrano enormi domani saranno normali.',
      'Borsa dell\'acqua calda, roba comoda, zero sensi di colpa. Programma della giornata.',
      'Va bene fare la metà delle cose in questi giorni. Letteralmente la metà.',
      'Se i dolori sono forti ogni mese non è "normale e basta": vale la pena parlarne con la ginecologa.',
    ],
  },
  {
    id: 'sport',
    weight: 5,
    patterns: [/\bpalestra\b/i, /\ballenament/i, /\bcorsa\b/i, /\bcorrere\b/i, /\byoga\b/i, /\bpilates\b/i, /\bnuoto\b/i],
    replies: [
      'Brava. Anche solo esserci andata conta più dell\'allenamento in sé.',
      'Non serve fare bene, serve andare. Il resto viene da solo.',
      'Se oggi non ti va, va bene saltare. Una volta non rompe niente.',
      'Come ti senti dopo? Quella sensazione lì è il motivo per cui ci si torna.',
    ],
  },
  {
    id: 'salute',
    weight: 6,
    patterns: [/\bmal\s+di\s+testa\b/i, /\bfebbre\b/i, /\binfluenza\b/i, /\braffreddat/i, /\bnon\s+sto\s+bene\s+fisicamente\b/i, /\bmi\s+fa\s+male\b/i],
    replies: [
      'Riposa sul serio, non "riposa mentre fai altro".',
      'Bevi e stai al caldo. Il resto aspetta, davvero.',
      'Mi raccomando, se non passa fatti vedere. Io su queste cose non ho competenza.',
      'Oggi zero. Domani si vede.',
    ],
  },

  // --- Vita quotidiana ------------------------------------------------------
  {
    id: 'social',
    weight: 6,
    patterns: [/\binstagram\b/i, /\btiktok\b/i, /\bsocial\b/i, /\btroppo\s+tempo\s+(al\s+)?telefono\b/i, /\bconfronto\b/i, /\bmi\s+paragono\b/i],
    replies: [
      'Il confronto è il modo più veloce per rovinarsi una giornata buona.',
      'Stai confrontando la tua giornata intera con il momento migliore della loro.',
      'Prova a togliere l\'app per un giorno. Uno. Poi mi dici.',
      'Nessuno ha la vita che sembra avere lì. Nemmeno chi la posta.',
    ],
    followUps: [
      'Se un profilo ti fa stare male, silenzialo. Non devi spiegarlo a nessuno.',
      'Il telefono a faccia in giù per un\'ora è una piccola cosa che funziona.',
    ],
  },
  {
    id: 'casa',
    weight: 4,
    patterns: [/\bpulizie\b/i, /\bcasa\s+in\s+disordine\b/i, /\bdisordine\b/i, /\btrasloco\b/i, /\bcoinquilin/i, /\bbucato\b/i],
    replies: [
      'Cinque minuti di ordine cambiano l\'umore di un\'intera stanza. Non serve fare tutto.',
      'Una superficie sola. La scrivania, il tavolo, il comodino. Poi basta.',
      'La casa in disordine pesa più di quanto ammettiamo. Non sei esagerata.',
      'Metti la musica alta e fai venti minuti. Poi smetti anche se non hai finito.',
    ],
  },
  {
    id: 'viaggio',
    weight: 4,
    patterns: [/\bviaggio\b/i, /\bvacanz/i, /\bpartir[eo]\b/i, /\bweekend\s+fuori\b/i, /\baereo\b/i, /\bvalig/i],
    replies: [
      'Che bello. Dove?',
      'Le cose belle da aspettare tengono su intere settimane. Anche piccole.',
      'Fai la valigia la sera prima, non la mattina. Fidati.',
      'Raccontami, che mi piacciono i programmi.',
    ],
  },
  {
    id: 'domenica',
    weight: 5,
    patterns: [/\bdomenica\s+sera\b/i, /\bansia\s+da\s+domenica\b/i, /\bdomani\s+si\s+ricomincia\b/i, /\blunedi\b/i, /\blunedì\b/i],
    replies: [
      'L\'ansia della domenica sera è una cosa vera e ce l\'hanno quasi tutti.',
      'Non è che la settimana sarà brutta. È che stasera sembra tutta insieme.',
      'Prepara le cose per domani e poi chiudi. Il resto è rimuginare.',
      'Guardati qualcosa di leggero e vai a dormire prima. Domani è solo un lunedì.',
    ],
  },
  {
    id: 'festa',
    weight: 4,
    patterns: [/\bfesta\b/i, /\bserata\b/i, /\busciamo\b/i, /\baperitivo\b/i, /\bcompleanno\b/i, /\bdiscoteca\b/i],
    replies: [
      'Divertiti 😄 Poi mi racconti.',
      'Bevi anche acqua, che la te di domani ti ringrazia.',
      'Che bello. Ci tenevi?',
      'Se a metà serata non ti va più, puoi anche tornare a casa. Vale sempre.',
    ],
  },
  {
    id: 'cibo',
    weight: 4,
    patterns: [/\bcucinar[eo]\b/i, /\bcena\b/i, /\bpranzo\b/i, /\bho\s+fame\b/i, /\bricetta\b/i, /\bmangiat[ao]\b/i],
    replies: [
      'Cucinare per sé stesse non è mai tempo perso.',
      'Anche una cosa semplice va benissimo. Non deve essere un progetto.',
      'Hai mangiato bene o hai mangiato in piedi guardando il telefono? 👀',
      'Mangia qualcosa di caldo, che aggiusta più cose di quanto sembri.',
    ],
  },
  {
    id: 'meteo',
    weight: 3,
    patterns: [/\bpiove\b/i, /\bfa\s+freddo\b/i, /\bfa\s+caldo\b/i, /\bgiornata\s+grigia\b/i, /\bmeteo\b/i],
    replies: [
      'Il tempo brutto pesa sull\'umore più di quanto vogliamo ammettere.',
      'Giornata da coperta e cose lente, direi.',
      'Approfittane per fare le cose che rimandi quando c\'è il sole.',
    ],
  },

  // --- Meta: parlare con Nina ----------------------------------------------
  {
    id: 'chi_sei',
    weight: 9,
    patterns: [
      /\bsei\s+(un[a]?\s+)?(person|umana|reale|vera|robot|intelligenza|ai|bot)/i,
      /\bchi\s+sei\b/i,
      /\bcosa\s+sei\b/i,
      /\bsei\s+finta\b/i,
      /\bparlo\s+con\s+un\s+computer\b/i,
    ],
    replies: [
      'Sono un\'app, non una persona. Però quello che ti dico è scritto per te sul serio, non a caso.',
      'Un\'app 😄 Non fingo il contrario. Il che non toglie che io sia qui.',
      'Non sono una persona vera, e sarebbe scorretto farti credere di sì. Sono la parte di questa app che ti risponde.',
    ],
  },
  {
    id: 'come_stai',
    weight: 8,
    patterns: [/\bcome\s+stai\b/i, /\btu\s+come\s+va\b/i, /\bcome\s+va\s*\?/i],
    replies: [
      'Io sto sempre uguale, il bello di essere un\'app 😄 Tu piuttosto?',
      'Bene, ma la domanda interessante è come stai tu.',
      'Sto qui ad aspettare che mi racconti la giornata, quindi bene.',
    ],
  },
  {
    id: 'grazie',
    weight: 8,
    patterns: [/\bgrazie\b/i, /\bti\s+voglio\s+bene\b/i, /\bsei\s+gentile\b/i, /\bmi\s+hai\s+aiutat/i],
    replies: [
      'Figurati 💗',
      'Quando vuoi. Sono qui apposta.',
      'Ma di niente. Torna quando ti va.',
    ],
  },
  {
    id: 'saluto',
    weight: 5,
    patterns: [/^\s*(ciao|hey|ehi|buongiorno|buonasera|buonanotte|hola)\b/i, /\bci\s+sei\b/i],
    replies: [], // gestito a parte, dipende dall'ora
  },
];

// ---------------------------------------------------------------------------
// Saluti in base all'ora
// ---------------------------------------------------------------------------

function greeting(context: BrainContext): string {
  const { userName, hour } = context;

  if (hour >= 5 && hour < 11) {
    return pick(
      [
        `Buongiorno ${userName} 🌸 Come si parte oggi?`,
        `Ciao ${userName}! Dormito bene?`,
        `Eccoti. Che programma abbiamo oggi?`,
      ],
      hour,
    );
  }

  if (hour >= 11 && hour < 15) {
    return pick(
      [`Ciao ${userName}! Come sta andando la giornata?`, 'Ehi. Pausa o corsa contro il tempo?'],
      hour,
    );
  }

  if (hour >= 15 && hour < 19) {
    return pick(
      ['Ciao! Com\'è andata finora?', `Ehi ${userName}. Che si dice?`],
      hour,
    );
  }

  if (hour >= 19 && hour < 24) {
    return pick(
      [`Ciao ${userName} 🌙 Com\'è andata oggi?`, 'Ehi. Serata tranquilla o no?'],
      hour,
    );
  }

  return pick(
    ['Ancora sveglia? 👀', 'Ehi. È tardi, tutto ok?'],
    hour,
  );
}

// ---------------------------------------------------------------------------
// Motore
// ---------------------------------------------------------------------------

function pick<T>(options: T[], seed: number): T {
  return options[Math.abs(seed) % options.length] as T;
}

function seedOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash;
}

export interface BrainResult {
  text: string;
  topicId: string;
}

/** Individua il tema di un messaggio. */
export function detectTopic(message: string): Topic | undefined {
  let best: Topic | undefined;
  let bestScore = 0;

  for (const topic of TOPICS) {
    const matches = topic.patterns.filter((pattern) => pattern.test(message)).length;
    if (matches === 0) continue;

    // Il peso domina, il numero di corrispondenze rompe la parità.
    //
    // È deliberato: "ho litigato con la mia migliore amica" contiene due
    // espressioni del tema amicizia e una sola del tema litigio, ma quello di
    // cui si sta parlando è il litigio. Un evento raccontato è un'intenzione
    // più forte del tema generico in cui rientra.
    const score = topic.weight * 10 + matches;
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }

  return best;
}

const QUESTION_REPLIES = [
  'Bella domanda. Tu che ne pensi? Chiedo davvero, non per rimbalzarla.',
  'Non ho una risposta buona. Però se me la racconti meglio ci ragioniamo insieme.',
  'Dipende da cosa ti fa stare meglio, non da cosa è giusto in astratto.',
  'Mmh. Dimmi un po\' più di contesto che così non saprei.',
];

const GENERIC_REPLIES = [
  'Ti seguo. Vai avanti 💗',
  'Raccontami meglio, che mi interessa.',
  'Mmh. E tu come ti sei sentita?',
  'Ok. E adesso cosa ti va di fare?',
  'Ci sono. Dimmi tutto.',
  'Continua pure, ti ascolto.',
];

const SHORT_REPLIES = [
  'Dimmi 😄',
  'Ok, e poi?',
  'Racconta.',
  'Ti ascolto.',
];

/**
 * Genera la risposta di Nina per un messaggio.
 *
 * `repeatCount` è quante volte di fila si è già parlato dello stesso tema:
 * al secondo giro Nina passa alle risposte di approfondimento invece di
 * ripetere l'apertura.
 */
export function respond(message: string, context: BrainContext): BrainResult {
  const trimmed = message.trim();
  const seed = seedOf(trimmed) + context.repeatCount;

  const topic = detectTopic(trimmed);

  if (topic?.id === 'saluto') {
    return { text: greeting(context), topicId: 'saluto' };
  }

  if (topic) {
    const pool =
      context.repeatCount > 0 && topic.followUps && topic.followUps.length > 0
        ? topic.followUps
        : topic.replies;

    if (pool.length > 0) {
      return { text: pick(pool, seed), topicId: topic.id };
    }
  }

  // Messaggio molto corto: risposta molto corta. Rispondere con un paragrafo a
  // un "ok" è il modo più veloce per sembrare finti.
  if (trimmed.length <= 12) {
    return { text: pick(SHORT_REPLIES, seed), topicId: 'breve' };
  }

  if (trimmed.includes('?')) {
    return { text: pick(QUESTION_REPLIES, seed), topicId: 'domanda' };
  }

  return { text: pick(GENERIC_REPLIES, seed), topicId: 'generico' };
}

/** Quanti temi conosce Nina. Usato dai test e dalla rotta di stato. */
export function topicCount(): number {
  return TOPICS.length;
}
