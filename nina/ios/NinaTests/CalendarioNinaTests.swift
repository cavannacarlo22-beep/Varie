// FILE: ios/NinaTests/CalendarioNinaTests.swift
//
// Le date sono il posto dove nascono i bug che nessuno vede.
//
// Un'attività che compare il giorno prima, uno streak che si spezza a
// mezzanotte, una notifica che suona un'ora dopo il cambio dell'ora legale:
// sono tutti sintomi della stessa cosa, cioè una conversione fra "istante" e
// "giorno di calendario" fatta con leggerezza. Questi test sono la rete sotto
// quelle conversioni.

import XCTest
@testable import Nina

final class CalendarioNinaTests: XCTestCase {

    // MARK: - Andata e ritorno

    func testGiornoEDataSonoInverseUnaDellAltra() throws {
        let giorno = "2026-09-09"
        let data = try XCTUnwrap(CalendarioNina.data(daGiorno: giorno))
        XCTAssertEqual(CalendarioNina.giorno(da: data), giorno)
    }

    func testUnaDataNonValidaNonFaEsplodereNiente() {
        XCTAssertNil(CalendarioNina.data(daGiorno: "non è una data"))
        XCTAssertNil(CalendarioNina.data(daGiorno: "2026-13-45"))
        // E le funzioni che la ricevono restituiscono qualcosa di sensato
        // invece di lanciare.
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: 3, da: "boh"), "boh")
        XCTAssertEqual(CalendarioNina.giorniTra("boh", "2026-09-09"), 0)
    }

    func testLIsoFaAndataERitornoAlMillisecondo() throws {
        let originale = Date(timeIntervalSince1970: 1_789_000_000.123)
        let testo = CalendarioNina.iso(da: originale)
        let riletta = try XCTUnwrap(CalendarioNina.data(daIso: testo))

        // Tolleranza di un millesimo: il formato ISO con frazioni conserva i
        // millisecondi, non i microsecondi.
        XCTAssertEqual(riletta.timeIntervalSince1970, originale.timeIntervalSince1970, accuracy: 0.001)
    }

    func testLeggeIsoAncheSenzaMillisecondi() {
        // PostgreSQL restituisce l'una o l'altra forma a seconda della colonna:
        // se l'app ne leggesse una sola, metà delle date arriverebbe come nil.
        XCTAssertNotNil(CalendarioNina.data(daIso: "2026-09-09T08:30:00Z"))
        XCTAssertNotNil(CalendarioNina.data(daIso: "2026-09-09T08:30:00.000Z"))
    }

    // MARK: - Giorni della settimana

    func testGiornoDellaSettimanaEInFormatoIso() {
        // 1 = lunedì … 7 = domenica, come nel backend. Se qui si usasse la
        // numerazione di Foundation (1 = domenica) le abitudini ricorrenti
        // cadrebbero tutte di un giorno sbagliato.
        XCTAssertEqual(CalendarioNina.giornoSettimana(di: "2026-10-05"), 1) // lunedì
        XCTAssertEqual(CalendarioNina.giornoSettimana(di: "2026-09-09"), 3) // mercoledì
        XCTAssertEqual(CalendarioNina.giornoSettimana(di: "2026-02-28"), 6) // sabato
        XCTAssertEqual(CalendarioNina.giornoSettimana(di: "2026-02-01"), 7) // domenica
    }

    // MARK: - Spostamenti

    func testSpostamentiSemplici() {
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: 1, da: "2026-09-09"), "2026-09-10")
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: -1, da: "2026-09-09"), "2026-09-08")
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: 0, da: "2026-09-09"), "2026-09-09")
    }

    func testSpostamentoAttraversoIlCambioDiMese() {
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: 1, da: "2026-01-31"), "2026-02-01")
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: -1, da: "2026-03-01"), "2026-02-28")
    }

    func testSpostamentoAttraversoIlCambioDellOraLegale() {
        // L'ultima domenica di marzo, in Europa, ha 23 ore. Sommare 86400
        // secondi a mezzanotte del 28 darebbe le 01:00 del 29 — che formattato
        // è ancora il 29, ma il giorno dopo darebbe il 30 alle 01:00 e prima o
        // poi il conto scivola. Il calendario, invece, aggiunge *giorni*.
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: 1, da: "2026-03-28"), "2026-03-29")
        XCTAssertEqual(CalendarioNina.giorno(spostatoDi: 2, da: "2026-03-28"), "2026-03-30")
        XCTAssertEqual(CalendarioNina.giorniTra("2026-03-28", "2026-03-30"), 2)
    }

    func testUnAnnoDiSpostamentiNonPerdeMaiUnGiorno() {
        var giorno = "2026-01-01"
        for _ in 0..<365 { giorno = CalendarioNina.giorno(spostatoDi: 1, da: giorno) }
        XCTAssertEqual(giorno, "2027-01-01")
    }

    func testGiorniTra() {
        XCTAssertEqual(CalendarioNina.giorniTra("2026-09-09", "2026-09-09"), 0)
        XCTAssertEqual(CalendarioNina.giorniTra("2026-09-09", "2026-09-16"), 7)
        XCTAssertEqual(CalendarioNina.giorniTra("2026-09-16", "2026-09-09"), -7)
    }

    // MARK: - Intervalli

    func testLaSettimanaIniziaDiLunedi() {
        let settimana = CalendarioNina.settimana(contenente: "2026-09-09") // mercoledì

        XCTAssertEqual(settimana.count, 7)
        XCTAssertEqual(settimana.first, "2026-09-07") // lunedì
        XCTAssertEqual(settimana.last, "2026-09-13")  // domenica
        XCTAssertTrue(settimana.contains("2026-09-09"))
    }

    func testIlMeseContieneEsattamenteISuoiGiorni() {
        XCTAssertEqual(CalendarioNina.mese(contenente: "2026-09-09").count, 30)
        XCTAssertEqual(CalendarioNina.mese(contenente: "2026-02-10").count, 28)
        // 2028 è bisestile: se il conteggio fosse cablato a 28 questo lo direbbe.
        XCTAssertEqual(CalendarioNina.mese(contenente: "2028-02-10").count, 29)

        let settembre = CalendarioNina.mese(contenente: "2026-09-09")
        XCTAssertEqual(settembre.first, "2026-09-01")
        XCTAssertEqual(settembre.last, "2026-09-30")
    }

    func testLaGrigliaDelMeseHaSempreSettimaneComplete() {
        for giorno in ["2026-01-15", "2026-02-15", "2026-03-15", "2026-09-15", "2028-02-15"] {
            let griglia = CalendarioNina.grigliaMese(contenente: giorno)

            // Una griglia con righe incomplete disallinea le colonne dei giorni
            // della settimana: si vedrebbe subito, ed è esattamente il tipo di
            // cosa che sfugge finché non capita il mese giusto.
            XCTAssertEqual(griglia.count % 7, 0, "griglia di \(giorno)")
            XCTAssertEqual(CalendarioNina.giornoSettimana(di: griglia.first!), 1, "inizia di lunedì: \(giorno)")
            XCTAssertEqual(CalendarioNina.giornoSettimana(di: griglia.last!), 7, "finisce di domenica: \(giorno)")
        }
    }

    func testLaGrigliaDiSettembre2026() {
        let griglia = CalendarioNina.grigliaMese(contenente: "2026-09-09")

        // Settembre 2026 inizia di martedì e finisce di mercoledì: un giorno di
        // riempimento prima, quattro dopo.
        XCTAssertEqual(griglia.first, "2026-08-31")
        XCTAssertEqual(griglia.last, "2026-10-04")
        XCTAssertEqual(griglia.count, 35)
    }

    // MARK: - Testi

    func testITestiSonoInItaliano() {
        XCTAssertEqual(CalendarioNina.testoLungo("2026-09-09"), "Mercoledì 9 settembre")
        XCTAssertEqual(CalendarioNina.testoMese("2026-09-09"), "Settembre 2026")
        XCTAssertEqual(CalendarioNina.numeroDelGiorno("2026-09-09"), "9")

        let breve = CalendarioNina.testoBreve("2026-09-09")
        XCTAssertTrue(breve.hasPrefix("9 "), breve)
        XCTAssertTrue(breve.lowercased().contains("set"), breve)
    }

    func testTestoRelativo() {
        let oggi = CalendarioNina.oggi
        XCTAssertEqual(CalendarioNina.testoRelativo(oggi), "Oggi")
        XCTAssertEqual(CalendarioNina.testoRelativo(CalendarioNina.giorno(spostatoDi: 1, da: oggi)), "Domani")
        XCTAssertEqual(CalendarioNina.testoRelativo(CalendarioNina.giorno(spostatoDi: -1, da: oggi)), "Ieri")

        // Oltre la settimana si passa al formato breve, che non dice mai "Oggi".
        let lontano = CalendarioNina.testoRelativo(CalendarioNina.giorno(spostatoDi: 40, da: oggi))
        XCTAssertNotEqual(lontano, "Oggi")
        XCTAssertNotEqual(lontano, "Domani")
    }

    // MARK: - Ore

    func testCombinaGiornoEOra() throws {
        let istante = try XCTUnwrap(CalendarioNina.data(giorno: "2026-09-09", ora: "08:30"))

        XCTAssertEqual(CalendarioNina.giorno(da: istante), "2026-09-09")
        XCTAssertEqual(CalendarioNina.ora(da: istante), "08:30")
    }

    func testUnOraMalformataNonSpostaIlGiorno() throws {
        // Se il campo ora arrivasse sporco, la cosa peggiore sarebbe piazzare
        // l'attività in un altro giorno: meglio la mezzanotte di quel giorno.
        let istante = try XCTUnwrap(CalendarioNina.data(giorno: "2026-09-09", ora: "boh"))
        XCTAssertEqual(CalendarioNina.giorno(da: istante), "2026-09-09")
    }

    func testStessoMese() {
        XCTAssertTrue(CalendarioNina.eStessoMese("2026-09-01", "2026-09-30"))
        XCTAssertFalse(CalendarioNina.eStessoMese("2026-09-30", "2026-10-01"))
        XCTAssertFalse(CalendarioNina.eStessoMese("2025-09-09", "2026-09-09"))
    }
}
