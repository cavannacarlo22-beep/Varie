// FILE: ios/NinaTests/SerieTests.swift
//
// Lo streak delle abitudini.
//
// Dire a qualcuno che ha perso una serie di quaranta giorni quando non è vero
// è il modo più veloce per far disinstallare un'app. Questi test coprono i
// casi in cui è facile sbagliare: la giornata in corso non ancora spuntata,
// il buco in mezzo, e il cambio dell'ora legale.

import XCTest
@testable import Nina

final class SerieTests: XCTestCase {

    /// Costruisce un insieme di giorni consecutivi che finisce nel giorno dato.
    private func giorni(_ quanti: Int, finoA fine: String) -> Set<String> {
        var risultato: Set<String> = []
        var giorno = fine
        for _ in 0..<quanti {
            risultato.insert(giorno)
            giorno = CalendarioNina.giorno(spostatoDi: -1, da: giorno)
        }
        return risultato
    }

    // MARK: - Serie in corso

    func testNessunGiornoNessunaSerie() {
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: [], oggi: "2026-09-09"), 0)
    }

    func testSoloOggi() {
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: ["2026-09-09"], oggi: "2026-09-09"), 1)
    }

    func testGiorniConsecutiviFinoAOggi() {
        let fatti = giorni(5, finoA: "2026-09-09")
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: fatti, oggi: "2026-09-09"), 5)
    }

    func testOggiNonAncoraSpuntataNonSpezzaLaSerie() {
        // Sono le nove del mattino, l'abitudine di oggi non è ancora fatta ma
        // gli ultimi quattro giorni sì. La serie è quattro, non zero: c'è
        // ancora tutto il giorno per farla, e dire zero sarebbe un rimprovero
        // ingiusto.
        let fatti = giorni(4, finoA: "2026-09-08")
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: fatti, oggi: "2026-09-09"), 4)
    }

    func testUnGiornoSaltatoSpezzaLaSerie() {
        // Fatta oggi e ieri, poi un buco l'altro ieri.
        let fatti: Set<String> = ["2026-09-09", "2026-09-08", "2026-09-06", "2026-09-05"]
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: fatti, oggi: "2026-09-09"), 2)
    }

    func testNeIeriNeOggiSignificaZero() {
        let fatti = giorni(10, finoA: "2026-09-01")
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: fatti, oggi: "2026-09-09"), 0)
    }

    func testLaSerieAttraversaIlCambioDellOraLegale() {
        // 29 marzo 2026: la notte in cui in Europa si perde un'ora. Se lo
        // spostamento fra i giorni fosse fatto sommando 86400 secondi, la
        // serie si spezzerebbe qui — una volta all'anno, per tutti.
        let fatti = giorni(6, finoA: "2026-03-31")
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: fatti, oggi: "2026-03-31"), 6)
    }

    func testLaSerieAttraversaIlCambioDiAnno() {
        let fatti = giorni(10, finoA: "2027-01-03")
        XCTAssertEqual(Serie.giorniConsecutivi(fatti: fatti, oggi: "2027-01-03"), 10)
        XCTAssertTrue(fatti.contains("2026-12-25"))
    }

    // MARK: - Record personale

    func testRecordSuUnInsiemeVuoto() {
        XCTAssertEqual(Serie.serieMassima(fatti: []), 0)
    }

    func testIlRecordELaSequenzaPiuLunga() {
        // Tre blocchi: 2 giorni, 5 giorni, 1 giorno.
        var fatti = giorni(2, finoA: "2026-09-02")
        fatti.formUnion(giorni(5, finoA: "2026-09-12"))
        fatti.insert("2026-09-20")

        XCTAssertEqual(Serie.serieMassima(fatti: fatti), 5)
    }

    func testIlRecordNonSiFaIngannareDaiDuplicati() {
        // Un insieme non ha duplicati, ma il conteggio deve partire una volta
        // sola per sequenza: se contasse da ogni giorno, un blocco di cinque
        // verrebbe misurato cinque volte (e il risultato sarebbe comunque 5,
        // ma solo per fortuna). Qui si controlla il caso in cui sbagliare si
        // vede: due blocchi attaccati a un buco di un giorno solo.
        let fatti: Set<String> = [
            "2026-09-01", "2026-09-02", "2026-09-03",
            "2026-09-05", "2026-09-06",
        ]
        XCTAssertEqual(Serie.serieMassima(fatti: fatti), 3)
    }

    func testIlRecordENonMinoreDellaSerieInCorso() {
        let fatti = giorni(7, finoA: "2026-09-09")
        let attuale = Serie.giorniConsecutivi(fatti: fatti, oggi: "2026-09-09")
        XCTAssertGreaterThanOrEqual(Serie.serieMassima(fatti: fatti), attuale)
    }
}
