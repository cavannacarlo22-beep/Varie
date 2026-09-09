// FILE: ios/Nina/Networking/DTO.swift
//
// I tipi che viaggiano sulla rete.
//
// Sono separati dai modelli SwiftData di proposito. Se fossero la stessa cosa,
// ogni cambiamento dell'API costringerebbe a una migrazione del database
// locale, e ogni campo utile solo in locale (per esempio `daInviare`) finirebbe
// per errore nelle richieste HTTP. Tenerli distinti costa qualche riga di
// conversione e risparmia una categoria intera di problemi.

import Foundation

// MARK: - Errori

/// La forma in cui il backend riporta gli errori.
struct ErroreAPI: Codable, Sendable {
    struct Dettaglio: Codable, Sendable {
        let code: String
        let message: String
    }
    let error: Dettaglio
}

// MARK: - Autenticazione

struct UtenteDTO: Codable, Sendable, Equatable {
    let id: UUID
    let email: String
    let firstName: String
    let lastName: String
    let displayName: String
    let avatarUrl: String?
    let role: UserRole
    let isActive: Bool
    let emailVerified: Bool
    let createdAt: String
    let lastLoginAt: String?
}

struct RispostaAutenticazione: Codable, Sendable {
    let user: UtenteDTO
    let accessToken: String
    let refreshToken: String
    let accessTokenExpiresIn: Int
}

struct RichiestaRegistrazione: Codable, Sendable {
    let email: String
    let password: String
    let firstName: String
    let lastName: String
    let displayName: String?
}

struct RichiestaLogin: Codable, Sendable {
    let email: String
    let password: String
}

struct RichiestaRefresh: Codable, Sendable {
    let refreshToken: String
}

struct RichiestaEmail: Codable, Sendable {
    let email: String
}

struct RichiestaCambioPassword: Codable, Sendable {
    let currentPassword: String
    let newPassword: String
}

struct RispostaOk: Codable, Sendable {
    let ok: Bool
}

// MARK: - Profilo e impostazioni

struct AggiornaProfilo: Codable, Sendable {
    var firstName: String?
    var lastName: String?
    var displayName: String?
}

struct ImpostazioniDTO: Codable, Sendable {
    let id: UUID
    let morningNotifications: Bool
    let eveningNotifications: Bool
    let taskNotifications: Bool
    let habitNotifications: Bool
    let selfCareNotifications: Bool
    let darkMode: ThemePreference
    let morningTime: String
    let eveningTime: String
    let weekStartsOnMonday: Bool
    let version: Int
    let syncSeq: Int
}

struct AggiornaImpostazioni: Codable, Sendable {
    var morningNotifications: Bool?
    var eveningNotifications: Bool?
    var taskNotifications: Bool?
    var habitNotifications: Bool?
    var selfCareNotifications: Bool?
    var darkMode: ThemePreference?
    var morningTime: String?
    var eveningTime: String?
    var weekStartsOnMonday: Bool?
}

// MARK: - Contenuti

struct FraseDTO: Codable, Sendable {
    let id: UUID
    let text: String
    let author: String?
    let source: String?
    let language: String
    let isActive: Bool
    let isFavorite: Bool?
    let updatedAt: String

    var frase: Frase {
        Frase(id: id, testo: text, autore: author, fonte: source, preferita: isFavorite ?? false)
    }
}

struct ElencoFrasi: Codable, Sendable {
    let items: [FraseDTO]
    let syncedAt: String
}

struct IdeaSelfCareDTO: Codable, Sendable {
    let id: UUID
    let title: String
    let description: String?
    let category: SelfCareCategory
    let durationMin: Int?
    let isActive: Bool
    let updatedAt: String
}

struct ElencoIdee: Codable, Sendable {
    let items: [IdeaSelfCareDTO]
    let syncedAt: String
}

// MARK: - Conversazione con Nina

struct MessaggioDTO: Codable, Sendable {
    let id: UUID
    let author: String
    let content: String
    let createdAt: String
}

struct RichiestaMessaggio: Codable, Sendable {
    let content: String
    let hour: Int
}

struct RispostaMessaggio: Codable, Sendable {
    let message: MessaggioDTO
    let reply: MessaggioDTO
    let source: String
}

struct StatoAmica: Codable, Sendable {
    let engine: String
    let topics: Int
    let dailyLimit: Int
    let usedToday: Int
}

// MARK: - Statistiche

struct StatisticheDTO: Codable, Sendable {
    struct Attivita: Codable, Sendable {
        struct PerCategoria: Codable, Sendable {
            let category: String
            let total: Int
            let completed: Int
        }
        struct PerGiorno: Codable, Sendable {
            let date: String
            let total: Int
            let completed: Int
        }
        let total: Int
        let completed: Int
        let completionRate: Double
        let byCategory: [PerCategoria]
        let perDay: [PerGiorno]
    }
    struct Abitudini: Codable, Sendable {
        let active: Int
        let completionsInPeriod: Int
        let bestStreak: Int
        let bestStreakHabit: String?
    }
    struct Mood: Codable, Sendable {
        let entries: Int
        let mostFrequent: String?
    }
    struct Diario: Codable, Sendable {
        let entries: Int
    }

    let period: String
    let from: String
    let to: String
    let tasks: Attivita
    let habits: Abitudini
    let mood: Mood
    let diary: Diario
    let productiveDays: Int
}

// MARK: - Sincronizzazione

/// Una riga cambiata, con l'entità a cui appartiene.
///
/// `data` resta JSON grezzo: il motore di sincronizzazione lo passa al
/// decodificatore giusto in base a `entity`, e non deve conoscere in anticipo
/// tutte le forme possibili.
struct ModificaRicevuta: Codable, Sendable {
    let entity: String
    let data: JSONValue
}

struct RispostaModifiche: Codable, Sendable {
    let changes: [ModificaRicevuta]
    let cursor: Int
    let hasMore: Bool
}

struct ModificaDaInviare: Codable, Sendable {
    let entity: String
    let id: UUID
    let baseVersion: Int?
    let clientUpdatedAt: String
    let data: JSONValue
}

struct RichiestaPush: Codable, Sendable {
    let changes: [ModificaDaInviare]
}

struct EsitoModifica: Codable, Sendable {
    let entity: String
    let id: UUID
    let outcome: String       // applied | rejected | ignored
    let server: JSONValue?
    let reason: String?
}

struct RispostaPush: Codable, Sendable {
    let results: [EsitoModifica]
    let cursor: Int
}

struct RispostaCursore: Codable, Sendable {
    let cursor: Int
    let connectedDevices: Int
}

// MARK: - JSON generico
//
// Serve solo alla sincronizzazione, che tratta i dati delle righe senza
// conoscerne la forma. È un tipo piccolo ma va scritto a mano: Swift non ha un
// "any Codable" utilizzabile in entrambe le direzioni.

enum JSONValue: Codable, Sendable, Equatable {
    case stringa(String)
    case numero(Double)
    case booleano(Bool)
    case oggetto([String: JSONValue])
    case elenco([JSONValue])
    case nullo

    init(from decoder: Decoder) throws {
        let contenitore = try decoder.singleValueContainer()

        if contenitore.decodeNil() {
            self = .nullo
        } else if let valore = try? contenitore.decode(Bool.self) {
            self = .booleano(valore)
        } else if let valore = try? contenitore.decode(Double.self) {
            self = .numero(valore)
        } else if let valore = try? contenitore.decode(String.self) {
            self = .stringa(valore)
        } else if let valore = try? contenitore.decode([String: JSONValue].self) {
            self = .oggetto(valore)
        } else if let valore = try? contenitore.decode([JSONValue].self) {
            self = .elenco(valore)
        } else {
            throw DecodingError.dataCorruptedError(
                in: contenitore,
                debugDescription: "Valore JSON non riconosciuto"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var contenitore = encoder.singleValueContainer()
        switch self {
        case .stringa(let valore): try contenitore.encode(valore)
        case .numero(let valore): try contenitore.encode(valore)
        case .booleano(let valore): try contenitore.encode(valore)
        case .oggetto(let valore): try contenitore.encode(valore)
        case .elenco(let valore): try contenitore.encode(valore)
        case .nullo: try contenitore.encodeNil()
        }
    }

    // MARK: Lettura comoda

    subscript(chiave: String) -> JSONValue? {
        if case .oggetto(let dizionario) = self { return dizionario[chiave] }
        return nil
    }

    var testo: String? {
        if case .stringa(let valore) = self { return valore }
        return nil
    }

    var intero: Int? {
        if case .numero(let valore) = self { return Int(valore) }
        return nil
    }

    var decimale: Double? {
        if case .numero(let valore) = self { return valore }
        if case .stringa(let valore) = self { return Double(valore) }
        return nil
    }

    var bool: Bool? {
        if case .booleano(let valore) = self { return valore }
        return nil
    }

    var uuid: UUID? {
        testo.flatMap(UUID.init(uuidString:))
    }

    var data: Date? {
        testo.flatMap(CalendarioNina.data(daIso:))
    }

    var interi: [Int]? {
        if case .elenco(let valori) = self { return valori.compactMap(\.intero) }
        return nil
    }

    var eNullo: Bool {
        if case .nullo = self { return true }
        return false
    }

    // MARK: Costruzione

    static func da(_ dizionario: [String: JSONValue?]) -> JSONValue {
        .oggetto(dizionario.compactMapValues { $0 })
    }

    static func testo(_ valore: String?) -> JSONValue { valore.map(JSONValue.stringa) ?? .nullo }
    static func numero(_ valore: Int?) -> JSONValue { valore.map { .numero(Double($0)) } ?? .nullo }
    static func numero(_ valore: Double?) -> JSONValue { valore.map { .numero($0) } ?? .nullo }
    static func bool(_ valore: Bool) -> JSONValue { .booleano(valore) }
    static func interi(_ valori: [Int]) -> JSONValue { .elenco(valori.map { .numero(Double($0)) }) }
}
