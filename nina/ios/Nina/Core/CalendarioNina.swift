// FILE: ios/Nina/Core/CalendarioNina.swift
//
// Tutto ciò che riguarda date e orari passa da qui.
//
// Il motivo è che le conversioni fra `Date`, "aaaa-mm-gg" e "HH:mm" sono il
// posto in cui nascono i bug più difficili da vedere: un'attività che compare
// il giorno prima, uno streak che si spezza a mezzanotte, una notifica che
// suona un'ora dopo il cambio dell'ora legale. Concentrando le conversioni in
// un file solo, c'è un posto solo da controllare — e un posto solo da testare.
//
// I formatter sono creati una volta e riusati: costruirne uno a ogni riga di
// un elenco è uno dei modi più efficaci per rendere lento SwiftUI.

import Foundation

enum CalendarioNina {

    /// Il calendario dell'utente, con la settimana che inizia di lunedì.
    static var calendario: Calendar = {
        var calendario = Calendar(identifier: .gregorian)
        calendario.locale = Locale(identifier: "it_IT")
        calendario.firstWeekday = 2   // lunedì
        return calendario
    }()

    static let locale = Locale(identifier: "it_IT")

    // MARK: - Formatter

    /// "aaaa-mm-gg". Locale POSIX: non deve mai cambiare con la lingua del telefono.
    private static let formatterGiorno: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter
    }()

    private static let formatterOra: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = TimeZone.current
        return formatter
    }()

    private static let formatterIso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let formatterIsoSenzaFrazioni: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    // MARK: - Conversioni di base

    /// Il giorno di oggi, come lo scrive il backend.
    static var oggi: String { giorno(da: Date()) }

    static func giorno(da data: Date) -> String {
        formatterGiorno.string(from: data)
    }

    static func data(daGiorno giorno: String) -> Date? {
        formatterGiorno.date(from: giorno)
    }

    static func ora(da data: Date) -> String {
        formatterOra.string(from: data)
    }

    /// Combina un giorno e un'ora in un istante nel fuso dell'utente.
    static func data(giorno: String, ora: String) -> Date? {
        guard let base = data(daGiorno: giorno) else { return nil }
        let parti = ora.split(separator: ":")
        guard parti.count >= 2,
              let ore = Int(parti[0]),
              let minuti = Int(parti[1])
        else { return base }

        return calendario.date(bySettingHour: ore, minute: minuti, second: 0, of: base)
    }

    static func iso(da data: Date) -> String {
        formatterIso.string(from: data)
    }

    /// Legge una data ISO accettando sia il formato con i millisecondi sia quello senza:
    /// il backend può produrre entrambi a seconda della colonna.
    static func data(daIso testo: String) -> Date? {
        formatterIso.date(from: testo) ?? formatterIsoSenzaFrazioni.date(from: testo)
    }

    // MARK: - Spostamenti

    static func giorno(spostatoDi giorni: Int, da: String) -> String {
        guard let data = data(daGiorno: da),
              let spostata = calendario.date(byAdding: .day, value: giorni, to: data)
        else { return da }
        return giorno(da: spostata)
    }

    static func giorniTra(_ da: String, _ a: String) -> Int {
        guard let inizio = data(daGiorno: da), let fine = data(daGiorno: a) else { return 0 }
        return calendario.dateComponents([.day], from: inizio, to: fine).day ?? 0
    }

    /// Numero del giorno della settimana in formato ISO: 1 = lunedì … 7 = domenica.
    static func giornoSettimana(di giornoStringa: String) -> Int {
        guard let data = data(daGiorno: giornoStringa) else { return 1 }
        let numero = calendario.component(.weekday, from: data)   // 1 = domenica
        return numero == 1 ? 7 : numero - 1
    }

    // MARK: - Intervalli

    /// I sette giorni della settimana che contiene la data indicata.
    static func settimana(contenente giornoStringa: String) -> [String] {
        guard let data = data(daGiorno: giornoStringa),
              let intervallo = calendario.dateInterval(of: .weekOfYear, for: data)
        else { return [giornoStringa] }

        return (0..<7).compactMap { offset in
            calendario.date(byAdding: .day, value: offset, to: intervallo.start).map(giorno(da:))
        }
    }

    /// Tutti i giorni del mese che contiene la data indicata.
    static func mese(contenente giornoStringa: String) -> [String] {
        guard let data = data(daGiorno: giornoStringa),
              let intervallo = calendario.dateInterval(of: .month, for: data),
              let numeroGiorni = calendario.range(of: .day, in: .month, for: data)?.count
        else { return [giornoStringa] }

        return (0..<numeroGiorni).compactMap { offset in
            calendario.date(byAdding: .day, value: offset, to: intervallo.start).map(giorno(da:))
        }
    }

    /// La griglia di un mese per il calendario: include i giorni di riempimento
    /// all'inizio e alla fine, così le settimane sono sempre righe complete.
    static func grigliaMese(contenente giornoStringa: String) -> [String] {
        let giorniDelMese = mese(contenente: giornoStringa)
        guard let primo = giorniDelMese.first, let ultimo = giorniDelMese.last else { return [] }

        let riempimentoIniziale = giornoSettimana(di: primo) - 1
        let riempimentoFinale = 7 - giornoSettimana(di: ultimo)

        let prima = (0..<riempimentoIniziale).reversed().map { giorno(spostatoDi: -($0 + 1), da: primo) }
        let dopo = (0..<riempimentoFinale).map { giorno(spostatoDi: $0 + 1, da: ultimo) }

        return prima + giorniDelMese + dopo
    }

    // MARK: - Testi

    /// "Mercoledì 9 settembre" — l'intestazione della Home.
    static func testoLungo(_ giornoStringa: String) -> String {
        guard let data = data(daGiorno: giornoStringa) else { return giornoStringa }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "EEEE d MMMM"
        return formatter.string(from: data).capitalizzaPrimaLettera()
    }

    /// "9 set" — le etichette compatte.
    static func testoBreve(_ giornoStringa: String) -> String {
        guard let data = data(daGiorno: giornoStringa) else { return giornoStringa }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "d MMM"
        return formatter.string(from: data)
    }

    /// "settembre 2026" — il titolo del calendario.
    static func testoMese(_ giornoStringa: String) -> String {
        guard let data = data(daGiorno: giornoStringa) else { return giornoStringa }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: data).capitalizzaPrimaLettera()
    }

    /// "Oggi", "Domani", "Ieri", altrimenti la data.
    static func testoRelativo(_ giornoStringa: String) -> String {
        switch giorniTra(oggi, giornoStringa) {
        case 0: "Oggi"
        case 1: "Domani"
        case -1: "Ieri"
        case 2...6: testoLungo(giornoStringa)
        default: testoBreve(giornoStringa)
        }
    }

    static func numeroDelGiorno(_ giornoStringa: String) -> String {
        guard let data = data(daGiorno: giornoStringa) else { return "" }
        return String(calendario.component(.day, from: data))
    }

    static func eOggi(_ giornoStringa: String) -> Bool { giornoStringa == oggi }

    static func eStessoMese(_ a: String, _ b: String) -> Bool {
        a.prefix(7) == b.prefix(7)
    }
}

extension String {
    func capitalizzaPrimaLettera() -> String {
        guard let prima = first else { return self }
        return prima.uppercased() + dropFirst()
    }
}
