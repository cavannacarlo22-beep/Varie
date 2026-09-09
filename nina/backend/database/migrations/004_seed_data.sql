-- FILE: backend/database/migrations/004_seed_data.sql
-- Nina — contenuti iniziali.
--
-- Qui NON c'è nessun account e nessuna password. L'account amministratore si
-- crea con `npm run create-admin`, che chiede la password in modo interattivo e
-- non la scrive mai su disco né nei log.
--
-- Le frasi attribuite sono di autori di pubblico dominio. Le altre sono scritte
-- per Nina: sono la sua voce, non citazioni altrui.

BEGIN;

-- ---------------------------------------------------------------------------
-- Pensieri del giorno
-- ---------------------------------------------------------------------------

INSERT INTO motivation_quotes (text, author, source, language, is_active)
SELECT * FROM (VALUES
    -- La voce di Nina
    ('Non devi fare tutto oggi. Devi solo fare qualcosa.', NULL, 'Nina', 'it', TRUE),
    ('Una cosa alla volta. Poi un''altra. È così che si fanno le cose grandi.', NULL, 'Nina', 'it', TRUE),
    ('Anche i giorni storti contano. Contano come giorni in cui ci hai provato.', NULL, 'Nina', 'it', TRUE),
    ('Sei più avanti di quanto pensi. Ti sei solo dimenticata di guardare indietro.', NULL, 'Nina', 'it', TRUE),
    ('Il riposo non è un premio che devi meritarti. È parte del lavoro.', NULL, 'Nina', 'it', TRUE),
    ('Fatto è meglio di perfetto. Sempre.', NULL, 'Nina', 'it', TRUE),
    ('Se oggi riesci solo a respirare, va bene. È già qualcosa.', NULL, 'Nina', 'it', TRUE),
    ('Nessuno ha la vita che sembra avere su Instagram. Nemmeno chi la posta.', NULL, 'Nina', 'it', TRUE),
    ('Puoi cambiare idea. Non è incoerenza, è crescere.', NULL, 'Nina', 'it', TRUE),
    ('Le cose che rimandi da tre settimane probabilmente durano dieci minuti.', NULL, 'Nina', 'it', TRUE),
    ('Chiedere aiuto non toglie niente a quello che sai fare da sola.', NULL, 'Nina', 'it', TRUE),
    ('Oggi va bene anche il minimo indispensabile.', NULL, 'Nina', 'it', TRUE),
    ('Il confronto è il modo più veloce per rovinarsi una giornata buona.', NULL, 'Nina', 'it', TRUE),
    ('Non sei in ritardo. Non esiste un orario.', NULL, 'Nina', 'it', TRUE),
    ('Le giornate storte finiscono. Questa è una promessa matematica.', NULL, 'Nina', 'it', TRUE),
    ('Puoi essere stanca e forte contemporaneamente. Non è una contraddizione.', NULL, 'Nina', 'it', TRUE),
    ('Fai la cosa che stai evitando. Dopo starai molto meglio, lo sai.', NULL, 'Nina', 'it', TRUE),
    ('Va bene dire di no. Anche senza spiegare perché.', NULL, 'Nina', 'it', TRUE),
    ('Il tuo valore non si misura in cose barrate da una lista.', NULL, 'Nina', 'it', TRUE),
    ('Bevi un bicchiere d''acqua. Sul serio, adesso.', NULL, 'Nina', 'it', TRUE),
    ('Se ci pensi da tanto, forse non è un''idea passeggera.', NULL, 'Nina', 'it', TRUE),
    ('I progressi lenti sono comunque progressi.', NULL, 'Nina', 'it', TRUE),
    ('Non devi essere motivata per iniziare. La motivazione arriva dopo, di solito.', NULL, 'Nina', 'it', TRUE),
    ('Perdonati per ieri. Ieri non c''è più.', NULL, 'Nina', 'it', TRUE),
    ('La tua versione stanca merita gentilezza quanto la tua versione produttiva.', NULL, 'Nina', 'it', TRUE),
    ('Cinque minuti di ordine cambiano l''umore di un''intera stanza.', NULL, 'Nina', 'it', TRUE),
    ('Non tutto quello che conta si può misurare.', NULL, 'Nina', 'it', TRUE),
    ('Hai già superato il 100% dei tuoi giorni peggiori.', NULL, 'Nina', 'it', TRUE),
    ('Fai qualcosa oggi di cui domani sarai contenta.', NULL, 'Nina', 'it', TRUE),
    ('Se la lista è troppo lunga, il problema è la lista, non tu.', NULL, 'Nina', 'it', TRUE),
    ('Il buonumore si allena come tutto il resto.', NULL, 'Nina', 'it', TRUE),
    ('Va bene anche fermarsi a metà. Riprendere è permesso.', NULL, 'Nina', 'it', TRUE),
    ('Le abitudini piccole battono i propositi enormi. Ogni volta.', NULL, 'Nina', 'it', TRUE),
    ('Sii la persona che saresti voluta avere accanto quando stavi male.', NULL, 'Nina', 'it', TRUE),
    ('Non esiste una versione di te che vada bene a tutti. Menomale.', NULL, 'Nina', 'it', TRUE),
    ('Oggi è un buon giorno per essere gentile con te stessa.', NULL, 'Nina', 'it', TRUE),
    ('Il tempo che ti prendi non è tempo rubato a nessuno.', NULL, 'Nina', 'it', TRUE),
    ('Un passo indietro a volte è solo la rincorsa.', NULL, 'Nina', 'it', TRUE),
    ('Smetti di rileggere quel messaggio. Va bene com''è.', NULL, 'Nina', 'it', TRUE),
    ('Le cose belle richiedono tempo. Anche tu sei una cosa bella.', NULL, 'Nina', 'it', TRUE),

    -- Autori di pubblico dominio
    ('Non è che abbiamo poco tempo: è che ne perdiamo molto.', 'Seneca', 'De brevitate vitae', 'it', TRUE),
    ('Ogni giorno è una vita in miniatura.', 'Seneca', 'Epistulae morales', 'it', TRUE),
    ('La felicità della tua vita dipende dalla qualità dei tuoi pensieri.', 'Marco Aurelio', 'Colloqui con se stesso', 'it', TRUE),
    ('Comincia: l''inizio è metà dell''opera.', 'Marco Aurelio', 'Colloqui con se stesso', 'it', TRUE),
    ('Non sono le cose a turbarci, ma le opinioni che ne abbiamo.', 'Epitteto', 'Manuale', 'it', TRUE),
    ('Non pretendere che le cose vadano come vuoi tu: accogli come vanno.', 'Epitteto', 'Manuale', 'it', TRUE),
    ('Non importa quanto vai piano, l''importante è non fermarsi.', 'Confucio', NULL, 'it', TRUE),
    ('Un viaggio di mille miglia comincia con un solo passo.', 'Lao Tzu', 'Tao Te Ching', 'it', TRUE),
    ('Siamo ciò che facciamo ripetutamente. L''eccellenza è un''abitudine.', 'Aristotele', NULL, 'it', TRUE),
    ('Il sapere è l''unica cosa che nessuno ti può togliere.', 'Socrate', NULL, 'it', TRUE),
    ('Sii te stessa: gli altri sono già occupati.', 'Oscar Wilde', NULL, 'it', TRUE),
    ('Vivi la vita che hai immaginato.', 'Henry David Thoreau', 'Walden', 'it', TRUE),
    ('Niente di grande è mai stato fatto senza entusiasmo.', 'Ralph Waldo Emerson', NULL, 'it', TRUE),
    ('Il segreto per andare avanti è cominciare.', 'Mark Twain', NULL, 'it', TRUE),
    ('Non temo le tempeste: sto imparando a governare la mia nave.', 'Louisa May Alcott', 'Piccole donne', 'it', TRUE),
    ('Nella vita non c''è nulla da temere, solo da capire.', 'Marie Curie', NULL, 'it', TRUE),
    ('Una donna deve avere una stanza tutta per sé.', 'Virginia Woolf', 'Una stanza tutta per sé', 'it', TRUE),
    ('La chiarezza si guadagna scrivendo, non pensando.', NULL, 'Nina', 'it', TRUE),
    ('La semplicità è la massima raffinatezza.', 'Leonardo da Vinci', NULL, 'it', TRUE),
    ('Chi ha un perché abbastanza forte sopporta quasi ogni come.', 'Friedrich Nietzsche', 'Crepuscolo degli idoli', 'it', TRUE)
) AS seed(text, author, source, language, is_active)
WHERE NOT EXISTS (SELECT 1 FROM motivation_quotes);

-- ---------------------------------------------------------------------------
-- Idee di self care
-- ---------------------------------------------------------------------------

INSERT INTO self_care_ideas (title, description, category, duration_min, is_active)
SELECT * FROM (VALUES
    ('Fai una passeggiata',                  'Anche solo intorno all''isolato. Senza meta, senza contare i passi.', 'FUORI', 20, TRUE),
    ('Metti la tua canzone preferita',        'Quella che ti fa alzare il volume. A tutto volume, se puoi.', 'MENTE', 4, TRUE),
    ('Stacca il telefono per 30 minuti',      'Modalità aereo. Il mondo sopravvive, promesso.', 'DIGITALE', 30, TRUE),
    ('Fatti una doccia lunga',                'Acqua calda, niente fretta, nessuno che ti aspetta.', 'CORPO', 20, TRUE),
    ('Prenditi un caffè con calma',           'Seduta. Senza telefono. Solo tu e la tazza.', 'RELAX', 15, TRUE),
    ('Scrivi tre cose belle di oggi',         'Anche minuscole. Soprattutto minuscole.', 'MENTE', 5, TRUE),
    ('Cambia le lenzuola',                    'Non c''è niente come dormire tra lenzuola pulite.', 'CASA', 10, TRUE),
    ('Fai stretching per dieci minuti',       'Il corpo ti ringrazia, soprattutto la schiena.', 'CORPO', 10, TRUE),
    ('Chiama una persona a cui tieni',        'Non messaggi. Proprio una chiamata.', 'SOCIAL', 20, TRUE),
    ('Riordina una sola superficie',          'La scrivania, il comodino, il tavolo. Una sola.', 'CASA', 10, TRUE),
    ('Bevi un bicchiere d''acqua',            'Il gesto più sottovalutato della giornata.', 'CORPO', 1, TRUE),
    ('Guarda fuori dalla finestra',           'Cinque minuti, senza fare altro. Si chiama riposo.', 'MENTE', 5, TRUE),
    ('Fai una maschera viso',                 'O anche solo una crema messa per bene.', 'CORPO', 20, TRUE),
    ('Leggi dieci pagine',                    'Di qualsiasi cosa, anche leggerissima.', 'MENTE', 15, TRUE),
    ('Prepara qualcosa che ti piace',         'Cucinare per sé stesse non è mai tempo perso.', 'CASA', 40, TRUE),
    ('Scrivi quello che ti gira in testa',    'Non deve avere senso. Deve solo uscire.', 'MENTE', 15, TRUE),
    ('Fai un pisolino di venti minuti',       'Venti, non due ore. Metti la sveglia.', 'RELAX', 20, TRUE),
    ('Cancella dieci foto inutili',           'Screenshot del 2021 che non servono più.', 'DIGITALE', 5, TRUE),
    ('Accendi una candela',                   'Cambia l''atmosfera di una stanza in tre secondi.', 'RELAX', 2, TRUE),
    ('Balla in cucina',                       'Da sola. Nessuno ti guarda.', 'CORPO', 5, TRUE),
    ('Prendi aria dalla finestra',            'Due minuti di aria fredda resettano la testa.', 'FUORI', 3, TRUE),
    ('Fai una lista di cose che aspetti',     'Anche piccole: una serie, una cena, un weekend.', 'MENTE', 10, TRUE),
    ('Metti a posto la galleria',             'Elimina i doppioni. È stranamente soddisfacente.', 'DIGITALE', 15, TRUE),
    ('Fai un bagno caldo',                    'Con quello che ti piace dentro.', 'CORPO', 40, TRUE),
    ('Disegna qualcosa di brutto',            'L''obiettivo non è il risultato.', 'CREATIVITA', 15, TRUE),
    ('Riascolta un album intero',             'Dall''inizio alla fine, come si faceva una volta.', 'RELAX', 45, TRUE),
    ('Scrivi a chi non senti da tanto',       'Un messaggio breve basta. Davvero.', 'SOCIAL', 5, TRUE),
    ('Cambia posto ai mobili',                'Anche solo una poltrona. La stanza sembra nuova.', 'CASA', 30, TRUE),
    ('Fai il letto',                          'Se la giornata va male, almeno una cosa è fatta.', 'CASA', 3, TRUE),
    ('Guarda un episodio senza sensi di colpa','Uno. Consapevolmente. Godendotelo.', 'RELAX', 40, TRUE),
    ('Respira contando fino a quattro',       'Inspira 4, trattieni 4, espira 4. Dieci volte.', 'MENTE', 5, TRUE),
    ('Metti in ordine le note del telefono',  'Quelle liste iniziate e mai finite.', 'DIGITALE', 15, TRUE),
    ('Compra dei fiori',                      'Anche il mazzo economico del supermercato.', 'FUORI', 15, TRUE),
    ('Fai una cosa con le mani',              'Impastare, piantare, cucire, montare. Qualsiasi cosa.', 'CREATIVITA', 30, TRUE),
    ('Silenzia le notifiche per un''ora',     'Non è maleducazione, è manutenzione.', 'DIGITALE', 60, TRUE),
    ('Guarda vecchie foto belle',             'Quelle di un giorno in cui stavi bene.', 'MENTE', 10, TRUE),
    ('Cammina senza cuffie',                  'Sentire i rumori normali è più riposante di quanto sembri.', 'FUORI', 20, TRUE),
    ('Scrivi una cosa di cui sei fiera',      'Di questa settimana. Ce n''è almeno una.', 'MENTE', 5, TRUE),
    ('Prepara i vestiti per domani',          'La te di domani mattina ti ringrazierà.', 'CASA', 5, TRUE),
    ('Non fare niente per dieci minuti',      'Seriamente niente. È più difficile di quanto sembra.', 'RELAX', 10, TRUE)
) AS seed(title, description, category, duration_min, is_active)
WHERE NOT EXISTS (SELECT 1 FROM self_care_ideas);

COMMIT;
