// FILE: ios/Nina/Notifications/PianificatoreNotifiche.swift
//
// Le notifiche locali.
//
// Locali e non push: le cose da ricordare le sa già il telefono, e mandare una
// push dal server per dire "fra dieci minuti hai palestra" significherebbe
// tenere sul server la copia degli orari di qualcuno per l'unico scopo di
// risvegliarlo. Le notifiche locali funzionano anche in aereo e non richiedono
// nessun dato in più.
//
// Regola di fondo: **poche**. iOS consente 64 notifiche in coda per app, ma il
// limite vero è la pazienza. Qui si programmano: un buongiorno, un riepilogo
// serale, i promemoria che l'utente ha chiesto esplicitamente, e un invito al
// self care ogni tanto. Nient'altro.
//
// Ogni riprogrammazione cancella e riscrive: è l'unico modo per non accumulare
// notifiche di attività cancellate o spostate.

import Foundation
import UserNotifications

@MainActor
final class PianificatoreNotifiche {

    static let condiviso = PianificatoreNotifiche()

    private let centro = UNUserNotificationCenter.current()

    private enum Categoria: String {
        case buongiorno = "nina.buongiorno"
        case sera = "nina.sera"
        case attivita = "nina.attivita"
        case abitudine = "nina.abitudine"
        case selfCare = "nina.selfcare"
    }

    private init() {}

    // MARK: - Permessi

    func chiediPermesso() async -> Bool {
        (try? await centro.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func statoPermesso() async -> UNAuthorizationStatus {
        await centro.notificationSettings().authorizationStatus
    }

    // MARK: - Programmazione

    /// Ricalcola tutte le notifiche in base allo stato attuale dei dati.
    ///
    /// Va chiamata dopo ogni cambiamento che può spostare un promemoria:
    /// creazione o modifica di un'attività, cambio di impostazioni, ritorno in
    /// primo piano dell'app.
    func riprogramma(deposito: Deposito) async {
        guard await statoPermesso() == .authorized else { return }

        centro.removeAllPendingNotificationRequests()

        let impostazioni = deposito.impostazioni

        if impostazioni.notificheMattina {
            await programmaBuongiorno(ora: impostazioni.oraMattina, deposito: deposito)
        }

        if impostazioni.notificheSera {
            await programmaSera(ora: impostazioni.oraSera)
        }

        if impostazioni.notificheAttivita {
            await programmaAttivita(deposito: deposito)
        }

        if impostazioni.notificheAbitudini {
            await programmaAbitudini(deposito: deposito)
        }

        if impostazioni.notificheSelfCare {
            await programmaSelfCare()
        }
    }

    func annullaTutto() {
        centro.removeAllPendingNotificationRequests()
    }

    // MARK: - Buongiorno

    private func programmaBuongiorno(ora: String, deposito: Deposito) async {
        let contenuto = UNMutableNotificationContent()
        contenuto.title = "Buongiorno 🌸"

        // Il testo cita quante cose ci sono *oggi*: domani il numero sarà
        // diverso, ma una notifica ripetuta non può cambiare testo da sola.
        // Si riprogramma a ogni apertura dell'app, quindi il numero resta
        // aggiornato nella pratica.
        let quante = deposito.attivita(del: CalendarioNina.oggi).filter { !$0.completata }.count
        contenuto.body = quante == 0
            ? "Oggi non hai niente in lista. Ci mettiamo qualcosa o ce la godiamo così?"
            : "Oggi ci sono \(quante) cose. Una alla volta 💗"
        contenuto.sound = .default
        contenuto.categoryIdentifier = Categoria.buongiorno.rawValue

        await aggiungi(
            identificativo: "buongiorno",
            contenuto: contenuto,
            ora: ora,
            ripetuta: true
        )
    }

    // MARK: - Riepilogo serale

    private func programmaSera(ora: String) async {
        let contenuto = UNMutableNotificationContent()
        contenuto.title = "Com'è andata oggi? 🌙"
        contenuto.body = "Due minuti per segnare come stai e chiudere la giornata."
        contenuto.sound = .default
        contenuto.categoryIdentifier = Categoria.sera.rawValue

        await aggiungi(identificativo: "sera", contenuto: contenuto, ora: ora, ripetuta: true)
    }

    // MARK: - Attività

    private func programmaAttivita(deposito: Deposito) async {
        let da = CalendarioNina.oggi
        let a = CalendarioNina.giorno(spostatoDi: 14, da: da)

        // Solo quelle che hanno un promemoria, un orario, non sono fatte e non
        // sono già passate. E al massimo trenta: oltre, si riempirebbe la coda
        // di iOS e le più vicine verrebbero scartate.
        let candidate = deposito.attivita(da: da, a: a)
            .filter { $0.notificaAttiva && $0.ora != nil && !$0.completata }
            .compactMap { attivita -> (Attivita, Date)? in
                guard let istante = attivita.istante else { return nil }
                let avviso = istante.addingTimeInterval(-Double(attivita.minutiPrima) * 60)
                return avviso > Date() ? (attivita, avviso) : nil
            }
            .sorted { $0.1 < $1.1 }
            .prefix(30)

        for (attivita, quando) in candidate {
            let contenuto = UNMutableNotificationContent()
            contenuto.title = attivita.titolo
            contenuto.body = attivita.minutiPrima == 0
                ? "È il momento 💗"
                : "Fra \(testoAnticipo(attivita.minutiPrima)) — \(attivita.ora ?? "")"
            contenuto.sound = .default
            contenuto.categoryIdentifier = Categoria.attivita.rawValue
            contenuto.userInfo = ["attivitaId": attivita.id.uuidString]

            await aggiungi(
                identificativo: "attivita-\(attivita.id.uuidString)",
                contenuto: contenuto,
                data: quando
            )
        }
    }

    private func testoAnticipo(_ minuti: Int) -> String {
        switch minuti {
        case 1440: "un giorno"
        case 60: "un'ora"
        case 1..<60: "\(minuti) minuti"
        default: "poco"
        }
    }

    // MARK: - Abitudini

    private func programmaAbitudini(deposito: Deposito) async {
        for abitudine in deposito.abitudini() {
            guard let ora = abitudine.oraPromemoria else { continue }

            let contenuto = UNMutableNotificationContent()
            contenuto.title = "\(abitudine.icona) \(abitudine.nome)"
            contenuto.body = "Piccolo promemoria 💗"
            contenuto.sound = .default
            contenuto.categoryIdentifier = Categoria.abitudine.rawValue

            await aggiungi(
                identificativo: "abitudine-\(abitudine.id.uuidString)",
                contenuto: contenuto,
                ora: ora,
                ripetuta: true
            )
        }
    }

    // MARK: - Self care

    /// Un invito ogni tanto, non tutti i giorni: se arrivasse ogni sera
    /// diventerebbe rumore e si disattiverebbe.
    private func programmaSelfCare() async {
        let contenuto = UNMutableNotificationContent()
        contenuto.title = "Un momento per te ✨"
        contenuto.body = VoceDiNina.inviteSelfCare()
        contenuto.sound = .default
        contenuto.categoryIdentifier = Categoria.selfCare.rawValue

        // Domenica pomeriggio: il momento in cui serve di più e disturba di meno.
        var componenti = DateComponents()
        componenti.weekday = 1   // domenica in Foundation
        componenti.hour = 17
        componenti.minute = 30

        let richiesta = UNNotificationRequest(
            identifier: "selfcare-settimanale",
            content: contenuto,
            trigger: UNCalendarNotificationTrigger(dateMatching: componenti, repeats: true)
        )
        try? await centro.add(richiesta)
    }

    // MARK: - Utilità

    private func aggiungi(
        identificativo: String,
        contenuto: UNMutableNotificationContent,
        ora: String,
        ripetuta: Bool
    ) async {
        let parti = ora.split(separator: ":")
        guard parti.count >= 2, let ore = Int(parti[0]), let minuti = Int(parti[1]) else { return }

        var componenti = DateComponents()
        componenti.hour = ore
        componenti.minute = minuti

        let richiesta = UNNotificationRequest(
            identifier: identificativo,
            content: contenuto,
            trigger: UNCalendarNotificationTrigger(dateMatching: componenti, repeats: ripetuta)
        )
        try? await centro.add(richiesta)
    }

    private func aggiungi(
        identificativo: String,
        contenuto: UNMutableNotificationContent,
        data: Date
    ) async {
        let componenti = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: data
        )

        let richiesta = UNNotificationRequest(
            identifier: identificativo,
            content: contenuto,
            trigger: UNCalendarNotificationTrigger(dateMatching: componenti, repeats: false)
        )
        try? await centro.add(richiesta)
    }

    /// Quante notifiche sono in coda. Usata dai test e dal debug.
    func inCoda() async -> Int {
        await centro.pendingNotificationRequests().count
    }
}
