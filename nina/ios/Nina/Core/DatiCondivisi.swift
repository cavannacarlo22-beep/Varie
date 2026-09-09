// FILE: ios/Nina/Core/DatiCondivisi.swift
//
// Il ponte fra l'app e i widget.
//
// I widget girano in un processo separato e non possono aprire il database
// SwiftData dell'app: aprire lo stesso store da due processi è il modo più
// rapido per corromperlo. La soluzione standard è passare per un App Group con
// una fotografia piccola dei dati, scritta dall'app e letta dal widget.
//
// La fotografia è volutamente minima — quello che serve a disegnare i widget e
// niente altro. Non ci finiscono il diario, i messaggi a Nina o i mood: un
// contenitore condiviso è più esposto del database dell'app, e quei dati non
// servono a nessun widget.

import Foundation
import WidgetKit

/// Cosa vedono i widget.
struct FotografiaGiornata: Codable, Sendable {
    struct Voce: Codable, Sendable, Identifiable {
        let id: UUID
        let titolo: String
        let ora: String?
        let completata: Bool
        let categoria: String
    }

    let giorno: String
    let nome: String
    let voci: [Voce]
    let completate: Int
    let totali: Int
    let fraseTesto: String?
    let fraseAutore: String?
    let aggiornataIl: Date

    var rimaste: Int { max(0, totali - completate) }

    static let vuota = FotografiaGiornata(
        giorno: "",
        nome: "",
        voci: [],
        completate: 0,
        totali: 0,
        fraseTesto: nil,
        fraseAutore: nil,
        aggiornataIl: .distantPast
    )
}

enum DatiCondivisi {

    /// Deve corrispondere all'App Group nei due file .entitlements.
    static let gruppo = "group.it.nina.app"

    private static let chiave = "fotografia-giornata"

    private static var deposito: UserDefaults? {
        UserDefaults(suiteName: gruppo)
    }

    // MARK: - Scrittura (dall'app)

    @MainActor
    static func aggiorna(deposito depositoApp: Deposito, nome: String, frase: Frase?) {
        let oggi = CalendarioNina.oggi
        let attivita = depositoApp.attivita(del: oggi)

        let fotografia = FotografiaGiornata(
            giorno: oggi,
            nome: nome,
            voci: attivita.prefix(8).map { singola in
                FotografiaGiornata.Voce(
                    id: singola.id,
                    titolo: singola.titolo,
                    ora: singola.ora,
                    completata: singola.completata,
                    categoria: singola.categoria.rawValue
                )
            },
            completate: attivita.filter(\.completata).count,
            totali: attivita.count,
            fraseTesto: frase?.testo,
            fraseAutore: frase?.firma,
            aggiornataIl: Date()
        )

        salva(fotografia)
    }

    static func salva(_ fotografia: FotografiaGiornata) {
        guard let dati = try? JSONEncoder().encode(fotografia) else { return }
        deposito?.set(dati, forKey: chiave)

        // Si avvisa WidgetKit che c'è qualcosa di nuovo. Senza questa riga il
        // widget si aggiornerebbe quando decide il sistema, cioè anche dopo
        // ore: spuntare un'attività e vedere il widget invariato sembrerebbe
        // un difetto.
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: - Lettura (dal widget)

    static func leggi() -> FotografiaGiornata {
        guard let dati = deposito?.data(forKey: chiave),
              let fotografia = try? JSONDecoder().decode(FotografiaGiornata.self, from: dati)
        else { return .vuota }

        return fotografia
    }
}
