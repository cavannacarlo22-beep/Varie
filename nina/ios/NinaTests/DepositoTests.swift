// FILE: ios/NinaTests/DepositoTests.swift
//
// Il magazzino locale e la coda di uscita.
//
// La promessa dell'app è: si scrive sempre, anche senza rete, e niente va
// perso. Tecnicamente quella promessa è tutta qui dentro — ogni scrittura
// locale deve alzare `daInviare`, e finché il server non conferma quel flag
// deve restare alzato. Un solo punto dimenticato e una modifica sparisce in
// silenzio, che è il modo peggiore di sparire.

import XCTest
import SwiftData
@testable import Nina

@MainActor
final class DepositoTests: XCTestCase {

    private var deposito: Deposito!

    override func setUp() async throws {
        try await super.setUp()
        // In memoria: ogni test parte da un magazzino vuoto e non tocca il
        // database vero del simulatore.
        deposito = Deposito(inMemoria: true)
    }

    override func tearDown() async throws {
        deposito = nil
        try await super.tearDown()
    }

    // MARK: - Scritture locali

    func testCreareUnAttivitaLaMetteInCoda() {
        let attivita = deposito.creaAttivita(titolo: "Comprare il latte", giorno: "2026-09-09")

        XCTAssertTrue(attivita.daInviare)
        XCTAssertEqual(deposito.modificheInAttesa, 1)
    }

    func testOgniModificaAggiornaLIstanteCheDecideIConflitti() {
        let attivita = deposito.creaAttivita(titolo: "Palestra", giorno: "2026-09-09")
        let primo = attivita.clientUpdatedAt

        // Un istante dopo, una modifica qualsiasi.
        deposito.modificaAttivita(attivita) { $0.titolo = "Palestra alle 18" }

        XCTAssertGreaterThanOrEqual(attivita.clientUpdatedAt, primo)
        XCTAssertTrue(attivita.daInviare)
    }

    func testCompletareTieneCoerentiIDueCampi() {
        let attivita = deposito.creaAttivita(titolo: "Chiamare la nonna", giorno: "2026-09-09")

        deposito.completa(attivita, true)
        XCTAssertTrue(attivita.completata)
        XCTAssertNotNil(attivita.completataIl)

        // E togliendo la spunta l'istante deve sparire: una riga completata
        // senza data di completamento (o viceversa) è uno stato che il
        // database rifiuta, e che qui non deve nemmeno formarsi.
        deposito.completa(attivita, false)
        XCTAssertFalse(attivita.completata)
        XCTAssertNil(attivita.completataIl)
    }

    func testEliminareENascondereNonCancellare() {
        let attivita = deposito.creaAttivita(titolo: "Da eliminare", giorno: "2026-09-09")
        deposito.elimina(attivita)

        // La riga resta, con `deletedAt` valorizzato: è così che la
        // cancellazione riesce a viaggiare fino all'altro dispositivo. Una
        // cancellazione vera sparirebbe dalla coda e l'iPad continuerebbe a
        // mostrare l'attività per sempre.
        XCTAssertNotNil(attivita.deletedAt)
        XCTAssertTrue(attivita.daInviare)
        XCTAssertFalse(deposito.attivita(del: "2026-09-09").contains { $0.id == attivita.id })
    }

    func testLElencoDelGiornoNonMostraLeCancellate() {
        _ = deposito.creaAttivita(titolo: "Rimane", giorno: "2026-09-09")
        let sparita = deposito.creaAttivita(titolo: "Sparisce", giorno: "2026-09-09")
        deposito.elimina(sparita)

        let elenco = deposito.attivita(del: "2026-09-09")
        XCTAssertEqual(elenco.count, 1)
        XCTAssertEqual(elenco.first?.titolo, "Rimane")
    }

    func testLIntervalloDiGiorniEInclusivo() {
        _ = deposito.creaAttivita(titolo: "Primo", giorno: "2026-09-07")
        _ = deposito.creaAttivita(titolo: "Mezzo", giorno: "2026-09-09")
        _ = deposito.creaAttivita(titolo: "Ultimo", giorno: "2026-09-11")
        _ = deposito.creaAttivita(titolo: "Fuori", giorno: "2026-09-20")

        let dentro = deposito.attivita(da: "2026-09-07", a: "2026-09-11")
        XCTAssertEqual(dentro.count, 3)
        XCTAssertFalse(dentro.contains { $0.titolo == "Fuori" })
    }

    // MARK: - Abitudini

    func testAlternaUnAbitudineAvantiEIndietro() {
        let abitudine = deposito.creaAbitudine(
            nome: "Bere acqua", icona: "💧", colore: "#F48FB1",
            frequenza: .daily, giorni: [1, 2, 3, 4, 5, 6, 7]
        )

        let spuntata = deposito.alterna(abitudine: abitudine, giorno: "2026-09-09")
        XCTAssertTrue(spuntata)
        XCTAssertEqual(deposito.completamento(abitudine: abitudine.id, giorno: "2026-09-09")?.fatta, true)

        let tolta = deposito.alterna(abitudine: abitudine, giorno: "2026-09-09")
        XCTAssertFalse(tolta)
        XCTAssertEqual(deposito.completamento(abitudine: abitudine.id, giorno: "2026-09-09")?.fatta, false)
    }

    func testAlternareNonCreaDueRighePerLoStessoGiorno() {
        let abitudine = deposito.creaAbitudine(
            nome: "Leggere", icona: "📖", colore: "#F48FB1",
            frequenza: .daily, giorni: [1, 2, 3, 4, 5, 6, 7]
        )

        // Un numero dispari di alternanze: si finisce con l'abitudine spuntata.
        for _ in 0..<5 { _ = deposito.alterna(abitudine: abitudine, giorno: "2026-09-09") }

        // Il database ha un vincolo di unicità su (abitudine, giorno): se qui
        // se ne creassero due, la sincronizzazione fallirebbe per sempre su
        // quella riga, senza che nell'app si veda niente.
        let dello9 = deposito.completamenti(abitudine: abitudine.id).filter { $0.giorno == "2026-09-09" }
        XCTAssertEqual(dello9.count, 1)
    }

    // MARK: - Mood

    func testUnSoloMoodAlGiorno() {
        deposito.registra(umore: .bene, nota: nil, giorno: "2026-09-09")
        deposito.registra(umore: .fantastica, nota: "poi è migliorata", giorno: "2026-09-09")

        let umori = deposito.umori(da: "2026-09-09", a: "2026-09-09")
        XCTAssertEqual(umori.count, 1)
        XCTAssertEqual(umori.first?.umore, .fantastica)
        XCTAssertEqual(umori.first?.nota, "poi è migliorata")
    }

    // MARK: - Note veloci

    func testUnaNotaDiventaUnAttivita() {
        let nota = deposito.creaNota("Prenotare il dentista")
        let attivita = deposito.trasformaInAttivita(nota, giorno: "2026-09-10")

        XCTAssertEqual(attivita.titolo, "Prenotare il dentista")
        XCTAssertEqual(attivita.giorno, "2026-09-10")
        XCTAssertTrue(attivita.daInviare)
        // Il collegamento serve a non ritrasformare la stessa nota due volte.
        XCTAssertEqual(nota.attivitaCollegata, attivita.id)
    }

    // MARK: - Coda di uscita

    func testLaCodaRaccoglieTuttiITipi() {
        _ = deposito.creaAttivita(titolo: "Cosa", giorno: "2026-09-09")
        _ = deposito.creaAbitudine(nome: "Abitudine", icona: "✨", colore: "#F48FB1", frequenza: .daily, giorni: [1])
        deposito.registra(umore: .bene, nota: nil, giorno: "2026-09-09")
        _ = deposito.creaPagina(titolo: nil, contenuto: "Oggi è andata bene.", umore: .bene, giorno: "2026-09-09")
        _ = deposito.creaDesiderio(titolo: "Cuffie", prezzo: 79.9, categoria: .altro, link: nil, dettaglio: nil)
        _ = deposito.creaNota("Ricordati")

        // Sei scritture di sei tipi diversi: se un tipo non finisse nella coda,
        // quel tipo semplicemente non si sincronizzerebbe mai.
        XCTAssertGreaterThanOrEqual(deposito.modificheInAttesa, 6)
    }

    func testSvuotareCancellaIDatiPersonali() {
        _ = deposito.creaAttivita(titolo: "Cosa mia", giorno: "2026-09-09")
        _ = deposito.creaPagina(titolo: nil, contenuto: "Molto privato.", umore: nil, giorno: "2026-09-09")

        deposito.svuota()

        XCTAssertTrue(deposito.attivita(del: "2026-09-09").isEmpty)
        XCTAssertTrue(deposito.pagineDiario().isEmpty)
        XCTAssertEqual(deposito.modificheInAttesa, 0)
    }

    // MARK: - Ricerca nel diario

    func testLaRicercaNelDiarioTrovaPerContenuto() {
        _ = deposito.creaPagina(titolo: "Lunedì", contenuto: "Oggi ho parlato con Giulia.", umore: nil, giorno: "2026-09-07")
        _ = deposito.creaPagina(titolo: "Martedì", contenuto: "Giornata tranquilla.", umore: nil, giorno: "2026-09-08")

        XCTAssertEqual(deposito.pagineDiario(cerca: "Giulia").count, 1)
        XCTAssertEqual(deposito.pagineDiario(cerca: "").count, 2)
    }
}
