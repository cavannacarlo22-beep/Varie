// FILE: ios/Nina/Models/Dominio.swift
//
// I tipi del dominio.
//
// I casi corrispondono uno a uno agli enum del database (PostgreSQL) e ai
// valori accettati dalle API. Le etichette e le emoji stanno qui, accanto ai
// casi, così non esiste un posto lontano dove qualcuno può dimenticarsi di
// aggiungere la traduzione di un caso nuovo: aggiungerlo qui rompe la
// compilazione finché non è completo ovunque.

import Foundation

// MARK: - Priorità

enum TaskPriority: String, Codable, CaseIterable, Sendable, Identifiable {
    case low = "LOW"
    case medium = "MEDIUM"
    case high = "HIGH"

    var id: String { rawValue }

    var etichetta: String {
        switch self {
        case .low: "Bassa"
        case .medium: "Media"
        case .high: "Alta"
        }
    }

    var icona: String {
        switch self {
        case .low: "arrow.down"
        case .medium: "minus"
        case .high: "exclamationmark"
        }
    }
}

// MARK: - Categorie delle attività

enum TaskCategory: String, Codable, CaseIterable, Sendable, Identifiable {
    case lavoro = "LAVORO"
    case casa = "CASA"
    case personale = "PERSONALE"
    case sport = "SPORT"
    case studio = "STUDIO"
    case shopping = "SHOPPING"
    case social = "SOCIAL"
    case altro = "ALTRO"

    var id: String { rawValue }

    var etichetta: String {
        switch self {
        case .lavoro: "Lavoro"
        case .casa: "Casa"
        case .personale: "Personale"
        case .sport: "Sport"
        case .studio: "Studio"
        case .shopping: "Shopping"
        case .social: "Social"
        case .altro: "Altro"
        }
    }

    var emoji: String {
        switch self {
        case .lavoro: "💼"
        case .casa: "🏠"
        case .personale: "❤️"
        case .sport: "🏋️"
        case .studio: "📚"
        case .shopping: "🛍️"
        case .social: "👯"
        case .altro: "✨"
        }
    }

    /// Icona SF Symbols, per i posti in cui l'emoji stonerebbe (widget, elenchi densi).
    var simbolo: String {
        switch self {
        case .lavoro: "briefcase.fill"
        case .casa: "house.fill"
        case .personale: "heart.fill"
        case .sport: "figure.run"
        case .studio: "book.fill"
        case .shopping: "bag.fill"
        case .social: "person.2.fill"
        case .altro: "sparkles"
        }
    }
}

// MARK: - Ripetizioni

enum RepeatType: String, Codable, CaseIterable, Sendable, Identifiable {
    case never = "NEVER"
    case daily = "DAILY"
    case weekly = "WEEKLY"
    case monthly = "MONTHLY"
    case custom = "CUSTOM"

    var id: String { rawValue }

    var etichetta: String {
        switch self {
        case .never: "Mai"
        case .daily: "Ogni giorno"
        case .weekly: "Ogni settimana"
        case .monthly: "Ogni mese"
        case .custom: "Personalizzata"
        }
    }
}

// MARK: - Abitudini

enum HabitFrequency: String, Codable, CaseIterable, Sendable, Identifiable {
    case daily = "DAILY"
    case weekly = "WEEKLY"
    case custom = "CUSTOM"

    var id: String { rawValue }

    var etichetta: String {
        switch self {
        case .daily: "Tutti i giorni"
        case .weekly: "Qualche volta a settimana"
        case .custom: "Giorni scelti da me"
        }
    }
}

// MARK: - Mood

enum MoodKind: String, Codable, CaseIterable, Sendable, Identifiable {
    case fantastica = "FANTASTICA"
    case bene = "BENE"
    case cosiCosi = "COSI_COSI"
    case stanca = "STANCA"
    case giu = "GIU"
    case nervosa = "NERVOSA"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .fantastica: "😍"
        case .bene: "😊"
        case .cosiCosi: "🙂"
        case .stanca: "😴"
        case .giu: "😔"
        case .nervosa: "😡"
        }
    }

    var etichetta: String {
        switch self {
        case .fantastica: "Fantastica"
        case .bene: "Bene"
        case .cosiCosi: "Così così"
        case .stanca: "Stanca"
        case .giu: "Giù"
        case .nervosa: "Nervosa"
        }
    }

    /// Punteggio da 1 a 5, per i grafici. Deve restare allineato al backend.
    var punteggio: Double {
        switch self {
        case .fantastica: 5
        case .bene: 4
        case .cosiCosi: 3
        case .stanca: 2.5
        case .nervosa: 2
        case .giu: 1
        }
    }

    /// I mood che indicano una giornata difficile: Nina risponde diversamente.
    var difficile: Bool {
        switch self {
        case .giu, .nervosa, .stanca: true
        case .fantastica, .bene, .cosiCosi: false
        }
    }
}

// MARK: - Wishlist

enum WishlistCategory: String, Codable, CaseIterable, Sendable, Identifiable {
    case moda = "MODA"
    case beauty = "BEAUTY"
    case casa = "CASA"
    case tech = "TECH"
    case viaggi = "VIAGGI"
    case libri = "LIBRI"
    case esperienze = "ESPERIENZE"
    case altro = "ALTRO"

    var id: String { rawValue }

    var etichetta: String {
        switch self {
        case .moda: "Moda"
        case .beauty: "Beauty"
        case .casa: "Casa"
        case .tech: "Tech"
        case .viaggi: "Viaggi"
        case .libri: "Libri"
        case .esperienze: "Esperienze"
        case .altro: "Altro"
        }
    }

    var emoji: String {
        switch self {
        case .moda: "👗"
        case .beauty: "💄"
        case .casa: "🕯️"
        case .tech: "📱"
        case .viaggi: "✈️"
        case .libri: "📖"
        case .esperienze: "🎟️"
        case .altro: "✨"
        }
    }
}

// MARK: - Self care

enum SelfCareCategory: String, Codable, CaseIterable, Sendable, Identifiable {
    case relax = "RELAX"
    case corpo = "CORPO"
    case mente = "MENTE"
    case casa = "CASA"
    case fuori = "FUORI"
    case creativita = "CREATIVITA"
    case social = "SOCIAL"
    case digitale = "DIGITALE"

    var id: String { rawValue }

    var etichetta: String {
        switch self {
        case .relax: "Relax"
        case .corpo: "Corpo"
        case .mente: "Mente"
        case .casa: "Casa"
        case .fuori: "Fuori"
        case .creativita: "Creatività"
        case .social: "Con qualcuno"
        case .digitale: "Meno schermo"
        }
    }

    var emoji: String {
        switch self {
        case .relax: "🛁"
        case .corpo: "🧴"
        case .mente: "🧘"
        case .casa: "🏠"
        case .fuori: "🌿"
        case .creativita: "🎨"
        case .social: "☕️"
        case .digitale: "📵"
        }
    }
}

// MARK: - Tema

enum ThemePreference: String, Codable, CaseIterable, Sendable, Identifiable {
    case light = "LIGHT"
    case dark = "DARK"
    case system = "SYSTEM"

    var id: String { rawValue }

    var etichetta: String {
        switch self {
        case .light: "Chiaro"
        case .dark: "Scuro"
        case .system: "Come il sistema"
        }
    }
}

// MARK: - Ruoli

enum UserRole: String, Codable, Sendable {
    case user = "USER"
    case admin = "ADMIN"
}

// MARK: - Giorni della settimana

enum GiornoSettimana: Int, CaseIterable, Identifiable, Sendable {
    case lunedi = 1, martedi, mercoledi, giovedi, venerdi, sabato, domenica

    var id: Int { rawValue }

    var lettera: String {
        switch self {
        case .lunedi: "L"
        case .martedi: "M"
        case .mercoledi: "M"
        case .giovedi: "G"
        case .venerdi: "V"
        case .sabato: "S"
        case .domenica: "D"
        }
    }

    var nome: String {
        switch self {
        case .lunedi: "Lunedì"
        case .martedi: "Martedì"
        case .mercoledi: "Mercoledì"
        case .giovedi: "Giovedì"
        case .venerdi: "Venerdì"
        case .sabato: "Sabato"
        case .domenica: "Domenica"
        }
    }
}

// MARK: - Frase motivazionale

/// La frase come la vede l'interfaccia.
struct Frase: Identifiable, Hashable, Sendable {
    let id: UUID
    let testo: String
    let autore: String?
    let fonte: String?
    var preferita: Bool

    /// Cosa scrivere sotto la citazione.
    ///
    /// Se l'autore c'è, è l'autore. Se non c'è ma la fonte non è "Nina",
    /// è la fonte. Se la frase è di Nina non si firma: sarebbe come se un
    /// amica firmasse i messaggi.
    var firma: String? {
        if let autore, !autore.isEmpty { return autore }
        if let fonte, !fonte.isEmpty, fonte.lowercased() != "nina" { return fonte }
        return nil
    }

    var testoDaCondividere: String {
        if let firma {
            return "\u{201C}\(testo)\u{201D}\n— \(firma)"
        }
        return "\u{201C}\(testo)\u{201D}"
    }
}
