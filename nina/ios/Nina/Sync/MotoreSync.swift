// FILE: ios/Nina/Sync/MotoreSync.swift
//
// La sincronizzazione, lato app.
//
// Il giro completo è sempre lo stesso:
//
//   1. push  — manda le modifiche locali non ancora inviate
//   2. pull  — chiede tutto ciò che è cambiato dopo il cursore
//   3. salva il nuovo cursore
//
// L'ordine conta: si spinge prima di tirare, così se il server rifiuta una
// nostra modifica (perché ne aveva una più recente) la pull successiva ci
// consegna subito la versione autorevole e la copia locale si allinea nello
// stesso giro.
//
// Nessuna modifica viene persa senza che l'utente possa saperlo: un rifiuto
// non è silenzioso, viene contato in `conflittiRisolti` e la copia locale
// adotta la versione del server, che è la stessa regola su tutti i dispositivi.

import Foundation
import SwiftData

@MainActor
@Observable
final class MotoreSync {

    enum Stato: Equatable {
        case ferma
        case inCorso
        case completata(Date)
        case errore(String)
    }

    private(set) var stato: Stato = .ferma
    private(set) var conflittiRisolti = 0
    private(set) var dispositiviCollegati = 0

    private let deposito: Deposito
    private let client: ClientAPI

    private var sincronizzazioneInCorso: Task<Void, Never>?
    private var flusso: Task<Void, Never>?

    /// Evita di rifare il giro dieci volte mentre l'utente spunta dieci cose.
    private var richiestaRitardata: Task<Void, Never>?

    init(deposito: Deposito, client: ClientAPI = .condiviso) {
        self.deposito = deposito
        self.client = client
    }

    // MARK: - Ingresso

    /// Sincronizza adesso.
    func sincronizza() {
        guard sincronizzazioneInCorso == nil else { return }

        sincronizzazioneInCorso = Task { [weak self] in
            guard let self else { return }
            await self.giroCompleto()
            self.sincronizzazioneInCorso = nil
        }
    }

    /// Sincronizza fra poco, accorpando le chiamate ravvicinate.
    func sincronizzaFraPoco(secondi: Double = 1.2) {
        richiestaRitardata?.cancel()
        richiestaRitardata = Task { [weak self] in
            try? await Task.sleep(for: .seconds(secondi))
            guard !Task.isCancelled else { return }
            self?.sincronizza()
        }
    }

    private func giroCompleto() async {
        stato = .inCorso

        do {
            try await push()
            try await pull()
            try await aggiornaContenuti()

            deposito.stato.ultimaSincronizzazione = Date()
            deposito.salvaSoltanto()
            stato = .completata(Date())
        } catch let errore as ErroreNina {
            // Offline non è un errore da mostrare: è la condizione normale di
            // un'app che funziona anche senza rete.
            stato = errore.definitivo ? .errore(errore.localizedDescription) : .ferma
        } catch {
            stato = .errore("Sincronizzazione non riuscita.")
        }
    }

    // MARK: - Push

    private func push() async throws {
        let daInviare = deposito.daInviare()
        guard !daInviare.isEmpty else { return }

        // A lotti: il server ne accetta 200 per volta.
        for lotto in daInviare.chunked(into: 100) {
            let modifiche = lotto.compactMap { oggetto -> ModificaDaInviare? in
                guard let (entita, dati) = Traduttore.perInvio(oggetto) else { return nil }
                return ModificaDaInviare(
                    entity: entita,
                    id: oggetto.id,
                    baseVersion: oggetto.version,
                    clientUpdatedAt: CalendarioNina.iso(da: oggetto.clientUpdatedAt),
                    data: dati
                )
            }

            guard !modifiche.isEmpty else { continue }

            let risposta: RispostaPush = try await client.richiesta(
                .post, "sync/push", corpo: RichiestaPush(changes: modifiche)
            )

            applica(esiti: risposta.results)
            deposito.stato.cursore = max(deposito.stato.cursore, risposta.cursor)
        }

        deposito.salvaSoltanto()
    }

    private func applica(esiti: [EsitoModifica]) {
        for esito in esiti {
            // In ogni caso la modifica non è più "da inviare": o è stata
            // accettata, o il server ha detto l'ultima parola. Ritentare
            // all'infinito una modifica rifiutata è il modo migliore per
            // bloccare la coda per sempre.
            if let oggetto = trova(entita: esito.entity, id: esito.id) {
                oggetto.daInviare = false
            }

            if esito.outcome == "rejected" {
                conflittiRisolti += 1
            }

            // La riga autorevole restituita dal server sovrascrive la copia locale.
            if let server = esito.server, !server.eNullo {
                Traduttore.applica(entita: esito.entity, dati: server, deposito: deposito)
            }
        }
        deposito.salvaSoltanto()
    }

    // MARK: - Pull

    private func pull() async throws {
        var cursore = deposito.stato.cursore
        var altre = true
        var giri = 0

        // Il limite di giri protegge da un ciclo infinito se il server
        // continuasse a dire "ce n'è ancora" senza avanzare il cursore.
        while altre && giri < 100 {
            giri += 1

            let risposta: RispostaModifiche = try await client.richiesta(
                .get, "sync/changes",
                query: ["since": String(cursore), "limit": "200"]
            )

            for modifica in risposta.changes {
                Traduttore.applica(entita: modifica.entity, dati: modifica.data, deposito: deposito)
            }

            guard risposta.cursor > cursore || !risposta.hasMore else { break }
            cursore = risposta.cursor
            altre = risposta.hasMore
        }

        deposito.stato.cursore = cursore
        deposito.salvaSoltanto()
    }

    private func trova(entita: String, id: UUID) -> (any Sincronizzabile)? {
        Traduttore.trova(entita: entita, id: id, contesto: deposito.contesto)
    }

    // MARK: - Contenuti (frasi e self care)

    /// Scarica frasi e idee, così l'app funziona anche senza rete.
    private func aggiornaContenuti() async throws {
        let ultimo = deposito.stato.ultimoAggiornamentoContenuti
        let query = ultimo.map { ["since": CalendarioNina.iso(da: $0)] } ?? [:]

        let frasi: ElencoFrasi = try await client.richiesta(.get, "quotes", query: query)
        for dto in frasi.items {
            if let esistente = trovaFrase(id: dto.id) {
                esistente.testo = dto.text
                esistente.autore = dto.author
                esistente.fonte = dto.source
                esistente.attiva = dto.isActive
                esistente.preferita = dto.isFavorite ?? esistente.preferita
            } else {
                deposito.contesto.insert(FraseSalvata(
                    id: dto.id, testo: dto.text, autore: dto.author, fonte: dto.source,
                    lingua: dto.language, attiva: dto.isActive, preferita: dto.isFavorite ?? false
                ))
            }
        }

        let idee: ElencoIdee = try await client.richiesta(.get, "self-care", query: query)
        for dto in idee.items {
            if let esistente = trovaIdea(id: dto.id) {
                esistente.titolo = dto.title
                esistente.dettaglio = dto.description
                esistente.categoriaGrezza = dto.category.rawValue
                esistente.minuti = dto.durationMin
                esistente.attiva = dto.isActive
            } else {
                deposito.contesto.insert(IdeaSelfCare(
                    id: dto.id, titolo: dto.title, dettaglio: dto.description,
                    categoria: dto.category.rawValue, minuti: dto.durationMin, attiva: dto.isActive
                ))
            }
        }

        deposito.stato.ultimoAggiornamentoContenuti = Date()
        deposito.salvaSoltanto()
    }

    private func trovaFrase(id: UUID) -> FraseSalvata? {
        let richiesta = FetchDescriptor<FraseSalvata>(predicate: #Predicate { $0.id == id })
        return try? deposito.contesto.fetch(richiesta).first
    }

    private func trovaIdea(id: UUID) -> IdeaSelfCare? {
        let richiesta = FetchDescriptor<IdeaSelfCare>(predicate: #Predicate { $0.id == id })
        return try? deposito.contesto.fetch(richiesta).first
    }

    // MARK: - Tempo reale

    /// Apre il flusso di eventi e sincronizza quando arriva una notifica.
    func avviaFlusso() {
        flusso?.cancel()
        flusso = Task { [weak self] in
            guard let self else { return }

            // Riconnessione con attesa crescente: se il server è giù non lo si
            // martella, ma appena torna la riconnessione è rapida.
            var attesa: UInt64 = 2
            while !Task.isCancelled {
                do {
                    for try await evento in FlussoEventi(client: self.client).eventi() {
                        attesa = 2
                        if case .cambiato = evento {
                            self.sincronizzaFraPoco(secondi: 0.4)
                        }
                    }
                } catch {
                    // Connessione caduta: si riprova.
                }

                guard !Task.isCancelled else { return }
                try? await Task.sleep(for: .seconds(attesa))
                attesa = min(attesa * 2, 60)
            }
        }
    }

    func fermaFlusso() {
        flusso?.cancel()
        flusso = nil
    }
}

// MARK: - Utilità

extension Array {
    func chunked(into dimensione: Int) -> [[Element]] {
        guard dimensione > 0 else { return [self] }
        return stride(from: 0, to: count, by: dimensione).map {
            Array(self[$0..<Swift.min($0 + dimensione, count)])
        }
    }
}
