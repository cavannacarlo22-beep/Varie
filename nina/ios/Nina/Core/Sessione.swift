// FILE: ios/Nina/Core/Sessione.swift
//
// Chi sta usando l'app, e in che stato si trova.
//
// È l'unico oggetto che sa se siamo dentro o fuori. Tutte le schermate lo
// leggono dall'ambiente; nessuna tiene una copia dell'utente per conto suo,
// perché due copie prima o poi divergono.

import Foundation
import SwiftUI

@MainActor
@Observable
final class Sessione {

    enum Stato: Equatable {
        /// All'avvio, mentre si controlla se c'è già una sessione salvata.
        case controllo
        /// Prima apertura: si mostra l'onboarding.
        case primoAvvio
        /// Fuori.
        case fuori
        /// Dentro.
        case dentro(UtenteDTO)
    }

    private(set) var stato: Stato = .controllo
    var messaggioErrore: String?
    var inCorso = false

    private let client: ClientAPI
    private let deposito: Deposito
    private let sync: MotoreSync

    /// L'onboarding si mostra una sola volta per installazione.
    @ObservationIgnored
    @AppStorage("onboarding-visto") private var onboardingVisto = false

    init(client: ClientAPI = .condiviso, deposito: Deposito, sync: MotoreSync) {
        self.client = client
        self.deposito = deposito
        self.sync = sync
    }

    var utente: UtenteDTO? {
        if case .dentro(let utente) = stato { return utente }
        return nil
    }

    var eAmministratrice: Bool { utente?.role == .admin }

    /// Come Nina chiama questa persona.
    var nome: String { utente?.displayName ?? "" }

    // MARK: - Avvio

    func avvia() async {
        await client.impostaCallbackLogout { [weak self] in
            Task { @MainActor in self?.sessioneScaduta() }
        }

        guard await client.haUnaSessione else {
            stato = onboardingVisto ? .fuori : .primoAvvio
            return
        }

        do {
            let utente: UtenteDTO = try await client.richiesta(.get, "me")
            stato = .dentro(utente)
            dopoLAccesso()
        } catch let errore as ErroreNina where !errore.definitivo {
            // Nessuna rete all'avvio: si entra lo stesso con i dati locali.
            // È il punto in cui un'app "offline first" si distingue da una che
            // dice solo di esserlo.
            if let salvato = utenteSalvato {
                stato = .dentro(salvato)
                dopoLAccesso()
            } else {
                stato = .fuori
            }
        } catch {
            await client.cancellaSessione()
            stato = .fuori
        }
    }

    // MARK: - Registrazione e accesso

    func registrati(nome: String, cognome: String, email: String, password: String) async {
        await esegui {
            let risposta: RispostaAutenticazione = try await self.client.richiesta(
                .post, "auth/register",
                corpo: RichiestaRegistrazione(
                    email: email, password: password,
                    firstName: nome, lastName: cognome, displayName: nil
                ),
                autenticata: false
            )
            await self.entra(con: risposta)
        }
    }

    func accedi(email: String, password: String) async {
        await esegui {
            let risposta: RispostaAutenticazione = try await self.client.richiesta(
                .post, "auth/login",
                corpo: RichiestaLogin(email: email, password: password),
                autenticata: false
            )
            await self.entra(con: risposta)
        }
    }

    func passwordDimenticata(email: String) async -> Bool {
        do {
            let _: RispostaOk = try await client.richiesta(
                .post, "auth/forgot-password",
                corpo: RichiestaEmail(email: email),
                autenticata: false
            )
            return true
        } catch {
            messaggioErrore = (error as? ErroreNina)?.localizedDescription ?? VoceDiNina.erroreGentile()
            return false
        }
    }

    private func entra(con risposta: RispostaAutenticazione) async {
        await client.salvaSessione(risposta)
        salva(utente: risposta.user)
        onboardingVisto = true
        stato = .dentro(risposta.user)
        dopoLAccesso()
    }

    private func dopoLAccesso() {
        sync.sincronizza()
        sync.avviaFlusso()
    }

    // MARK: - Profilo

    func aggiornaNomeVisualizzato(_ nuovo: String) async {
        guard !nuovo.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        do {
            let aggiornato: UtenteDTO = try await client.richiesta(
                .put, "me", corpo: AggiornaProfilo(displayName: nuovo)
            )
            salva(utente: aggiornato)
            stato = .dentro(aggiornato)
        } catch {
            messaggioErrore = (error as? ErroreNina)?.localizedDescription
        }
    }

    func ricaricaProfilo() async {
        guard case .dentro = stato else { return }
        if let utente: UtenteDTO = try? await client.richiesta(.get, "me") {
            salva(utente: utente)
            stato = .dentro(utente)
        }
    }

    // MARK: - Uscita

    func esci() async {
        sync.fermaFlusso()

        if let refresh = Portachiavi.leggi(.refreshToken) {
            // Il logout sul server è utile ma non indispensabile: se fallisce,
            // localmente si esce lo stesso. Non si lascia una persona bloccata
            // dentro l'app perché il server non risponde.
            _ = try? await client.richiestaSenzaRisposta(
                .post, "auth/logout",
                corpo: RichiestaRefresh(refreshToken: refresh),
                autenticata: false
            )
        }

        await client.cancellaSessione()
        deposito.svuota()
        dimenticaUtente()
        stato = .fuori
    }

    func eliminaAccount(password: String) async -> Bool {
        struct Conferma: Codable, Sendable {
            let password: String
            let confirm: String
        }

        do {
            let _: RispostaOk = try await client.richiesta(
                .delete, "me",
                corpo: Conferma(password: password, confirm: "ELIMINA IL MIO ACCOUNT")
            )
            await client.cancellaSessione()
            deposito.svuota()
            dimenticaUtente()
            stato = .fuori
            return true
        } catch {
            messaggioErrore = (error as? ErroreNina)?.localizedDescription ?? VoceDiNina.erroreGentile()
            return false
        }
    }

    private func sessioneScaduta() {
        sync.fermaFlusso()
        stato = .fuori
        messaggioErrore = "La sessione è scaduta. Accedi di nuovo."
    }

    func onboardingCompletato() {
        onboardingVisto = true
        if case .primoAvvio = stato { stato = .fuori }
    }

    // MARK: - Copia locale dell'utente
    //
    // Serve per entrare anche senza rete. Contiene solo dati di profilo, mai
    // token: quelli stanno nel portachiavi.

    private static let chiaveUtente = "utente-corrente"

    private var utenteSalvato: UtenteDTO? {
        guard let dati = UserDefaults.standard.data(forKey: Self.chiaveUtente) else { return nil }
        return try? JSONDecoder().decode(UtenteDTO.self, from: dati)
    }

    private func salva(utente: UtenteDTO) {
        guard let dati = try? JSONEncoder().encode(utente) else { return }
        UserDefaults.standard.set(dati, forKey: Self.chiaveUtente)
    }

    private func dimenticaUtente() {
        UserDefaults.standard.removeObject(forKey: Self.chiaveUtente)
    }

    // MARK: - Utilità

    private func esegui(_ operazione: @escaping () async throws -> Void) async {
        inCorso = true
        messaggioErrore = nil
        defer { inCorso = false }

        do {
            try await operazione()
        } catch let errore as ErroreNina {
            messaggioErrore = errore.localizedDescription
        } catch {
            messaggioErrore = VoceDiNina.erroreGentile()
        }
    }
}
