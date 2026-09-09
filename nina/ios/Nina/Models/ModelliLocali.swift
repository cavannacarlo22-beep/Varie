// FILE: ios/Nina/Models/ModelliLocali.swift
//
// I modelli SwiftData: la copia locale dei dati.
//
// Due scelte che percorrono tutto il file.
//
// 1. Le *date di calendario* (il giorno di un'attività, il giorno di un mood)
//    sono stringhe "aaaa-mm-gg", non `Date`. Una `Date` è un istante nel tempo,
//    e un istante ha un fuso orario; il 9 settembre non ce l'ha. Salvarlo come
//    `Date` significa che chi apre l'app in aereo, o dopo il cambio dell'ora,
//    vede le attività spostate di un giorno. È un bug classico, ed è per questo
//    che il backend usa il tipo DATE e qui si usa una stringa.
//
// 2. Ogni oggetto porta con sé i campi di sincronizzazione (`version`,
//    `syncSeq`, `clientUpdatedAt`, `deletedAt`) e un flag `daInviare`. Il
//    motore di sincronizzazione non ha bisogno di sapere cosa siano gli
//    oggetti: guarda quei campi e basta.

import Foundation
import SwiftData

// MARK: - Protocollo comune

/// Ciò che serve al motore di sincronizzazione per trattare un oggetto.
protocol Sincronizzabile: AnyObject {
    var id: UUID { get }
    var version: Int { get set }
    var syncSeq: Int { get set }
    var clientUpdatedAt: Date { get set }
    var deletedAt: Date? { get set }
    var daInviare: Bool { get set }
}

// MARK: - Attività

@Model
final class Attivita: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var titolo: String
    var dettaglio: String?
    /// Giorno in formato "aaaa-mm-gg". Vedi la nota in cima al file.
    var giorno: String
    /// Ora in formato "HH:mm", oppure nil se l'attività non ha un orario.
    var ora: String?
    var completata: Bool
    var prioritaGrezza: String
    var categoriaGrezza: String
    var note: String?
    var ripetizioneGrezza: String
    var giorniRipetizione: [Int]
    var ripetiFinoA: String?
    var serieId: UUID?
    var notificaAttiva: Bool
    var minutiPrima: Int
    var completataIl: Date?

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    var priorita: TaskPriority {
        get { TaskPriority(rawValue: prioritaGrezza) ?? .medium }
        set { prioritaGrezza = newValue.rawValue }
    }

    var categoria: TaskCategory {
        get { TaskCategory(rawValue: categoriaGrezza) ?? .altro }
        set { categoriaGrezza = newValue.rawValue }
    }

    var ripetizione: RepeatType {
        get { RepeatType(rawValue: ripetizioneGrezza) ?? .never }
        set { ripetizioneGrezza = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        titolo: String,
        giorno: String,
        ora: String? = nil,
        dettaglio: String? = nil,
        completata: Bool = false,
        priorita: TaskPriority = .medium,
        categoria: TaskCategory = .altro,
        note: String? = nil,
        ripetizione: RepeatType = .never,
        giorniRipetizione: [Int] = [],
        ripetiFinoA: String? = nil,
        serieId: UUID? = nil,
        notificaAttiva: Bool = false,
        minutiPrima: Int = 15
    ) {
        self.id = id
        self.titolo = titolo
        self.dettaglio = dettaglio
        self.giorno = giorno
        self.ora = ora
        self.completata = completata
        self.prioritaGrezza = priorita.rawValue
        self.categoriaGrezza = categoria.rawValue
        self.note = note
        self.ripetizioneGrezza = ripetizione.rawValue
        self.giorniRipetizione = giorniRipetizione
        self.ripetiFinoA = ripetiFinoA
        self.serieId = serieId
        self.notificaAttiva = notificaAttiva
        self.minutiPrima = minutiPrima
        self.completataIl = nil
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = true
    }

    /// Istante esatto dell'attività, se ha un orario. Serve alle notifiche.
    var istante: Date? {
        guard let ora else { return nil }
        return CalendarioNina.data(giorno: giorno, ora: ora)
    }

    /// Un'attività è "scappata" se aveva un orario passato e non è fatta.
    var scaduta: Bool {
        guard !completata, deletedAt == nil else { return false }
        guard let istante else { return giorno < CalendarioNina.oggi }
        return istante < Date()
    }
}

// MARK: - Abitudini

@Model
final class Abitudine: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var nome: String
    var icona: String
    var colore: String
    var frequenzaGrezza: String
    var giorniObiettivo: [Int]
    var volteASettimana: Int?
    var oraPromemoria: String?
    var ordine: Int

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    var frequenza: HabitFrequency {
        get { HabitFrequency(rawValue: frequenzaGrezza) ?? .daily }
        set { frequenzaGrezza = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        nome: String,
        icona: String = "✨",
        colore: String = "#F48FB1",
        frequenza: HabitFrequency = .daily,
        giorniObiettivo: [Int] = [1, 2, 3, 4, 5, 6, 7],
        volteASettimana: Int? = nil,
        oraPromemoria: String? = nil,
        ordine: Int = 0
    ) {
        self.id = id
        self.nome = nome
        self.icona = icona
        self.colore = colore
        self.frequenzaGrezza = frequenza.rawValue
        self.giorniObiettivo = giorniObiettivo
        self.volteASettimana = volteASettimana
        self.oraPromemoria = oraPromemoria
        self.ordine = ordine
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = true
    }
}

@Model
final class CompletamentoAbitudine: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var abitudineId: UUID
    var giorno: String
    var fatta: Bool

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    init(id: UUID = UUID(), abitudineId: UUID, giorno: String, fatta: Bool = true) {
        self.id = id
        self.abitudineId = abitudineId
        self.giorno = giorno
        self.fatta = fatta
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = true
    }
}

// MARK: - Mood

@Model
final class Umore: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var umoreGrezzo: String
    var nota: String?
    var giorno: String

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    var umore: MoodKind {
        get { MoodKind(rawValue: umoreGrezzo) ?? .bene }
        set { umoreGrezzo = newValue.rawValue }
    }

    init(id: UUID = UUID(), umore: MoodKind, nota: String? = nil, giorno: String) {
        self.id = id
        self.umoreGrezzo = umore.rawValue
        self.nota = nota
        self.giorno = giorno
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = true
    }
}

// MARK: - Diario

@Model
final class PaginaDiario: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var titolo: String?
    var contenuto: String
    var umoreGrezzo: String?
    var giorno: String

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    var umore: MoodKind? {
        get { umoreGrezzo.flatMap(MoodKind.init(rawValue:)) }
        set { umoreGrezzo = newValue?.rawValue }
    }

    init(id: UUID = UUID(), titolo: String? = nil, contenuto: String, umore: MoodKind? = nil, giorno: String) {
        self.id = id
        self.titolo = titolo
        self.contenuto = contenuto
        self.umoreGrezzo = umore?.rawValue
        self.giorno = giorno
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = true
    }

    /// Anteprima per l'elenco: le prime righe, senza a capo.
    var anteprima: String {
        contenuto
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Wishlist

@Model
final class Desiderio: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var titolo: String
    var dettaglio: String?
    var prezzo: Double?
    var valuta: String
    var immagineUrl: String?
    var linkProdotto: String?
    var categoriaGrezza: String
    var acquistato: Bool
    var acquistatoIl: Date?

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    var categoria: WishlistCategory {
        get { WishlistCategory(rawValue: categoriaGrezza) ?? .altro }
        set { categoriaGrezza = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        titolo: String,
        dettaglio: String? = nil,
        prezzo: Double? = nil,
        valuta: String = "EUR",
        immagineUrl: String? = nil,
        linkProdotto: String? = nil,
        categoria: WishlistCategory = .altro,
        acquistato: Bool = false
    ) {
        self.id = id
        self.titolo = titolo
        self.dettaglio = dettaglio
        self.prezzo = prezzo
        self.valuta = valuta
        self.immagineUrl = immagineUrl
        self.linkProdotto = linkProdotto
        self.categoriaGrezza = categoria.rawValue
        self.acquistato = acquistato
        self.acquistatoIl = nil
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = true
    }
}

// MARK: - Note veloci

@Model
final class NotaVeloce: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var contenuto: String
    var attivitaCollegata: UUID?

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    init(id: UUID = UUID(), contenuto: String) {
        self.id = id
        self.contenuto = contenuto
        self.attivitaCollegata = nil
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = true
    }
}

// MARK: - Conversazione con Nina

@Model
final class MessaggioAmica: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    /// "USER" oppure "NINA".
    var autore: String
    var contenuto: String

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    var scrittoDaNina: Bool { autore == "NINA" }

    init(id: UUID = UUID(), autore: String, contenuto: String, createdAt: Date = Date()) {
        self.id = id
        self.autore = autore
        self.contenuto = contenuto
        self.createdAt = createdAt
        self.updatedAt = createdAt
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = createdAt
        self.daInviare = false   // i messaggi li crea il server, non si rimandano
    }
}

// MARK: - Impostazioni

@Model
final class Impostazioni: Sincronizzabile {
    @Attribute(.unique) var id: UUID
    var notificheMattina: Bool
    var notificheSera: Bool
    var notificheAttivita: Bool
    var notificheAbitudini: Bool
    var notificheSelfCare: Bool
    var temaGrezzo: String
    var oraMattina: String
    var oraSera: String
    var settimanaIniziaLunedi: Bool

    var createdAt: Date
    var updatedAt: Date
    var deletedAt: Date?
    var version: Int
    var syncSeq: Int
    var clientUpdatedAt: Date
    var daInviare: Bool

    var tema: ThemePreference {
        get { ThemePreference(rawValue: temaGrezzo) ?? .system }
        set { temaGrezzo = newValue.rawValue }
    }

    init(id: UUID = UUID()) {
        self.id = id
        self.notificheMattina = true
        self.notificheSera = true
        self.notificheAttivita = true
        self.notificheAbitudini = true
        self.notificheSelfCare = true
        self.temaGrezzo = ThemePreference.system.rawValue
        self.oraMattina = "08:00"
        self.oraSera = "21:30"
        self.settimanaIniziaLunedi = true
        self.createdAt = Date()
        self.updatedAt = Date()
        self.deletedAt = nil
        self.version = 1
        self.syncSeq = 0
        self.clientUpdatedAt = Date()
        self.daInviare = false
    }
}

// MARK: - Contenuti in cache (non appartengono all'utente)

@Model
final class FraseSalvata {
    @Attribute(.unique) var id: UUID
    var testo: String
    var autore: String?
    var fonte: String?
    var lingua: String
    var attiva: Bool
    var preferita: Bool
    var aggiornataIl: Date

    init(id: UUID, testo: String, autore: String?, fonte: String?, lingua: String = "it", attiva: Bool = true, preferita: Bool = false, aggiornataIl: Date = Date()) {
        self.id = id
        self.testo = testo
        self.autore = autore
        self.fonte = fonte
        self.lingua = lingua
        self.attiva = attiva
        self.preferita = preferita
        self.aggiornataIl = aggiornataIl
    }

    var frase: Frase {
        Frase(id: id, testo: testo, autore: autore, fonte: fonte, preferita: preferita)
    }
}

@Model
final class IdeaSelfCare {
    @Attribute(.unique) var id: UUID
    var titolo: String
    var dettaglio: String?
    var categoriaGrezza: String
    var minuti: Int?
    var attiva: Bool
    var aggiornataIl: Date

    var categoria: SelfCareCategory {
        SelfCareCategory(rawValue: categoriaGrezza) ?? .relax
    }

    init(id: UUID, titolo: String, dettaglio: String?, categoria: String, minuti: Int?, attiva: Bool = true, aggiornataIl: Date = Date()) {
        self.id = id
        self.titolo = titolo
        self.dettaglio = dettaglio
        self.categoriaGrezza = categoria
        self.minuti = minuti
        self.attiva = attiva
        self.aggiornataIl = aggiornataIl
    }
}

// MARK: - Stato della sincronizzazione

/// Una sola riga: dove siamo arrivati.
@Model
final class StatoSync {
    @Attribute(.unique) var chiave: String
    var cursore: Int
    var ultimaSincronizzazione: Date?
    var ultimoAggiornamentoContenuti: Date?

    init(chiave: String = "principale") {
        self.chiave = chiave
        self.cursore = 0
        self.ultimaSincronizzazione = nil
        self.ultimoAggiornamentoContenuti = nil
    }
}

/// Una cancellazione avvenuta offline.
///
/// Serve perché l'oggetto viene marcato `deletedAt` e resta in locale finché
/// il server non lo conferma: senza questa riga non sapremmo distinguere
/// "cancellata da me e non ancora inviata" da "cancellata dal server".
@Model
final class CancellazioneInSospeso {
    @Attribute(.unique) var id: UUID
    var entita: String
    var quando: Date

    init(id: UUID, entita: String) {
        self.id = id
        self.entita = entita
        self.quando = Date()
    }
}
