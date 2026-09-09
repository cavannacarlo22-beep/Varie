// FILE: ios/Nina/Sync/Traduttore.swift
//
// La conversione fra i modelli locali e il JSON della sincronizzazione.
//
// È il posto più noioso del progetto ed è anche quello dove un errore si paga
// più caro: un campo dimenticato qui non dà nessun errore, semplicemente non
// si sincronizza — e ce ne si accorge settimane dopo, sull'iPad, quando manca
// una nota.
//
// Per questo la struttura è rigidamente simmetrica: per ogni entità c'è una
// funzione che scrive e una che legge, e i campi compaiono nello stesso ordine
// in entrambe. Leggerle affiancate rende visibile un campo mancante.

import Foundation
import SwiftData

enum Traduttore {

    // MARK: - Nomi delle entità

    static let entitaAttivita = "tasks"
    static let entitaAbitudini = "habits"
    static let entitaCompletamenti = "habitCompletions"
    static let entitaUmori = "moods"
    static let entitaDiario = "diaryEntries"
    static let entitaDesideri = "wishlist"
    static let entitaNote = "quickNotes"
    static let entitaMessaggi = "friendMessages"
    static let entitaImpostazioni = "userSettings"

    // MARK: - Verso il server

    /// I campi da inviare per un oggetto modificato in locale.
    static func perInvio(_ oggetto: any Sincronizzabile) -> (String, JSONValue)? {
        let cancellato: JSONValue = oggetto.deletedAt.map { .stringa(CalendarioNina.iso(da: $0)) } ?? .nullo

        switch oggetto {
        case let attivita as Attivita:
            return (entitaAttivita, .oggetto([
                "title": .stringa(attivita.titolo),
                "description": .testo(attivita.dettaglio),
                "date": .stringa(attivita.giorno),
                "time": .testo(attivita.ora),
                "isCompleted": .booleano(attivita.completata),
                "priority": .stringa(attivita.priorita.rawValue),
                "category": .stringa(attivita.categoria.rawValue),
                "notes": .testo(attivita.note),
                "repeatType": .stringa(attivita.ripetizione.rawValue),
                "repeatDays": .interi(attivita.giorniRipetizione),
                "repeatUntil": .testo(attivita.ripetiFinoA),
                "seriesId": .testo(attivita.serieId?.uuidString.lowercased()),
                "notificationEnabled": .booleano(attivita.notificaAttiva),
                "notificationMinutesBefore": .numero(attivita.minutiPrima),
                "completedAt": attivita.completataIl.map { .stringa(CalendarioNina.iso(da: $0)) } ?? .nullo,
                "deletedAt": cancellato,
            ]))

        case let abitudine as Abitudine:
            return (entitaAbitudini, .oggetto([
                "name": .stringa(abitudine.nome),
                "icon": .stringa(abitudine.icona),
                "color": .stringa(abitudine.colore),
                "frequency": .stringa(abitudine.frequenza.rawValue),
                "targetDays": .interi(abitudine.giorniObiettivo),
                "targetPerWeek": .numero(abitudine.volteASettimana),
                "reminderTime": .testo(abitudine.oraPromemoria),
                "sortOrder": .numero(abitudine.ordine),
                "deletedAt": cancellato,
            ]))

        case let completamento as CompletamentoAbitudine:
            return (entitaCompletamenti, .oggetto([
                "habitId": .stringa(completamento.abitudineId.uuidString.lowercased()),
                "date": .stringa(completamento.giorno),
                "completed": .booleano(completamento.fatta),
                "deletedAt": cancellato,
            ]))

        case let umore as Umore:
            return (entitaUmori, .oggetto([
                "mood": .stringa(umore.umore.rawValue),
                "note": .testo(umore.nota),
                "date": .stringa(umore.giorno),
                "deletedAt": cancellato,
            ]))

        case let pagina as PaginaDiario:
            return (entitaDiario, .oggetto([
                "title": .testo(pagina.titolo),
                "content": .stringa(pagina.contenuto),
                "mood": .testo(pagina.umore?.rawValue),
                "entryDate": .stringa(pagina.giorno),
                "deletedAt": cancellato,
            ]))

        case let desiderio as Desiderio:
            return (entitaDesideri, .oggetto([
                "title": .stringa(desiderio.titolo),
                "description": .testo(desiderio.dettaglio),
                "price": .numero(desiderio.prezzo),
                "currency": .stringa(desiderio.valuta),
                "imageUrl": .testo(desiderio.immagineUrl),
                "productUrl": .testo(desiderio.linkProdotto),
                "category": .stringa(desiderio.categoria.rawValue),
                "isPurchased": .booleano(desiderio.acquistato),
                "purchasedAt": desiderio.acquistatoIl.map { .stringa(CalendarioNina.iso(da: $0)) } ?? .nullo,
                "deletedAt": cancellato,
            ]))

        case let nota as NotaVeloce:
            return (entitaNote, .oggetto([
                "content": .stringa(nota.contenuto),
                "convertedTaskId": .testo(nota.attivitaCollegata?.uuidString.lowercased()),
                "deletedAt": cancellato,
            ]))

        case let impostazioni as Impostazioni:
            return (entitaImpostazioni, .oggetto([
                "morningNotifications": .booleano(impostazioni.notificheMattina),
                "eveningNotifications": .booleano(impostazioni.notificheSera),
                "taskNotifications": .booleano(impostazioni.notificheAttivita),
                "habitNotifications": .booleano(impostazioni.notificheAbitudini),
                "selfCareNotifications": .booleano(impostazioni.notificheSelfCare),
                "darkMode": .stringa(impostazioni.tema.rawValue),
                "morningTime": .stringa(impostazioni.oraMattina),
                "eveningTime": .stringa(impostazioni.oraSera),
                "weekStartsOnMonday": .booleano(impostazioni.settimanaIniziaLunedi),
            ]))

        default:
            return nil
        }
    }

    // MARK: - Dal server

    /// Applica una riga ricevuta dal server alla copia locale.
    @MainActor
    static func applica(entita: String, dati: JSONValue, deposito: Deposito) {
        guard let id = dati["id"]?.uuid else { return }

        let contesto = deposito.contesto
        let versione = dati["version"]?.intero ?? 1
        let sequenza = dati["syncSeq"]?.intero ?? 0
        let cancellatoIl = dati["deletedAt"]?.data
        let modificatoIl = dati["clientUpdatedAt"]?.data ?? Date()

        /// Aggiorna i campi comuni. Dopo una scrittura ricevuta dal server
        /// l'oggetto non è più da inviare: la nostra copia *è* quella del server.
        func comuni(_ oggetto: any Sincronizzabile) {
            oggetto.version = versione
            oggetto.syncSeq = sequenza
            oggetto.deletedAt = cancellatoIl
            oggetto.clientUpdatedAt = modificatoIl
            oggetto.daInviare = false
        }

        switch entita {

        case entitaAttivita:
            let attivita = esistente(Attivita.self, id: id, contesto: contesto) ?? {
                let nuova = Attivita(titolo: "", giorno: CalendarioNina.oggi)
                nuova.id = id
                contesto.insert(nuova)
                return nuova
            }()

            attivita.titolo = dati["title"]?.testo ?? attivita.titolo
            attivita.dettaglio = dati["description"]?.testo
            attivita.giorno = dati["date"]?.testo ?? attivita.giorno
            attivita.ora = dati["time"]?.testo
            attivita.completata = dati["isCompleted"]?.bool ?? false
            attivita.prioritaGrezza = dati["priority"]?.testo ?? TaskPriority.medium.rawValue
            attivita.categoriaGrezza = dati["category"]?.testo ?? TaskCategory.altro.rawValue
            attivita.note = dati["notes"]?.testo
            attivita.ripetizioneGrezza = dati["repeatType"]?.testo ?? RepeatType.never.rawValue
            attivita.giorniRipetizione = dati["repeatDays"]?.interi ?? []
            attivita.ripetiFinoA = dati["repeatUntil"]?.testo
            attivita.serieId = dati["seriesId"]?.uuid
            attivita.notificaAttiva = dati["notificationEnabled"]?.bool ?? false
            attivita.minutiPrima = dati["notificationMinutesBefore"]?.intero ?? 15
            attivita.completataIl = dati["completedAt"]?.data
            attivita.createdAt = dati["createdAt"]?.data ?? attivita.createdAt
            attivita.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(attivita)

        case entitaAbitudini:
            let abitudine = esistente(Abitudine.self, id: id, contesto: contesto) ?? {
                let nuova = Abitudine(nome: "")
                nuova.id = id
                contesto.insert(nuova)
                return nuova
            }()

            abitudine.nome = dati["name"]?.testo ?? abitudine.nome
            abitudine.icona = dati["icon"]?.testo ?? "✨"
            abitudine.colore = dati["color"]?.testo ?? "#F48FB1"
            abitudine.frequenzaGrezza = dati["frequency"]?.testo ?? HabitFrequency.daily.rawValue
            abitudine.giorniObiettivo = dati["targetDays"]?.interi ?? [1, 2, 3, 4, 5, 6, 7]
            abitudine.volteASettimana = dati["targetPerWeek"]?.intero
            abitudine.oraPromemoria = dati["reminderTime"]?.testo
            abitudine.ordine = dati["sortOrder"]?.intero ?? 0
            abitudine.createdAt = dati["createdAt"]?.data ?? abitudine.createdAt
            abitudine.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(abitudine)

        case entitaCompletamenti:
            guard let abitudineId = dati["habitId"]?.uuid,
                  let giorno = dati["date"]?.testo else { return }

            let completamento = esistente(CompletamentoAbitudine.self, id: id, contesto: contesto) ?? {
                let nuovo = CompletamentoAbitudine(abitudineId: abitudineId, giorno: giorno)
                nuovo.id = id
                contesto.insert(nuovo)
                return nuovo
            }()

            completamento.abitudineId = abitudineId
            completamento.giorno = giorno
            completamento.fatta = dati["completed"]?.bool ?? true
            completamento.createdAt = dati["createdAt"]?.data ?? completamento.createdAt
            completamento.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(completamento)

        case entitaUmori:
            guard let giorno = dati["date"]?.testo else { return }

            let umore = esistente(Umore.self, id: id, contesto: contesto) ?? {
                let nuovo = Umore(umore: .bene, giorno: giorno)
                nuovo.id = id
                contesto.insert(nuovo)
                return nuovo
            }()

            umore.umoreGrezzo = dati["mood"]?.testo ?? MoodKind.bene.rawValue
            umore.nota = dati["note"]?.testo
            umore.giorno = giorno
            umore.createdAt = dati["createdAt"]?.data ?? umore.createdAt
            umore.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(umore)

        case entitaDiario:
            let pagina = esistente(PaginaDiario.self, id: id, contesto: contesto) ?? {
                let nuova = PaginaDiario(contenuto: "", giorno: CalendarioNina.oggi)
                nuova.id = id
                contesto.insert(nuova)
                return nuova
            }()

            pagina.titolo = dati["title"]?.testo
            pagina.contenuto = dati["content"]?.testo ?? pagina.contenuto
            pagina.umoreGrezzo = dati["mood"]?.testo
            pagina.giorno = dati["entryDate"]?.testo ?? pagina.giorno
            pagina.createdAt = dati["createdAt"]?.data ?? pagina.createdAt
            pagina.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(pagina)

        case entitaDesideri:
            let desiderio = esistente(Desiderio.self, id: id, contesto: contesto) ?? {
                let nuovo = Desiderio(titolo: "")
                nuovo.id = id
                contesto.insert(nuovo)
                return nuovo
            }()

            desiderio.titolo = dati["title"]?.testo ?? desiderio.titolo
            desiderio.dettaglio = dati["description"]?.testo
            desiderio.prezzo = dati["price"]?.decimale
            desiderio.valuta = dati["currency"]?.testo ?? "EUR"
            desiderio.immagineUrl = dati["imageUrl"]?.testo
            desiderio.linkProdotto = dati["productUrl"]?.testo
            desiderio.categoriaGrezza = dati["category"]?.testo ?? WishlistCategory.altro.rawValue
            desiderio.acquistato = dati["isPurchased"]?.bool ?? false
            desiderio.acquistatoIl = dati["purchasedAt"]?.data
            desiderio.createdAt = dati["createdAt"]?.data ?? desiderio.createdAt
            desiderio.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(desiderio)

        case entitaNote:
            let nota = esistente(NotaVeloce.self, id: id, contesto: contesto) ?? {
                let nuova = NotaVeloce(contenuto: "")
                nuova.id = id
                contesto.insert(nuova)
                return nuova
            }()

            nota.contenuto = dati["content"]?.testo ?? nota.contenuto
            nota.attivitaCollegata = dati["convertedTaskId"]?.uuid
            nota.createdAt = dati["createdAt"]?.data ?? nota.createdAt
            nota.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(nota)

        case entitaMessaggi:
            let messaggio = esistente(MessaggioAmica.self, id: id, contesto: contesto) ?? {
                let nuovo = MessaggioAmica(autore: "NINA", contenuto: "")
                nuovo.id = id
                contesto.insert(nuovo)
                return nuovo
            }()

            messaggio.autore = dati["author"]?.testo ?? "NINA"
            messaggio.contenuto = dati["content"]?.testo ?? messaggio.contenuto
            messaggio.createdAt = dati["createdAt"]?.data ?? messaggio.createdAt
            messaggio.updatedAt = dati["updatedAt"]?.data ?? Date()
            comuni(messaggio)

        case entitaImpostazioni:
            let impostazioni = deposito.impostazioni
            impostazioni.id = id
            impostazioni.notificheMattina = dati["morningNotifications"]?.bool ?? true
            impostazioni.notificheSera = dati["eveningNotifications"]?.bool ?? true
            impostazioni.notificheAttivita = dati["taskNotifications"]?.bool ?? true
            impostazioni.notificheAbitudini = dati["habitNotifications"]?.bool ?? true
            impostazioni.notificheSelfCare = dati["selfCareNotifications"]?.bool ?? true
            impostazioni.temaGrezzo = dati["darkMode"]?.testo ?? ThemePreference.system.rawValue
            impostazioni.oraMattina = dati["morningTime"]?.testo ?? "08:00"
            impostazioni.oraSera = dati["eveningTime"]?.testo ?? "21:30"
            impostazioni.settimanaIniziaLunedi = dati["weekStartsOnMonday"]?.bool ?? true
            comuni(impostazioni)

        default:
            // Entità sconosciuta: probabilmente il server è più nuovo dell'app.
            // Si ignora invece di sbagliare: l'aggiornamento dell'app la
            // riconoscerà, e nel frattempo tutto il resto continua a funzionare.
            return
        }
    }

    // MARK: - Ricerca

    @MainActor
    static func trova(entita: String, id: UUID, contesto: ModelContext) -> (any Sincronizzabile)? {
        switch entita {
        case entitaAttivita: esistente(Attivita.self, id: id, contesto: contesto)
        case entitaAbitudini: esistente(Abitudine.self, id: id, contesto: contesto)
        case entitaCompletamenti: esistente(CompletamentoAbitudine.self, id: id, contesto: contesto)
        case entitaUmori: esistente(Umore.self, id: id, contesto: contesto)
        case entitaDiario: esistente(PaginaDiario.self, id: id, contesto: contesto)
        case entitaDesideri: esistente(Desiderio.self, id: id, contesto: contesto)
        case entitaNote: esistente(NotaVeloce.self, id: id, contesto: contesto)
        case entitaMessaggi: esistente(MessaggioAmica.self, id: id, contesto: contesto)
        case entitaImpostazioni: esistente(Impostazioni.self, id: id, contesto: contesto)
        default: nil
        }
    }

    @MainActor
    private static func esistente<T: PersistentModel & Sincronizzabile>(
        _ tipo: T.Type,
        id: UUID,
        contesto: ModelContext
    ) -> T? {
        var richiesta = FetchDescriptor<T>(predicate: #Predicate { $0.id == id })
        richiesta.fetchLimit = 1
        return try? contesto.fetch(richiesta).first
    }
}
