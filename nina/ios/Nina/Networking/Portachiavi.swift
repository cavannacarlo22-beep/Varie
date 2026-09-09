// FILE: ios/Nina/Networking/Portachiavi.swift
//
// I token stanno nel portachiavi di iOS, non in UserDefaults.
//
// UserDefaults è un file plist non cifrato dentro la sandbox dell'app: finisce
// nei backup, è leggibile da chi ha accesso al backup e sopravvive alla
// disinstallazione in modi imprevedibili. Il portachiavi è cifrato dal sistema
// e legato al dispositivo.
//
// `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` è la classe di accesso
// giusta qui: dopo il primo sblocco il token è leggibile (serve alle
// sincronizzazioni in background), ma non esce mai dal telefono — nemmeno in
// un backup ripristinato su un altro dispositivo.

import Foundation
import Security

enum Portachiavi {

    private static let servizio = "it.nina.app"

    enum Chiave: String {
        case accessToken = "access-token"
        case refreshToken = "refresh-token"
        case deviceId = "device-id"
    }

    // MARK: - Lettura e scrittura

    static func salva(_ valore: String, per chiave: Chiave) {
        guard let dati = valore.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servizio,
            kSecAttrAccount as String: chiave.rawValue,
        ]

        let attributi: [String: Any] = [
            kSecValueData as String: dati,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        // Prima si prova ad aggiornare: SecItemAdd fallisce se la voce esiste già.
        let esito = SecItemUpdate(query as CFDictionary, attributi as CFDictionary)

        if esito == errSecItemNotFound {
            SecItemAdd(query.merging(attributi) { $1 } as CFDictionary, nil)
        }
    }

    static func leggi(_ chiave: Chiave) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servizio,
            kSecAttrAccount as String: chiave.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var risultato: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &risultato) == errSecSuccess,
              let dati = risultato as? Data,
              let testo = String(data: dati, encoding: .utf8)
        else { return nil }

        return testo
    }

    static func cancella(_ chiave: Chiave) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servizio,
            kSecAttrAccount as String: chiave.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }

    /// Cancella i token, ma **non** l'id del dispositivo.
    ///
    /// L'id deve sopravvivere al logout: è ciò che permette al server di
    /// riconoscere lo stesso iPad al prossimo accesso, invece di considerarlo
    /// un dispositivo nuovo ogni volta.
    static func cancellaSessione() {
        cancella(.accessToken)
        cancella(.refreshToken)
    }

    // MARK: - Identificativo del dispositivo

    /// Id stabile di questo dispositivo, generato al primo avvio.
    ///
    /// Non si usa `identifierForVendor` di Apple: cambia quando l'utente
    /// disinstalla tutte le app dello stesso sviluppatore, e non è pensato per
    /// essere un identificativo persistente.
    static var deviceId: String {
        if let esistente = leggi(.deviceId) { return esistente }
        let nuovo = UUID().uuidString
        salva(nuovo, per: .deviceId)
        return nuovo
    }
}
