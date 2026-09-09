// FILE: ios/Nina/DesignSystem/Tipografia.swift
//
// La scala tipografica.
//
// Due famiglie, con ruoli distinti:
//
//   · rounded  — tutta l'interfaccia. È il sistema di Apple con il disegno
//                arrotondato: amichevole senza essere infantile, e soprattutto
//                nativo, quindi supporta Dynamic Type e le lingue che un font
//                scaricato di solito rompe.
//
//   · serif    — solo le frasi motivazionali e i titoli del diario. Il serif
//                cambia registro: quello che è scritto in serif *sembra* una
//                citazione, prima ancora di essere letto.
//
// Tutti gli stili passano da `.relativeTo`, quindi crescono con le impostazioni
// di accessibilità del dispositivo invece di restare fissi.

import SwiftUI

enum Tipo {

    // MARK: - Interfaccia

    /// Titolo grande di una schermata. "Buongiorno, Marti".
    static let titolone = Font.system(.largeTitle, design: .rounded, weight: .bold)

    /// Titolo di sezione.
    static let titolo = Font.system(.title2, design: .rounded, weight: .bold)

    /// Sottotitolo, intestazione di gruppo.
    static let sottotitolo = Font.system(.headline, design: .rounded, weight: .semibold)

    /// Testo normale.
    static let corpo = Font.system(.body, design: .rounded)

    /// Testo normale in evidenza.
    static let corpoForte = Font.system(.body, design: .rounded, weight: .semibold)

    /// Didascalie, date, note a margine.
    static let didascalia = Font.system(.subheadline, design: .rounded)

    /// Etichette piccole: badge, contatori.
    static let etichetta = Font.system(.caption, design: .rounded, weight: .semibold)

    /// Numeri grandi delle statistiche.
    static let numero = Font.system(.largeTitle, design: .rounded, weight: .heavy)

    // MARK: - Editoriale

    /// La frase del giorno. Serif, grande, con interlinea generosa.
    static let citazione = Font.system(.title, design: .serif, weight: .regular)

    /// La frase del giorno nella schermata dedicata a tutto schermo.
    static let citazioneGrande = Font.system(size: 32, weight: .regular, design: .serif)

    /// Firma dell'autore sotto la citazione.
    static let autore = Font.system(.footnote, design: .serif, weight: .medium)

    /// Titolo di una pagina di diario.
    static let titoloDiario = Font.system(.title3, design: .serif, weight: .semibold)

    /// Corpo di una pagina di diario: si legge come un quaderno, non come una app.
    static let corpoDiario = Font.system(.body, design: .serif)
}

// MARK: - Modificatori ricorrenti

extension View {
    /// Spaziatura fra le lettere per le etichette in maiuscolo.
    func maiuscoletto() -> some View {
        self
            .textCase(.uppercase)
            .tracking(1.2)
            .font(Tipo.etichetta)
    }

    /// Interlinea comoda per i testi lunghi (diario, frasi).
    func lettura() -> some View {
        self.lineSpacing(6)
    }
}
