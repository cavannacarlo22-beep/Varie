// FILE: ios/NinaTests/TraduttoreTests.swift
//
// La conversione fra i modelli locali e il JSON della sincronizzazione.
//
// È il file più noioso del progetto ed è quello dove un errore si paga di più:
// un campo dimenticato non dà nessun errore, semplicemente non si sincronizza,
// e ce ne si accorge settimane dopo — sull'iPad, quando manca una nota.
//
// Questi test fanno il giro completo: oggetto locale → JSON → oggetto locale.
// Se un campo si perde per strada, il confronto lo dice subito.

import XCTest
import SwiftData
@testable import Nina

@MainActor
final class TraduttoreTests: XCTestCase {

    private var deposito: Deposito!

    override func setUp() async throws {
        try await super.setUp()
        deposito = Deposito(inMemoria: true)
    }

    override func tearDown() async throws {
        deposito = nil
        try await super.tearDown()
    }

    /// Prende ciò che il dispositivo invierebbe e ci aggiunge i campi che il
    /// server mette di suo, ottenendo una riga identica a quella che
    /// tornerebbe indietro da `GET /sync/changes`.
    private func comeTornaDalServer(
        _ oggetto: any Sincronizzabile,
        versione: Int = 2,
        sequenza: Int = 17
    ) throws -> (String, JSONValue) {
        let (entita, dati) = try XCTUnwrap(Traduttore.perInvio(oggetto))
        guard case .oggetto(var campi) = dati else {
            XCTFail("perInvio non ha prodotto un oggetto JSON")
            return (entita, dati)
        }

        campi["id"] = .stringa(oggetto.id.uuidString.lowercased())
        campi["version"] = .numero(Double(versione))
        campi["syncSeq"] = .numero(Double(sequenza))
        campi["clientUpdatedAt"] = .stringa(CalendarioNina.iso(da: oggetto.clientUpdatedAt))

        return (entita, .oggetto(campi))
    }

    // MARK: - Andata e ritorno

    func testUnAttivitaFaIlGiroCompletoSenzaPerdereNiente() throws {
        let attivita = deposito.creaAttivita(
            titolo: "Palestra con Sara",
            giorno: "2026-09-09",
            ora: "18:30",
            categoria: .sport,
            priorita: .high,
            note: "portare l'asciugamano",
            ripetizione: .custom,
            giorniRipetizione: [1, 3, 5],
            notificaAttiva: true,
            minutiPrima: 30
        )
        deposito.completa(attivita, true)

        let (entita, dati) = try comeTornaDalServer(attivita)
        XCTAssertEqual(entita, Traduttore.entitaAttivita)

        // Si cancella la copia locale e si ricostruisce solo dal JSON: se un
        // campo non fosse nel JSON, qui sparirebbe.
        let id = attivita.id
        deposito.svuota()
        Traduttore.applica(entita: entita, dati: dati, deposito: deposito)

        let tornata = try XCTUnwrap(deposito.attivita(id: id))
        XCTAssertEqual(tornata.titolo, "Palestra con Sara")
        XCTAssertEqual(tornata.giorno, "2026-09-09")
        XCTAssertEqual(tornata.ora, "18:30")
        XCTAssertEqual(tornata.categoria, .sport)
        XCTAssertEqual(tornata.priorita, .high)
        XCTAssertEqual(tornata.note, "portare l'asciugamano")
        XCTAssertEqual(tornata.ripetizione, .custom)
        XCTAssertEqual(tornata.giorniRipetizione, [1, 3, 5])
        XCTAssertTrue(tornata.notificaAttiva)
        XCTAssertEqual(tornata.minutiPrima, 30)
        XCTAssertTrue(tornata.completata)
        XCTAssertNotNil(tornata.completataIl)
    }

    func testUnaPaginaDiDiarioFaIlGiroCompleto() throws {
        let pagina = deposito.creaPagina(
            titolo: "Mercoledì",
            contenuto: "Oggi è stata una giornata strana ma va bene così.",
            umore: .cosiCosi,
            giorno: "2026-09-09"
        )

        let (entita, dati) = try comeTornaDalServer(pagina)
        let id = pagina.id
        deposito.svuota()
        Traduttore.applica(entita: entita, dati: dati, deposito: deposito)

        let tornata = try XCTUnwrap(deposito.pagineDiario().first { $0.id == id })
        XCTAssertEqual(tornata.titolo, "Mercoledì")
        XCTAssertEqual(tornata.contenuto, "Oggi è stata una giornata strana ma va bene così.")
        XCTAssertEqual(tornata.umore, .cosiCosi)
        XCTAssertEqual(tornata.giorno, "2026-09-09")
    }

    func testUnDesiderioConservaIlPrezzo() throws {
        let desiderio = deposito.creaDesiderio(
            titolo: "Cuffie", prezzo: 79.9, categoria: .tech,
            link: "https://example.com/cuffie", dettaglio: "quelle rosa"
        )

        let (entita, dati) = try comeTornaDalServer(desiderio)
        let id = desiderio.id
        deposito.svuota()
        Traduttore.applica(entita: entita, dati: dati, deposito: deposito)

        let tornato = try XCTUnwrap(deposito.desideri().first { $0.id == id })
        XCTAssertEqual(tornato.titolo, "Cuffie")
        XCTAssertEqual(tornato.prezzo ?? 0, 79.9, accuracy: 0.001)
        XCTAssertEqual(tornato.categoria, .tech)
        XCTAssertEqual(tornato.linkProdotto, "https://example.com/cuffie")
    }

    // MARK: - I campi comuni

    func testDopoAverRicevutoDalServerLOggettoNonEPiuDaInviare() throws {
        let attivita = deposito.creaAttivita(titolo: "Cosa", giorno: "2026-09-09")
        XCTAssertTrue(attivita.daInviare)

        let (entita, dati) = try comeTornaDalServer(attivita, versione: 5, sequenza: 99)
        Traduttore.applica(entita: entita, dati: dati, deposito: deposito)

        // La copia locale *è* quella del server: rimandarla indietro
        // significherebbe fare un giro infinito di scritture identiche.
        XCTAssertFalse(attivita.daInviare)
        XCTAssertEqual(attivita.version, 5)
        XCTAssertEqual(attivita.syncSeq, 99)
    }

    func testUnaCancellazioneArrivataDalServerSiVede() throws {
        let attivita = deposito.creaAttivita(titolo: "Cancellata altrove", giorno: "2026-09-09")
        let id = attivita.id

        var (entita, dati) = try comeTornaDalServer(attivita)
        if case .oggetto(var campi) = dati {
            campi["deletedAt"] = .stringa(CalendarioNina.iso(da: Date()))
            dati = .oggetto(campi)
        }
        Traduttore.applica(entita: entita, dati: dati, deposito: deposito)

        XCTAssertNotNil(attivita.deletedAt)
        XCTAssertFalse(deposito.attivita(del: "2026-09-09").contains { $0.id == id })
    }

    func testUnaRigaSenzaIdVieneIgnorataSenzaRompereNiente() {
        // Difesa contro una risposta malformata: meglio saltare una riga che
        // far cadere tutta la sincronizzazione.
        Traduttore.applica(
            entita: Traduttore.entitaAttivita,
            dati: .oggetto(["title": .stringa("Senza id")]),
            deposito: deposito
        )
        XCTAssertEqual(deposito.attivita(del: "2026-09-09").count, 0)
    }

    func testUnEntitaSconosciutaNonFaNiente() {
        Traduttore.applica(
            entita: "qualcosaCheNonEsiste",
            dati: .oggetto(["id": .stringa(UUID().uuidString.lowercased())]),
            deposito: deposito
        )
        XCTAssertEqual(deposito.modificheInAttesa, 0)
    }

    func testApplicareDueVolteLaStessaRigaNonCreaUnDoppione() throws {
        let attivita = deposito.creaAttivita(titolo: "Una sola", giorno: "2026-09-09")
        let (entita, dati) = try comeTornaDalServer(attivita)

        Traduttore.applica(entita: entita, dati: dati, deposito: deposito)
        Traduttore.applica(entita: entita, dati: dati, deposito: deposito)

        // La sincronizzazione può consegnare la stessa riga più volte (una
        // riconnessione, un cursore riavvolto): deve essere idempotente.
        XCTAssertEqual(deposito.attivita(del: "2026-09-09").count, 1)
    }

    // MARK: - Nomi delle entità

    func testINomiDelleEntitaCorrispondonoAQuelliDelBackend() {
        // Questi nomi sono un contratto con il backend
        // (backend/src/repositories/entities.ts). Un refuso qui significa che
        // un'intera categoria di dati non si sincronizza, in silenzio.
        XCTAssertEqual(Traduttore.entitaAttivita, "tasks")
        XCTAssertEqual(Traduttore.entitaAbitudini, "habits")
        XCTAssertEqual(Traduttore.entitaCompletamenti, "habitCompletions")
        XCTAssertEqual(Traduttore.entitaUmori, "moods")
        XCTAssertEqual(Traduttore.entitaDiario, "diaryEntries")
        XCTAssertEqual(Traduttore.entitaDesideri, "wishlist")
        XCTAssertEqual(Traduttore.entitaNote, "quickNotes")
        XCTAssertEqual(Traduttore.entitaMessaggi, "friendMessages")
        XCTAssertEqual(Traduttore.entitaImpostazioni, "userSettings")
    }
}
