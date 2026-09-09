// FILE: ios/NinaUITests/OnboardingUITests.swift
//
// Le prime trenta righe di testo che una persona legge di Nina.
//
// Sono anche le uniche parole dell'app che sono state scritte prima del
// codice, parola per parola. Un test che le controlla non serve a scoprire
// bug: serve a impedire che qualcuno, un giorno, le "migliori" per sbaglio
// mentre sistema un vincolo di layout.

import XCTest

final class OnboardingUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        // Riporta l'app allo stato di prima installazione: senza questo, dal
        // secondo giro in poi l'onboarding non comparirebbe più.
        app.launchArguments = ["-ninaAzzera"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testLeQuattroFrasiSonoEsattamenteQueste() {
        let frasi = [
            "Hey 💗",
            "Organizziamo insieme le tue giornate.",
            "Ti ricorderò le cose importanti.",
            "E ogni tanto ti ricorderò anche di respirare 😂",
        ]

        XCTAssertTrue(app.staticTexts[frasi[0]].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Piacere di conoscerti."].exists)

        for frase in frasi.dropFirst() {
            app.buttons["Avanti"].tap()
            XCTAssertTrue(
                app.staticTexts[frase].waitForExistence(timeout: 3),
                "manca la frase «\(frase)»"
            )
        }

        // Sull'ultima pagina il bottone cambia: non è più "Avanti".
        XCTAssertTrue(app.buttons["Iniziamo"].exists)
        XCTAssertFalse(app.buttons["Avanti"].exists)
    }

    func testSiPuoSaltareLOnboarding() {
        XCTAssertTrue(app.buttons["Salta"].waitForExistence(timeout: 5))
        app.buttons["Salta"].tap()

        // Saltando si finisce sulla schermata di accesso, non dentro l'app.
        XCTAssertTrue(app.buttons["Entra"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["Hey 💗"].exists)
    }

    func testLOnboardingNonRicompareDopoAverloVisto() {
        app.buttons["Salta"].tap()
        _ = app.wait(for: .runningForeground, timeout: 2)

        // Riavvio senza azzerare: l'onboarding è già stato visto.
        app.terminate()
        app.launchArguments = []
        app.launch()

        XCTAssertFalse(app.staticTexts["Hey 💗"].waitForExistence(timeout: 3))
    }

    func testDallUltimaPaginaSiEntraNellAccesso() {
        XCTAssertTrue(app.buttons["Avanti"].waitForExistence(timeout: 5))
        for _ in 0..<3 { app.buttons["Avanti"].tap() }
        app.buttons["Iniziamo"].tap()

        XCTAssertTrue(
            app.buttons["Entra"].waitForExistence(timeout: 5),
            "dopo l'onboarding ci si aspetta la schermata di accesso"
        )

        // E la promessa sulla riservatezza del diario è lì, prima ancora di
        // registrarsi: è una cosa che si decide guardando, non dopo.
        XCTAssertTrue(
            app.staticTexts.containing(
                NSPredicate(format: "label CONTAINS[c] %@", "Il diario non lo legge nessuno")
            ).firstMatch.exists
        )
    }
}
