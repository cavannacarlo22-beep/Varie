// FILE: ios/Nina/Intents/IntentiNina.swift
//
// App Intents: quello che si può fare senza aprire l'app.
//
// Due usi diversi, stessi tipi:
//
//  · **i widget** — il bottone che spunta un'attività dal widget è un
//    `AppIntent`. Gira nel processo dell'app (che iOS avvia in background se
//    serve), quindi può scrivere sul database vero;
//  · **Siri e Comandi rapidi** — "Hey Siri, cosa devo fare oggi?".
//
// Regola di Apple sulle frasi: ogni frase deve contenere `\(.applicationName)`.
// Senza, la frase viene semplicemente ignorata — senza errori di compilazione
// e senza nessun avviso a runtime.

import AppIntents
import SwiftUI
import SwiftData
import WidgetKit

// MARK: - Spunta un'attività (usato dal widget)

struct SpuntaAttivita: AppIntent {
    static var title: LocalizedStringResource = "Segna come fatta"
    static var description = IntentDescription("Spunta un'attività di oggi.")

    /// Serve solo al bottone del widget: non deve comparire fra i Comandi rapidi.
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Identificativo")
    var idAttivita: String

    init() {}

    init(idAttivita: String) {
        self.idAttivita = idAttivita
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        guard let id = UUID(uuidString: idAttivita) else { return .result() }

        let deposito = Deposito()
        guard let attivita = deposito.attivita(id: id) else { return .result() }

        deposito.completa(attivita, !attivita.completata)

        // La fotografia condivisa va riscritta, altrimenti il widget continua a
        // mostrare lo stato di prima.
        DatiCondivisi.aggiorna(deposito: deposito, nome: "", frase: deposito.fraseLocale())
        WidgetCenter.shared.reloadAllTimelines()

        return .result()
    }
}

// MARK: - "Cosa devo fare oggi?"

struct CosaDevoFareOggi: AppIntent {
    static var title: LocalizedStringResource = "Cosa devo fare oggi"
    static var description = IntentDescription("Nina ti dice cosa hai in programma per oggi.")

    /// Non apre l'app: risponde e basta. È il punto di una domanda a Siri.
    static var openAppWhenRun: Bool { false }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let deposito = Deposito()
        let attivita = deposito.attivita(del: CalendarioNina.oggi)
        let daFare = attivita.filter { !$0.completata }

        if attivita.isEmpty {
            return .result(dialog: "Oggi non hai niente in lista. Goditela 😌")
        }

        if daFare.isEmpty {
            return .result(dialog: "Hai già fatto tutto quello che c'era oggi. Brava!")
        }

        // Al massimo tre: Siri legge ad alta voce, e un elenco lungo diventa
        // incomprensibile.
        let elenco = daFare.prefix(3).map { attivita -> String in
            if let ora = attivita.ora { return "\(attivita.titolo) alle \(ora)" }
            return attivita.titolo
        }

        let testo = elenco.count == 1
            ? elenco[0]
            : elenco.dropLast().joined(separator: ", ") + " e " + (elenco.last ?? "")

        let extra = daFare.count > 3 ? ", e altre \(daFare.count - 3) cose" : ""

        return .result(dialog: "Oggi ti restano: \(testo)\(extra).")
    }
}

// MARK: - Aggiungi una cosa alla lista

struct AggiungiCosa: AppIntent {
    static var title: LocalizedStringResource = "Aggiungi una cosa da fare"
    static var description = IntentDescription("Aggiunge un'attività alla lista di oggi.")
    static var openAppWhenRun: Bool { false }

    @Parameter(title: "Cosa", requestValueDialog: "Cosa devo segnare?")
    var titolo: String

    init() {}

    init(titolo: String) {
        self.titolo = titolo
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let testo = titolo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !testo.isEmpty else {
            return .result(dialog: "Non ho capito cosa segnare.")
        }

        let deposito = Deposito()
        deposito.creaAttivita(titolo: testo, giorno: CalendarioNina.oggi, categoria: .personale)

        DatiCondivisi.aggiorna(deposito: deposito, nome: "", frase: deposito.fraseLocale())
        WidgetCenter.shared.reloadAllTimelines()

        return .result(dialog: "Fatto, l'ho segnata 💗")
    }
}

// MARK: - Completa la prossima attività

struct CompletaProssima: AppIntent {
    static var title: LocalizedStringResource = "Segna fatta la prossima attività"
    static var description = IntentDescription("Spunta la prima cosa non ancora fatta di oggi.")
    static var openAppWhenRun: Bool { false }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let deposito = Deposito()

        // "La prossima" è la prima non fatta in ordine di orario: le attività
        // senza orario vanno in fondo, come nell'elenco dell'app.
        let candidate = deposito.attivita(del: CalendarioNina.oggi)
            .filter { !$0.completata }
            .sorted { ($0.ora ?? "99:99") < ($1.ora ?? "99:99") }

        guard let prossima = candidate.first else {
            return .result(dialog: "Non è rimasto niente da fare oggi 🎉")
        }

        deposito.completa(prossima, true)
        DatiCondivisi.aggiorna(deposito: deposito, nome: "", frase: deposito.fraseLocale())
        WidgetCenter.shared.reloadAllTimelines()

        let rimaste = candidate.count - 1
        let coda = rimaste == 0
            ? " E con questa hai finito 🎉"
            : (rimaste == 1 ? " Ne resta una." : " Ne restano \(rimaste).")

        return .result(dialog: "Segnata: \(prossima.titolo).\(coda)")
    }
}

// MARK: - Registra il mood

struct RegistraMood: AppIntent {
    static var title: LocalizedStringResource = "Registra come sto"
    static var description = IntentDescription("Salva il tuo mood di oggi.")
    static var openAppWhenRun: Bool { false }

    @Parameter(title: "Come stai", requestValueDialog: "Come stai oggi?")
    var mood: MoodScelto

    init() {}

    init(mood: MoodScelto) {
        self.mood = mood
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let deposito = Deposito()
        deposito.registra(umore: mood.valore, nota: nil)

        let risposta = mood.valore.difficile ? VoceDiNina.moodDifficile() : VoceDiNina.moodPositivo()
        return .result(dialog: IntentDialog(stringLiteral: risposta))
    }
}

/// I mood come opzioni selezionabili da Siri e dai Comandi rapidi.
enum MoodScelto: String, AppEnum {
    case fantastica, bene, cosiCosi, stanca, giu, nervosa

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Mood"

    static var caseDisplayRepresentations: [MoodScelto: DisplayRepresentation] = [
        .fantastica: "Fantastica",
        .bene: "Bene",
        .cosiCosi: "Così così",
        .stanca: "Stanca",
        .giu: "Giù",
        .nervosa: "Nervosa",
    ]

    var valore: MoodKind {
        switch self {
        case .fantastica: .fantastica
        case .bene: .bene
        case .cosiCosi: .cosiCosi
        case .stanca: .stanca
        case .giu: .giu
        case .nervosa: .nervosa
        }
    }
}

// MARK: - Frasi per Siri

struct ScorciatoieNina: AppShortcutsProvider {

    /// Ogni frase deve contenere `\(.applicationName)`: è un requisito di
    /// Apple, e senza di esso la frase viene ignorata in silenzio.
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CosaDevoFareOggi(),
            phrases: [
                "Cosa devo fare oggi su \(.applicationName)",
                "Cosa ho in programma su \(.applicationName)",
                "Chiedi a \(.applicationName) cosa devo fare",
            ],
            shortTitle: "Cosa devo fare oggi",
            systemImageName: "checklist"
        )

        AppShortcut(
            intent: AggiungiCosa(),
            phrases: [
                "Aggiungi una cosa su \(.applicationName)",
                "Segna una cosa da fare su \(.applicationName)",
            ],
            shortTitle: "Aggiungi una cosa",
            systemImageName: "plus.circle"
        )

        AppShortcut(
            intent: CompletaProssima(),
            phrases: [
                "Segna completata la prossima attività su \(.applicationName)",
                "Ho finito una cosa su \(.applicationName)",
            ],
            shortTitle: "Segna fatta la prossima",
            systemImageName: "checkmark.circle"
        )

        AppShortcut(
            intent: RegistraMood(),
            phrases: [
                "Registra come sto su \(.applicationName)",
                "Segna il mio mood su \(.applicationName)",
            ],
            shortTitle: "Come sto oggi",
            systemImageName: "face.smiling"
        )
    }
}
