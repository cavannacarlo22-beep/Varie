// FILE: ios/Nina/DesignSystem/Spazi.swift
//
// Spaziature e raggi.
//
// Una scala sola, usata ovunque. Il motivo per cui un'interfaccia sembra
// "fatta bene" raramente è un colore o un font: è che le distanze si ripetono.
// Se un margine è 14 e quello accanto 16, l'occhio se ne accorge anche quando
// la testa non sa dire perché.

import SwiftUI
import CoreGraphics

enum Spazio {
    /// 4 — fra un'icona e la sua etichetta.
    static let minimo: CGFloat = 4
    /// 8 — fra elementi molto vicini.
    static let piccolo: CGFloat = 8
    /// 12 — dentro le card, fra righe.
    static let medio: CGFloat = 12
    /// 16 — margine standard dei contenuti.
    static let normale: CGFloat = 16
    /// 20 — padding interno delle card.
    static let comodo: CGFloat = 20
    /// 28 — fra sezioni diverse.
    static let sezione: CGFloat = 28
    /// 40 — respiro sopra e sotto le schermate.
    static let ampio: CGFloat = 40
}

enum Raggio {
    /// 10 — badge e pillole piccole.
    static let piccolo: CGFloat = 10
    /// 16 — campi di testo, righe di elenco.
    static let medio: CGFloat = 16
    /// 22 — card. Abbastanza morbido da sembrare gentile, non tondo.
    static let card: CGFloat = 22
    /// 30 — fogli e superfici grandi.
    static let grande: CGFloat = 30
}

enum Ombra {
    /// Ombra delle card. Rosata e larghissima: si vede come "profondità",
    /// non come un rettangolo grigio sotto un altro rettangolo.
    static let card = (
        colore: Color(red: 0.91, green: 0.42, blue: 0.58).opacity(0.10),
        raggio: CGFloat(18),
        y: CGFloat(8)
    )

    static let sollevata = (
        colore: Color(red: 0.91, green: 0.42, blue: 0.58).opacity(0.18),
        raggio: CGFloat(26),
        y: CGFloat(12)
    )
}

enum Durata {
    /// Micro-interazioni: la spunta di un'attività.
    static let scatto: Double = 0.22
    /// Comparse e transizioni.
    static let morbida: Double = 0.35
}

extension Animation {
    /// L'animazione predefinita di Nina: una molla appena percettibile.
    /// Nessun rimbalzo esagerato — deve sembrare reattiva, non giocattolo.
    static var nina: Animation {
        .spring(response: 0.35, dampingFraction: 0.78)
    }

    static var ninaVeloce: Animation {
        .spring(response: 0.25, dampingFraction: 0.85)
    }
}
