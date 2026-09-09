// FILE: ios/NinaUITests/AccessibilitaUITests.swift
//
// Due controlli che valgono più di venti test di layout.
//
// Il primo: che l'app si apra davvero, in tutte e due le orientazioni, su
// iPhone e su iPad. Un test che si limita a lanciare l'app e a guardare che ci
// sia qualcosa sullo schermo intercetta i crash all'avvio, che sono la sola
// categoria di bug che rende un'app inutilizzabile al 100% degli utenti.
//
// Il secondo: che i testi principali reggano il corpo più grande. È il vero
// motivo per cui le app "belle" si rompono — un titolo scritto a 32 punti che
// diventa 58 e spinge il bottone fuori dallo schermo.

import XCTest

final class AccessibilitaUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLAppSiApreSenzaCadere() {
        let app = XCUIApplication()
        app.launchArguments = ["-ninaAzzera"]
        app.launch()

        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertTrue(app.staticTexts.firstMatch.waitForExistence(timeout: 10))
    }

    func testITestiPrincipaliRestanoVisibiliConIlCorpoGrande() {
        let app = XCUIApplication()
        app.launchArguments = [
            "-ninaAzzera",
            // La categoria di dimensione più grande fra quelle non "per
            // accessibilità": è quella che usa davvero un sacco di gente.
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryXXXL",
        ]
        app.launch()

        let titolo = app.staticTexts["Hey 💗"]
        XCTAssertTrue(titolo.waitForExistence(timeout: 5))
        XCTAssertTrue(titolo.isHittable, "il titolo esce dallo schermo con il corpo grande")

        // E il bottone deve restare raggiungibile: se finisce sotto il bordo
        // l'app diventa inutilizzabile proprio per chi ha più bisogno del
        // testo grande.
        XCTAssertTrue(app.buttons["Avanti"].isHittable)
    }

    func testLaRotazioneNonRompeLaPrimaSchermata() {
        let app = XCUIApplication()
        app.launchArguments = ["-ninaAzzera"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Hey 💗"].waitForExistence(timeout: 5))

        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.staticTexts["Hey 💗"].waitForExistence(timeout: 3))

        XCUIDevice.shared.orientation = .portrait
        XCTAssertTrue(app.staticTexts["Hey 💗"].waitForExistence(timeout: 3))
    }
}
