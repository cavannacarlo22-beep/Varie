// FILE: ios/NinaTests/VoceDiNinaTests.swift
//
// Il tono dell'app.
//
// Sembra la cosa meno testabile del progetto, e invece le promesse che Nina fa
// sul suo modo di parlare sono verificabili quasi tutte: che le frasi siano
// tante, che non si ripetano subito, che diano sempre del tu, che il saluto
// corrisponda all'ora, e che nei momenti difficili non arrivi una battuta.
//
// L'ultimo punto è il più importante. Un'app che risponde "Evvai 😄" a
// qualcuno che ha appena scritto di stare male non è simpatica: è sorda.

import XCTest
@testable import Nina

final class VoceDiNinaTests: XCTestCase {

    override func setUp() {
        super.setUp()
        VoceDiNina.dimenticaLeUltimeFrasi()
    }

    /// Tutte le frasi che ogni generatore può produrre, raccolte chiamandolo
    /// molte volte. La scelta è casuale: con 120 estrazioni la probabilità di
    /// non vedere una variante di un elenco da dieci è circa tre su un
    /// milione. Erano 300, ma l'intera suite ci metteva nove minuti.
    private func repertorio(_ genera: () -> String, giri: Int = 120) -> Set<String> {
        Set((0..<giri).map { _ in genera() })
    }

    // MARK: - Quantità

    func testCiSonoAlmenoCinquantaFrasiDiverse() {
        var tutte: Set<String> = []

        tutte.formUnion(repertorio { VoceDiNina.buongiorno(nome: "Anna", ora: 8) })
        tutte.formUnion(repertorio { VoceDiNina.buongiorno(nome: "Anna", ora: 12) })
        tutte.formUnion(repertorio { VoceDiNina.buongiorno(nome: "Anna", ora: 16) })
        tutte.formUnion(repertorio { VoceDiNina.buongiorno(nome: "Anna", ora: 21) })
        tutte.formUnion(repertorio { VoceDiNina.buongiorno(nome: "Anna", ora: 2) })
        tutte.formUnion(repertorio(VoceDiNina.attivitaFatta))
        tutte.formUnion(repertorio(VoceDiNina.tutteFatte))
        tutte.formUnion(repertorio { VoceDiNina.rimaste(1) })
        tutte.formUnion(repertorio { VoceDiNina.rimaste(3) })
        tutte.formUnion(repertorio { VoceDiNina.rimaste(9) })
        tutte.formUnion(repertorio(VoceDiNina.attivitaScaduta))
        tutte.formUnion(repertorio { VoceDiNina.streak(1) })
        tutte.formUnion(repertorio { VoceDiNina.streak(4) })
        tutte.formUnion(repertorio { VoceDiNina.streak(10) })
        tutte.formUnion(repertorio { VoceDiNina.streak(60) })
        tutte.formUnion(repertorio(VoceDiNina.streakInterrotto))
        tutte.formUnion(repertorio(VoceDiNina.moodPositivo))
        tutte.formUnion(repertorio(VoceDiNina.moodDifficile))
        tutte.formUnion(repertorio { VoceDiNina.riepilogoSera(completate: 0, rimaste: 0) })
        tutte.formUnion(repertorio { VoceDiNina.riepilogoSera(completate: 3, rimaste: 0) })
        tutte.formUnion(repertorio { VoceDiNina.riepilogoSera(completate: 0, rimaste: 4) })
        tutte.formUnion(repertorio { VoceDiNina.riepilogoSera(completate: 2, rimaste: 2) })
        tutte.formUnion(repertorio(VoceDiNina.inviteSelfCare))
        tutte.formUnion(repertorio(VoceDiNina.incoraggiamento))
        tutte.formUnion(repertorio(VoceDiNina.nienteAttivitaOggi))
        tutte.formUnion(repertorio(VoceDiNina.erroreGentile))
        tutte.formUnion(repertorio(VoceDiNina.offline))

        // Il requisito è cinquanta. Se un giorno qualcuno "semplifica" il file
        // togliendo varianti, questo test lo ferma.
        XCTAssertGreaterThanOrEqual(tutte.count, 50, "solo \(tutte.count) frasi diverse")
    }

    func testNessunaFraseEVuota() {
        let generatori: [() -> String] = [
            { VoceDiNina.buongiorno(nome: "Anna", ora: 9) },
            VoceDiNina.attivitaFatta, VoceDiNina.tutteFatte, VoceDiNina.attivitaScaduta,
            VoceDiNina.streakInterrotto, VoceDiNina.moodPositivo, VoceDiNina.moodDifficile,
            VoceDiNina.inviteSelfCare, VoceDiNina.incoraggiamento, VoceDiNina.nienteAttivitaOggi,
            VoceDiNina.nienteAbitudini, VoceDiNina.nienteDiario, VoceDiNina.nienteWishlist,
            VoceDiNina.nienteNote, VoceDiNina.erroreGentile, VoceDiNina.offline,
        ]

        for genera in generatori {
            for frase in repertorio(genera, giri: 30) {
                XCTAssertFalse(frase.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    // MARK: - Varietà

    func testNonRipeteMaiLaStessaFraseDueVolteDiFila() {
        // Una frase che si ripete subito fa capire che dietro c'è un elenco, e
        // rompe l'illusione che sia qualcuno a parlare.
        var precedente = ""
        for _ in 0..<60 {
            let frase = VoceDiNina.attivitaFatta()
            XCTAssertNotEqual(frase, precedente, "ripetuta due volte di fila")
            precedente = frase
        }
    }

    func testCategorieDiverseNonSiDisturbano() {
        // La memoria dell'ultima frase è per categoria: alternare due
        // generatori non deve impedire a nessuno dei due di variare.
        var fatte: Set<String> = []
        var scadute: Set<String> = []
        for _ in 0..<60 {
            fatte.insert(VoceDiNina.attivitaFatta())
            scadute.insert(VoceDiNina.attivitaScaduta())
        }
        XCTAssertGreaterThan(fatte.count, 1)
        XCTAssertGreaterThan(scadute.count, 1)
    }

    // MARK: - Il saluto segue l'ora

    func testIlSalutoCambiaConLOra() {
        // Cinque fasce (mattina, mezzogiorno, pomeriggio, sera, notte), cinque
        // repertori distinti: se due ore diverse pescassero dallo stesso
        // elenco, una delle fasce non esisterebbe davvero.
        let repertori = [8, 12, 16, 21, 2].map { ora in
            repertorio({ VoceDiNina.buongiorno(nome: "Anna", ora: ora) }, giri: 200)
        }

        XCTAssertEqual(Set(repertori).count, 5)

        // E non si sovrappongono nemmeno in parte: nessuna frase di notte può
        // comparire di mattina.
        for (indice, primo) in repertori.enumerated() {
            for secondo in repertori[(indice + 1)...] {
                XCTAssertTrue(primo.isDisjoint(with: secondo))
            }
        }
    }

    func testAlleDueDiNotteNonDiceBuongiorno() {
        for _ in 0..<50 {
            let frase = VoceDiNina.buongiorno(nome: "Anna", ora: 2).lowercased()
            XCTAssertFalse(frase.contains("buongiorno"), frase)
        }
    }

    func testIlSalutoUsaIlNome() {
        // Almeno una variante per fascia deve chiamare la persona per nome:
        // è metà del motivo per cui l'onboarding lo chiede.
        for ora in [8, 12, 16, 21] {
            let frasi = repertorio({ VoceDiNina.buongiorno(nome: "Ludovica", ora: ora) }, giri: 200)
            XCTAssertTrue(frasi.contains { $0.contains("Ludovica") }, "fascia delle \(ora)")
        }
    }

    // MARK: - Il conteggio compare nel testo

    func testQuandoDiceUnNumeroEQuelloGiusto() {
        // Questo test è nato sbagliato: pretendeva che *ogni* frase citasse il
        // numero. Ma «Oggi la lista è lunga. Partiamo dalla prima.» esiste
        // apposta per non dirlo — quando le cose sono tante, sbatterle in
        // faccia non aiuta nessuno.
        //
        // La promessa vera è più stretta e più utile: se un numero compare,
        // è quello giusto. Una frase che dicesse «ancora 3 cose» quando sono
        // sette sarebbe un difetto grave; una che non le conta affatto, no.
        for quante in [1, 2, 3, 5, 12, 30] {
            for _ in 0..<40 {
                let frase = VoceDiNina.rimaste(quante)
                for gruppo in frase.split(whereSeparator: { !$0.isNumber }) {
                    XCTAssertEqual(
                        Int(gruppo), quante,
                        "«\(frase)» cita un numero diverso da \(quante)"
                    )
                }
            }
        }
    }

    func testAlmenoUnaVarianteIlNumeroLoDice() {
        // L'altra metà: se nessuna variante lo citasse mai, l'informazione
        // utile andrebbe persa e resterebbero solo incoraggiamenti generici.
        for quante in [2, 3, 5, 12] {
            let frasi = Set((0..<200).map { _ in VoceDiNina.rimaste(quante) })
            XCTAssertTrue(
                frasi.contains { $0.contains("\(quante)") },
                "nessuna delle varianti per \(quante) cose dice quante sono"
            )
        }
    }

    func testUnaSolaCosaRimastaNonDiceUno() {
        // "Ne manca 1" è da robot. Al singolare si scrive a parole.
        for _ in 0..<20 {
            let frase = VoceDiNina.rimaste(1)
            XCTAssertFalse(frase.contains("1 "), frase)
        }
    }

    // MARK: - Il tono

    func testDaSempreDelTuENonDiceMaiUtente() {
        let vietate = ["utente", "elemento", "operazione", "task", "item", "errore di sistema"]
        var tutte: Set<String> = []

        tutte.formUnion(repertorio(VoceDiNina.attivitaFatta))
        tutte.formUnion(repertorio(VoceDiNina.tutteFatte))
        tutte.formUnion(repertorio(VoceDiNina.attivitaScaduta))
        tutte.formUnion(repertorio(VoceDiNina.erroreGentile))
        tutte.formUnion(repertorio(VoceDiNina.offline))
        tutte.formUnion(repertorio(VoceDiNina.incoraggiamento))
        tutte.formUnion(repertorio { VoceDiNina.rimaste(4) })

        for frase in tutte {
            for parola in vietate {
                XCTAssertFalse(frase.lowercased().contains(parola), "«\(frase)» contiene «\(parola)»")
            }
        }
    }

    func testNeiMomentiDifficiliNonScherza() {
        // Un mood brutto, una serie interrotta, una giornata in cui non è
        // andato niente: qui l'ironia è fuori posto. Le frasi devono restare
        // gentili, e soprattutto non devono mai suonare come un rimprovero.
        var tutte: Set<String> = []
        tutte.formUnion(repertorio(VoceDiNina.moodDifficile))
        tutte.formUnion(repertorio(VoceDiNina.streakInterrotto))
        tutte.formUnion(repertorio { VoceDiNina.riepilogoSera(completate: 0, rimaste: 5) })

        let colpevolizzanti = ["dovevi", "avresti dovuto", "colpa", "fallit", "pigr", "😂", "🤣"]
        for frase in tutte {
            for parola in colpevolizzanti {
                XCTAssertFalse(
                    frase.lowercased().contains(parola),
                    "«\(frase)» contiene «\(parola)», che in un momento storto non ci va"
                )
            }
        }
    }

    func testIlDiarioPrometteRiservatezza() {
        // Questa frase è una promessa esplicita all'utente, ed è mantenuta dal
        // backend (vedi backend/tests/integration/privacy.test.ts). Se un
        // giorno la promessa cambiasse, questo test costringerebbe a
        // cambiarla anche qui invece di lasciarla scritta e falsa.
        XCTAssertTrue(VoceDiNina.nienteDiario().lowercased().contains("nessuno lo legge"))
    }
}
