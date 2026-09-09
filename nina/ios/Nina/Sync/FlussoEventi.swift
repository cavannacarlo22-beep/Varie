// FILE: ios/Nina/Sync/FlussoEventi.swift
//
// Il flusso di eventi in tempo reale (Server-Sent Events).
//
// Il protocollo è volutamente elementare: righe di testo separate da righe
// vuote. `URLSession.bytes(for:)` restituisce le righe una alla volta, quindi
// non serve nessuna libreria — bastano una trentina di righe di parsing.
//
// Attenzione a cosa NON fa questo file: non porta dati. L'evento dice soltanto
// "il cursore è avanzato". A leggere i dati ci pensa la solita
// `GET /sync/changes`. Se questo flusso non parte mai, l'app funziona
// identica, solo un po' meno immediata: è un accessorio, non un pilastro.

import Foundation

struct FlussoEventi {

    enum Evento: Sendable, Equatable {
        /// Primo messaggio: dice dove si trova il server adesso.
        case benvenuto(cursore: Int)
        /// Qualcosa è cambiato su un altro dispositivo.
        case cambiato(cursore: Int, origine: String?)
    }

    private let client: ClientAPI

    init(client: ClientAPI = .condiviso) {
        self.client = client
    }

    /// Sequenza di eventi. Termina quando la connessione cade.
    func eventi() -> AsyncThrowingStream<Evento, Error> {
        AsyncThrowingStream { continuazione in
            let compito = Task {
                do {
                    let base = await client.indirizzoBase
                    guard let token = Portachiavi.leggi(.accessToken) else {
                        continuazione.finish(throwing: ErroreNina.nonAutenticata)
                        return
                    }

                    var richiesta = URLRequest(url: base.appendingPathComponent("sync/stream"))
                    richiesta.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    richiesta.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    richiesta.setValue(Portachiavi.deviceId, forHTTPHeaderField: "X-Nina-Device-Id")
                    // Lo stream resta aperto a lungo: il timeout normale lo
                    // taglierebbe dopo venti secondi.
                    richiesta.timeoutInterval = 3600

                    let (righe, risposta) = try await URLSession.shared.bytes(for: richiesta)

                    guard let http = risposta as? HTTPURLResponse,
                          (200..<300).contains(http.statusCode) else {
                        continuazione.finish(throwing: ErroreNina.sessioneScaduta)
                        return
                    }

                    var tipoEvento = ""
                    var datiEvento = ""

                    for try await riga in righe.lines {
                        if Task.isCancelled { break }

                        if riga.isEmpty {
                            // Riga vuota: l'evento è completo.
                            if let evento = interpreta(tipo: tipoEvento, dati: datiEvento) {
                                continuazione.yield(evento)
                            }
                            tipoEvento = ""
                            datiEvento = ""
                            continue
                        }

                        // I commenti (": ping") tengono viva la connessione.
                        if riga.hasPrefix(":") { continue }

                        if riga.hasPrefix("event:") {
                            tipoEvento = String(riga.dropFirst(6)).trimmingCharacters(in: .whitespaces)
                        } else if riga.hasPrefix("data:") {
                            datiEvento += String(riga.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                        }
                        // "retry:" e "id:" non ci servono: la riconnessione la
                        // gestisce il motore di sincronizzazione.
                    }

                    continuazione.finish()
                } catch {
                    continuazione.finish(throwing: error)
                }
            }

            continuazione.onTermination = { _ in compito.cancel() }
        }
    }

    private func interpreta(tipo: String, dati: String) -> Evento? {
        guard !dati.isEmpty,
              let json = dati.data(using: .utf8),
              let oggetto = try? JSONSerialization.jsonObject(with: json) as? [String: Any]
        else { return nil }

        let cursore = (oggetto["cursor"] as? Int) ?? 0

        switch tipo {
        case "hello": return .benvenuto(cursore: cursore)
        case "changed": return .cambiato(cursore: cursore, origine: oggetto["origin"] as? String)
        default: return nil
        }
    }
}
