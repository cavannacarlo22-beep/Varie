// FILE: ios/Nina/Networking/ClientAPI.swift
//
// L'unico punto da cui l'app parla con il backend.
//
// Tre cose che questo file fa e che è facile dimenticare altrove:
//
// 1. **Rinnova il token da solo.** Se una richiesta torna 401 perché l'access
//    token è scaduto, il client chiama /auth/refresh e *ripete la richiesta
//    originale*. Chi ha scritto la schermata non deve saperne niente.
//
// 2. **Rinnova una volta sola.** Se dieci richieste partono insieme e scadono
//    tutte, non partono dieci refresh: la prima crea il compito, le altre
//    aspettano quello. Senza questo, ogni apertura dell'app con token scaduto
//    farebbe scattare il rilevamento di riuso del backend e chiuderebbe la
//    sessione.
//
// 3. **Traduce gli errori.** Fuori da qui non esistono `URLError` o codici
//    HTTP: esistono `ErroreNina`, che hanno già un messaggio da mostrare.

import Foundation
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Errori

enum ErroreNina: LocalizedError, Sendable {
    case nonAutenticata
    case sessioneScaduta
    case offline
    case timeout
    case nonTrovato(String)
    case validazione(String)
    case limite(String)
    case server(String)
    case sconosciuto(String)

    var errorDescription: String? {
        switch self {
        case .nonAutenticata:
            "Devi accedere per continuare."
        case .sessioneScaduta:
            "La sessione è scaduta. Accedi di nuovo."
        case .offline:
            "Non c'è connessione. Le tue modifiche sono salvate qui e partiranno appena torna la rete 💗"
        case .timeout:
            "Il server ci sta mettendo troppo. Riproviamo fra un attimo?"
        case .nonTrovato(let messaggio),
             .validazione(let messaggio),
             .limite(let messaggio),
             .server(let messaggio),
             .sconosciuto(let messaggio):
            messaggio
        }
    }

    /// Se è vero, non ha senso ritentare: serve un'azione dell'utente.
    var definitivo: Bool {
        switch self {
        case .offline, .timeout, .server: false
        default: true
        }
    }
}

// MARK: - Configurazione

struct ConfigurazioneAPI: Sendable {
    let baseURL: URL

    /// Indirizzo del backend.
    ///
    /// In sviluppo punta al Mac su cui gira `npm run dev`; in produzione al
    /// dominio del backend. Si cambia qui e in nessun altro posto.
    static var predefinita: ConfigurazioneAPI {
        #if DEBUG
        // Simulatore: localhost va bene. Su iPhone vero serve l'IP del Mac
        // sulla stessa rete Wi-Fi (per esempio http://192.168.1.20:3000).
        return ConfigurazioneAPI(baseURL: URL(string: "http://localhost:3000")!)
        #else
        return ConfigurazioneAPI(baseURL: URL(string: "https://api.nina.example")!)
        #endif
    }
}

// MARK: - Client

actor ClientAPI {

    static let condiviso = ClientAPI()

    private let configurazione: ConfigurazioneAPI
    private let sessione: URLSession
    private let decodificatore: JSONDecoder
    private let codificatore: JSONEncoder

    /// Il refresh in corso, se ce n'è uno. Vedi il punto 2 in cima al file.
    private var refreshInCorso: Task<Void, Error>?

    /// Chiamata quando la sessione non è più recuperabile.
    private var alLogout: (@Sendable () -> Void)?

    init(configurazione: ConfigurazioneAPI = .predefinita) {
        self.configurazione = configurazione

        let impostazioni = URLSessionConfiguration.default
        impostazioni.timeoutIntervalForRequest = 20
        impostazioni.timeoutIntervalForResource = 60
        impostazioni.waitsForConnectivity = false
        self.sessione = URLSession(configuration: impostazioni)

        self.decodificatore = JSONDecoder()
        self.codificatore = JSONEncoder()
    }

    func impostaCallbackLogout(_ callback: @escaping @Sendable () -> Void) {
        alLogout = callback
    }

    var indirizzoBase: URL { configurazione.baseURL }

    // MARK: - Token

    private var accessToken: String? { Portachiavi.leggi(.accessToken) }
    private var refreshToken: String? { Portachiavi.leggi(.refreshToken) }

    func salvaSessione(_ risposta: RispostaAutenticazione) {
        Portachiavi.salva(risposta.accessToken, per: .accessToken)
        Portachiavi.salva(risposta.refreshToken, per: .refreshToken)
    }

    func cancellaSessione() {
        Portachiavi.cancellaSessione()
    }

    var haUnaSessione: Bool { refreshToken != nil }

    // MARK: - Richieste

    enum Metodo: String {
        case get = "GET"
        case post = "POST"
        case put = "PUT"
        case delete = "DELETE"
    }

    /// Esegue una richiesta autenticata e decodifica la risposta.
    func richiesta<Risposta: Decodable & Sendable, Corpo: Encodable & Sendable>(
        _ metodo: Metodo,
        _ percorso: String,
        query: [String: String] = [:],
        corpo: Corpo? = Optional<String>.none,
        autenticata: Bool = true
    ) async throws -> Risposta {
        let dati = try await esegui(
            metodo, percorso, query: query, corpo: corpo,
            autenticata: autenticata, giaRinnovato: false
        )

        do {
            return try decodificatore.decode(Risposta.self, from: dati)
        } catch {
            throw ErroreNina.sconosciuto(
                "La risposta del server non è nel formato atteso. Se il problema continua, aggiorna l'app."
            )
        }
    }

    /// Variante per gli endpoint che non restituiscono un corpo utile.
    @discardableResult
    func richiestaSenzaRisposta<Corpo: Encodable & Sendable>(
        _ metodo: Metodo,
        _ percorso: String,
        query: [String: String] = [:],
        corpo: Corpo? = Optional<String>.none,
        autenticata: Bool = true
    ) async throws -> Data {
        try await esegui(
            metodo, percorso, query: query, corpo: corpo,
            autenticata: autenticata, giaRinnovato: false
        )
    }

    // MARK: - Motore

    private func esegui<Corpo: Encodable & Sendable>(
        _ metodo: Metodo,
        _ percorso: String,
        query: [String: String],
        corpo: Corpo?,
        autenticata: Bool,
        giaRinnovato: Bool
    ) async throws -> Data {
        var componenti = URLComponents(
            url: configurazione.baseURL.appendingPathComponent(percorso),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty {
            componenti?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = componenti?.url else {
            throw ErroreNina.sconosciuto("Indirizzo non valido.")
        }

        var richiesta = URLRequest(url: url)
        richiesta.httpMethod = metodo.rawValue
        richiesta.setValue("application/json", forHTTPHeaderField: "Accept")
        richiesta.setValue(Portachiavi.deviceId, forHTTPHeaderField: "X-Nina-Device-Id")
        richiesta.setValue(await NomeDispositivo.valore, forHTTPHeaderField: "X-Nina-Device-Name")
        richiesta.setValue("iOS", forHTTPHeaderField: "X-Nina-Platform")
        richiesta.setValue(VersioneApp.corrente, forHTTPHeaderField: "X-Nina-App-Version")

        if let corpo {
            richiesta.setValue("application/json", forHTTPHeaderField: "Content-Type")
            richiesta.httpBody = try codificatore.encode(corpo)
        }

        if autenticata {
            guard let token = accessToken else {
                // Nessun access token ma un refresh token: si prova a rinnovare.
                if refreshToken != nil, !giaRinnovato {
                    try await rinnova()
                    return try await esegui(metodo, percorso, query: query, corpo: corpo,
                                            autenticata: autenticata, giaRinnovato: true)
                }
                throw ErroreNina.nonAutenticata
            }
            richiesta.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let dati: Data
        let risposta: URLResponse

        do {
            (dati, risposta) = try await sessione.data(for: richiesta)
        } catch let errore as URLError {
            switch errore.code {
            case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed:
                throw ErroreNina.offline
            case .timedOut:
                throw ErroreNina.timeout
            default:
                throw ErroreNina.offline
            }
        }

        guard let http = risposta as? HTTPURLResponse else {
            throw ErroreNina.sconosciuto("Risposta inattesa dal server.")
        }

        if (200..<300).contains(http.statusCode) {
            return dati
        }

        // 401: l'access token è scaduto. Si rinnova e si ripete, una volta sola.
        if http.statusCode == 401, autenticata, !giaRinnovato, refreshToken != nil {
            do {
                try await rinnova()
                return try await esegui(metodo, percorso, query: query, corpo: corpo,
                                        autenticata: autenticata, giaRinnovato: true)
            } catch {
                alLogout?()
                throw ErroreNina.sessioneScaduta
            }
        }

        throw traduci(stato: http.statusCode, dati: dati)
    }

    private func traduci(stato: Int, dati: Data) -> ErroreNina {
        let dettaglio = try? decodificatore.decode(ErroreAPI.self, from: dati)
        let messaggio = dettaglio?.error.message ?? "Qualcosa è andato storto 😅"

        switch stato {
        case 400, 409, 422: return .validazione(messaggio)
        case 401: return .sessioneScaduta
        case 403: return .validazione(messaggio)
        case 404: return .nonTrovato(messaggio)
        case 429: return .limite(messaggio)
        case 500...599: return .server(messaggio)
        default: return .sconosciuto(messaggio)
        }
    }

    // MARK: - Rinnovo del token

    private func rinnova() async throws {
        // Se un rinnovo è già in corso si aspetta quello.
        if let inCorso = refreshInCorso {
            try await inCorso.value
            return
        }

        let compito = Task<Void, Error> { [weak self] in
            guard let self else { return }
            try await self.eseguiRinnovo()
        }
        refreshInCorso = compito

        defer { refreshInCorso = nil }
        try await compito.value
    }

    private func eseguiRinnovo() async throws {
        guard let token = refreshToken else { throw ErroreNina.nonAutenticata }

        var richiesta = URLRequest(url: configurazione.baseURL.appendingPathComponent("auth/refresh"))
        richiesta.httpMethod = "POST"
        richiesta.setValue("application/json", forHTTPHeaderField: "Content-Type")
        richiesta.setValue(Portachiavi.deviceId, forHTTPHeaderField: "X-Nina-Device-Id")
        richiesta.httpBody = try codificatore.encode(RichiestaRefresh(refreshToken: token))

        let (dati, risposta) = try await sessione.data(for: richiesta)

        guard let http = risposta as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            // Il refresh è stato rifiutato: la sessione è finita davvero.
            cancellaSessione()
            throw ErroreNina.sessioneScaduta
        }

        let nuova = try decodificatore.decode(RispostaAutenticazione.self, from: dati)
        salvaSessione(nuova)
    }
}

/// Segnaposto per gli endpoint senza corpo di risposta interessante.
struct RispostaVuota: Codable, Sendable {}

// MARK: - Informazioni sul dispositivo

enum VersioneApp {
    static var corrente: String {
        let versione = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(versione) (\(build))"
    }
}

enum NomeDispositivo {
    @MainActor
    static var valore: String {
        UIDevice.current.name
    }
}
