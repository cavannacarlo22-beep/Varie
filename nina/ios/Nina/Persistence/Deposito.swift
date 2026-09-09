// FILE: ios/Nina/Persistence/Deposito.swift
//
// Il magazzino locale: SwiftData.
//
// Tutte le schermate leggono e scrivono **solo qui**. Nessuna vista chiama il
// backend direttamente. Questo è ciò che rende l'app utilizzabile offline senza
// scrivere due volte ogni funzione: scrivere è sempre un'operazione locale e
// istantanea, e la sincronizzazione è un dettaglio che avviene dopo.
//
// Ogni scrittura fa tre cose:
//   1. modifica l'oggetto in locale (la schermata si aggiorna subito);
//   2. aggiorna `clientUpdatedAt` — l'istante che deciderà eventuali conflitti;
//   3. alza `daInviare`, che è la coda di uscita.
//
// Il punto 3 *è* la coda delle modifiche: non serve una tabella separata,
// perché l'oggetto stesso sa di dover essere inviato.

import Foundation
import SwiftData

@MainActor
@Observable
final class Deposito {

    let contenitore: ModelContainer
    var contesto: ModelContext { contenitore.mainContext }

    /// Chiamata dopo ogni scrittura locale, per svegliare la sincronizzazione.
    var alCambiamento: (() -> Void)?

    init(inMemoria: Bool = false) {
        let schema = Schema([
            Attivita.self,
            Abitudine.self,
            CompletamentoAbitudine.self,
            Umore.self,
            PaginaDiario.self,
            Desiderio.self,
            NotaVeloce.self,
            MessaggioAmica.self,
            Impostazioni.self,
            FraseSalvata.self,
            IdeaSelfCare.self,
            StatoSync.self,
            CancellazioneInSospeso.self,
        ])

        let configurazione = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: inMemoria,
            // Il database locale è una cache: non deve finire in iCloud né nei
            // backup. I dati veri stanno su Neon, e il diario non ha ragione di
            // essere duplicato in un backup non cifrato dall'app.
            allowsSave: true,
            cloudKitDatabase: .none
        )

        do {
            contenitore = try ModelContainer(for: schema, configurations: [configurazione])
        } catch {
            // Se il negozio locale è corrotto o incompatibile, si riparte da zero:
            // è una cache, e il contenuto vero verrà riscaricato dal server.
            // Meglio questo di un'app che non si apre più.
            let ripiego = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            contenitore = try! ModelContainer(for: schema, configurations: [ripiego])
        }
    }

    // MARK: - Salvataggio

    private func salva(_ oggetto: (some Sincronizzabile)?) {
        if let oggetto {
            oggetto.clientUpdatedAt = Date()
            oggetto.daInviare = true
        }
        try? contesto.save()
        alCambiamento?()
    }

    func salvaSoltanto() {
        try? contesto.save()
    }

    // MARK: - Stato della sincronizzazione

    var stato: StatoSync {
        let richiesta = FetchDescriptor<StatoSync>()
        if let esistente = try? contesto.fetch(richiesta).first { return esistente }
        let nuovo = StatoSync()
        contesto.insert(nuovo)
        try? contesto.save()
        return nuovo
    }

    // MARK: - Impostazioni

    var impostazioni: Impostazioni {
        let richiesta = FetchDescriptor<Impostazioni>()
        if let esistenti = try? contesto.fetch(richiesta).first { return esistenti }
        let nuove = Impostazioni()
        contesto.insert(nuove)
        try? contesto.save()
        return nuove
    }

    func aggiornaImpostazioni(_ modifica: (Impostazioni) -> Void) {
        let attuali = impostazioni
        modifica(attuali)
        salva(attuali)
    }

    // MARK: - Attività

    func attivita(del giorno: String) -> [Attivita] {
        let richiesta = FetchDescriptor<Attivita>(
            predicate: #Predicate { $0.giorno == giorno && $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.ora), SortDescriptor(\.createdAt)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    func attivita(da: String, a: String) -> [Attivita] {
        let richiesta = FetchDescriptor<Attivita>(
            predicate: #Predicate { $0.giorno >= da && $0.giorno <= a && $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.giorno), SortDescriptor(\.ora)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    func attivita(id: UUID) -> Attivita? {
        let richiesta = FetchDescriptor<Attivita>(predicate: #Predicate { $0.id == id })
        return try? contesto.fetch(richiesta).first
    }

    @discardableResult
    func creaAttivita(
        titolo: String,
        giorno: String,
        ora: String? = nil,
        categoria: TaskCategory = .altro,
        priorita: TaskPriority = .medium,
        note: String? = nil,
        ripetizione: RepeatType = .never,
        giorniRipetizione: [Int] = [],
        notificaAttiva: Bool = false,
        minutiPrima: Int = 15
    ) -> Attivita {
        let nuova = Attivita(
            titolo: titolo,
            giorno: giorno,
            ora: ora,
            priorita: priorita,
            categoria: categoria,
            note: note,
            ripetizione: ripetizione,
            giorniRipetizione: giorniRipetizione,
            notificaAttiva: notificaAttiva,
            minutiPrima: minutiPrima
        )
        contesto.insert(nuova)
        salva(nuova)
        return nuova
    }

    func modificaAttivita(_ attivita: Attivita, _ modifica: (Attivita) -> Void) {
        modifica(attivita)
        attivita.updatedAt = Date()
        salva(attivita)
    }

    /// Spunta o de-spunta un'attività, tenendo coerenti i due campi.
    func completa(_ attivita: Attivita, _ completata: Bool) {
        attivita.completata = completata
        attivita.completataIl = completata ? Date() : nil
        attivita.updatedAt = Date()
        salva(attivita)
    }

    func elimina(_ attivita: Attivita) {
        attivita.deletedAt = Date()
        salva(attivita)
    }

    /// Elimina questa occorrenza e tutte le successive della stessa serie.
    func eliminaSerie(da attivita: Attivita) {
        guard let serie = attivita.serieId else {
            elimina(attivita)
            return
        }
        let giorno = attivita.giorno
        let richiesta = FetchDescriptor<Attivita>(
            predicate: #Predicate { $0.serieId == serie && $0.giorno >= giorno && $0.deletedAt == nil }
        )
        for occorrenza in (try? contesto.fetch(richiesta)) ?? [] {
            occorrenza.deletedAt = Date()
            occorrenza.clientUpdatedAt = Date()
            occorrenza.daInviare = true
        }
        try? contesto.save()
        alCambiamento?()
    }

    // MARK: - Abitudini

    func abitudini() -> [Abitudine] {
        let richiesta = FetchDescriptor<Abitudine>(
            predicate: #Predicate { $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.ordine), SortDescriptor(\.createdAt)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    @discardableResult
    func creaAbitudine(nome: String, icona: String, colore: String, frequenza: HabitFrequency, giorni: [Int]) -> Abitudine {
        let esistenti = abitudini().count
        let nuova = Abitudine(
            nome: nome, icona: icona, colore: colore,
            frequenza: frequenza, giorniObiettivo: giorni, ordine: esistenti
        )
        contesto.insert(nuova)
        salva(nuova)
        return nuova
    }

    func modificaAbitudine(_ abitudine: Abitudine, _ modifica: (Abitudine) -> Void) {
        modifica(abitudine)
        abitudine.updatedAt = Date()
        salva(abitudine)
    }

    func elimina(_ abitudine: Abitudine) {
        abitudine.deletedAt = Date()
        salva(abitudine)
    }

    func completamenti(abitudine: UUID) -> [CompletamentoAbitudine] {
        let richiesta = FetchDescriptor<CompletamentoAbitudine>(
            predicate: #Predicate { $0.abitudineId == abitudine && $0.deletedAt == nil && $0.fatta },
            sortBy: [SortDescriptor(\.giorno, order: .reverse)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    func completamento(abitudine: UUID, giorno: String) -> CompletamentoAbitudine? {
        let richiesta = FetchDescriptor<CompletamentoAbitudine>(
            predicate: #Predicate { $0.abitudineId == abitudine && $0.giorno == giorno }
        )
        return try? contesto.fetch(richiesta).first
    }

    /// Spunta un'abitudine per un giorno. Restituisce lo stato risultante.
    @discardableResult
    func alterna(abitudine: Abitudine, giorno: String) -> Bool {
        if let esistente = completamento(abitudine: abitudine.id, giorno: giorno) {
            let nuovoStato = !(esistente.fatta && esistente.deletedAt == nil)
            esistente.fatta = nuovoStato
            esistente.deletedAt = nil
            esistente.updatedAt = Date()
            salva(esistente)
            return nuovoStato
        }

        let nuovo = CompletamentoAbitudine(abitudineId: abitudine.id, giorno: giorno, fatta: true)
        contesto.insert(nuovo)
        salva(nuovo)
        return true
    }

    // MARK: - Mood

    func umore(del giorno: String) -> Umore? {
        let richiesta = FetchDescriptor<Umore>(
            predicate: #Predicate { $0.giorno == giorno && $0.deletedAt == nil }
        )
        return try? contesto.fetch(richiesta).first
    }

    func umori(da: String, a: String) -> [Umore] {
        let richiesta = FetchDescriptor<Umore>(
            predicate: #Predicate { $0.giorno >= da && $0.giorno <= a && $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.giorno)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    func registra(umore: MoodKind, nota: String?, giorno: String = CalendarioNina.oggi) {
        if let esistente = self.umore(del: giorno) {
            esistente.umore = umore
            esistente.nota = nota
            esistente.updatedAt = Date()
            salva(esistente)
            return
        }
        let nuovo = Umore(umore: umore, nota: nota, giorno: giorno)
        contesto.insert(nuovo)
        salva(nuovo)
    }

    // MARK: - Diario

    func pagineDiario(cerca: String = "") -> [PaginaDiario] {
        var richiesta = FetchDescriptor<PaginaDiario>(
            predicate: #Predicate { $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.giorno, order: .reverse), SortDescriptor(\.createdAt, order: .reverse)]
        )
        richiesta.fetchLimit = 500
        let tutte = (try? contesto.fetch(richiesta)) ?? []

        guard !cerca.isEmpty else { return tutte }
        let termine = cerca.lowercased()
        return tutte.filter {
            $0.contenuto.lowercased().contains(termine) ||
            ($0.titolo?.lowercased().contains(termine) ?? false)
        }
    }

    @discardableResult
    func creaPagina(titolo: String?, contenuto: String, umore: MoodKind?, giorno: String = CalendarioNina.oggi) -> PaginaDiario {
        let nuova = PaginaDiario(titolo: titolo, contenuto: contenuto, umore: umore, giorno: giorno)
        contesto.insert(nuova)
        salva(nuova)
        return nuova
    }

    func modificaPagina(_ pagina: PaginaDiario, _ modifica: (PaginaDiario) -> Void) {
        modifica(pagina)
        pagina.updatedAt = Date()
        salva(pagina)
    }

    func elimina(_ pagina: PaginaDiario) {
        pagina.deletedAt = Date()
        salva(pagina)
    }

    // MARK: - Wishlist

    func desideri() -> [Desiderio] {
        let richiesta = FetchDescriptor<Desiderio>(
            predicate: #Predicate { $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.acquistato), SortDescriptor(\.createdAt, order: .reverse)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    @discardableResult
    func creaDesiderio(titolo: String, prezzo: Double?, categoria: WishlistCategory, link: String?, dettaglio: String?) -> Desiderio {
        let nuovo = Desiderio(
            titolo: titolo, dettaglio: dettaglio, prezzo: prezzo,
            linkProdotto: link, categoria: categoria
        )
        contesto.insert(nuovo)
        salva(nuovo)
        return nuovo
    }

    func modificaDesiderio(_ desiderio: Desiderio, _ modifica: (Desiderio) -> Void) {
        modifica(desiderio)
        desiderio.updatedAt = Date()
        salva(desiderio)
    }

    func segnaAcquistato(_ desiderio: Desiderio, _ acquistato: Bool) {
        desiderio.acquistato = acquistato
        desiderio.acquistatoIl = acquistato ? Date() : nil
        desiderio.updatedAt = Date()
        salva(desiderio)
    }

    func elimina(_ desiderio: Desiderio) {
        desiderio.deletedAt = Date()
        salva(desiderio)
    }

    // MARK: - Note veloci

    func note() -> [NotaVeloce] {
        let richiesta = FetchDescriptor<NotaVeloce>(
            predicate: #Predicate { $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    @discardableResult
    func creaNota(_ contenuto: String) -> NotaVeloce {
        let nuova = NotaVeloce(contenuto: contenuto)
        contesto.insert(nuova)
        salva(nuova)
        return nuova
    }

    func elimina(_ nota: NotaVeloce) {
        nota.deletedAt = Date()
        salva(nota)
    }

    /// Trasforma una nota in un'attività di oggi.
    @discardableResult
    func trasformaInAttivita(_ nota: NotaVeloce, giorno: String = CalendarioNina.oggi) -> Attivita {
        let attivita = creaAttivita(
            titolo: String(nota.contenuto.prefix(200)),
            giorno: giorno,
            categoria: .personale
        )
        nota.attivitaCollegata = attivita.id
        nota.updatedAt = Date()
        salva(nota)
        return attivita
    }

    // MARK: - Conversazione

    func messaggi() -> [MessaggioAmica] {
        let richiesta = FetchDescriptor<MessaggioAmica>(
            predicate: #Predicate { $0.deletedAt == nil },
            sortBy: [SortDescriptor(\.createdAt)]
        )
        return (try? contesto.fetch(richiesta)) ?? []
    }

    func aggiungiMessaggio(_ messaggio: MessaggioAmica) {
        contesto.insert(messaggio)
        try? contesto.save()
    }

    // MARK: - Contenuti in cache

    func frasi() -> [FraseSalvata] {
        let richiesta = FetchDescriptor<FraseSalvata>(predicate: #Predicate { $0.attiva })
        return (try? contesto.fetch(richiesta)) ?? []
    }

    /// Una frase scelta in locale, quando il server non è raggiungibile.
    ///
    /// La scelta dipende dal giorno, non dal caso: aprendo l'app tre volte
    /// nello stesso giorno la frase è la stessa, come quando c'è rete.
    func fraseLocale(per giorno: String = CalendarioNina.oggi) -> Frase? {
        let disponibili = frasi()
        guard !disponibili.isEmpty else { return nil }
        let seme = abs(giorno.hashValue)
        return disponibili[seme % disponibili.count].frase
    }

    func ideeSelfCare() -> [IdeaSelfCare] {
        let richiesta = FetchDescriptor<IdeaSelfCare>(predicate: #Predicate { $0.attiva })
        return (try? contesto.fetch(richiesta)) ?? []
    }

    func ideaSelfCareACaso(categoria: SelfCareCategory? = nil) -> IdeaSelfCare? {
        let tutte = ideeSelfCare()
        let filtrate = categoria.map { scelta in tutte.filter { $0.categoria == scelta } } ?? tutte
        return filtrate.randomElement()
    }

    // MARK: - Coda di uscita

    /// Tutti gli oggetti che hanno modifiche non ancora inviate.
    func daInviare() -> [any Sincronizzabile] {
        var risultato: [any Sincronizzabile] = []

        func raccogli<T: PersistentModel & Sincronizzabile>(_ tipo: T.Type) {
            let richiesta = FetchDescriptor<T>(predicate: #Predicate { $0.daInviare })
            risultato.append(contentsOf: (try? contesto.fetch(richiesta)) ?? [])
        }

        raccogli(Attivita.self)
        raccogli(Abitudine.self)
        raccogli(CompletamentoAbitudine.self)
        raccogli(Umore.self)
        raccogli(PaginaDiario.self)
        raccogli(Desiderio.self)
        raccogli(NotaVeloce.self)
        raccogli(Impostazioni.self)

        return risultato
    }

    var modificheInAttesa: Int { daInviare().count }

    // MARK: - Pulizia

    /// Svuota tutto: usata al logout e alla cancellazione dell'account.
    func svuota() {
        try? contesto.delete(model: Attivita.self)
        try? contesto.delete(model: Abitudine.self)
        try? contesto.delete(model: CompletamentoAbitudine.self)
        try? contesto.delete(model: Umore.self)
        try? contesto.delete(model: PaginaDiario.self)
        try? contesto.delete(model: Desiderio.self)
        try? contesto.delete(model: NotaVeloce.self)
        try? contesto.delete(model: MessaggioAmica.self)
        try? contesto.delete(model: Impostazioni.self)
        try? contesto.delete(model: StatoSync.self)
        try? contesto.delete(model: CancellazioneInSospeso.self)
        // Frasi e idee restano: sono contenuti pubblici, non dati personali,
        // e riaverli subito rende l'app utilizzabile al primo avvio successivo.
        try? contesto.save()
    }
}
