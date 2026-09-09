// FILE: ios/Nina/Features/Impostazioni/SchermataImpostazioni.swift

import SwiftUI
import UserNotifications

struct SchermataImpostazioni: View {
    @Environment(Sessione.self) private var sessione
    @Environment(Deposito.self) private var deposito
    @Environment(MotoreSync.self) private var sync

    @State private var permessoNotifiche: UNAuthorizationStatus = .notDetermined
    @State private var mostraEliminaAccount = false
    @State private var mostraCambioNome = false
    @State private var dispositivi: [Dispositivo] = []

    struct Dispositivo: Codable, Identifiable, Sendable {
        let deviceId: String
        let name: String?
        let platform: String?
        let lastSeenAt: String
        let isCurrent: Bool
        var id: String { deviceId }
    }

    var body: some View {
        Form {
            sezioneProfilo
            sezioneAspetto
            sezioneNotifiche
            sezioneSincronizzazione
            sezioneDispositivi

            if sessione.eAmministratrice {
                sezioneAdmin
            }

            sezionePrivacy
            sezioneAccount
            sezioneInfo
        }
        .scrollContentBackground(.hidden)
        .background(SfondoNina())
        .navigationTitle("Impostazioni")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            permessoNotifiche = await PianificatoreNotifiche.condiviso.statoPermesso()
            dispositivi = await caricaDispositivi()
        }
        .sheet(isPresented: $mostraCambioNome) { ComeTiChiamo() }
        .sheet(isPresented: $mostraEliminaAccount) { EliminaAccount() }
    }

    // MARK: - Profilo

    private var sezioneProfilo: some View {
        Section {
            HStack(spacing: Spazio.normale) {
                ZStack {
                    Circle().fill(Palette.gradienteRosa).frame(width: 48, height: 48)
                    Text(String(sessione.nome.prefix(1)).uppercased())
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(Palette.testoSuRosa)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(sessione.nome).font(Tipo.corpoForte)
                    if let utente = sessione.utente {
                        Text(utente.email)
                            .font(.caption)
                            .foregroundStyle(Palette.testoTenue)
                    }
                }
            }
            .padding(.vertical, 4)

            Button("Cambia come mi chiami") { mostraCambioNome = true }

            if let utente = sessione.utente, !utente.emailVerified {
                Button("Rimanda l'email di conferma") {
                    Task {
                        _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
                            .post, "auth/resend-verification"
                        )
                    }
                }
                Label("Email non ancora confermata", systemImage: "exclamationmark.circle")
                    .font(.caption)
                    .foregroundStyle(Palette.attenzione)
            }
        }
        .listRowBackground(Palette.carta)
    }

    // MARK: - Aspetto

    private var sezioneAspetto: some View {
        Section("Aspetto") {
            Picker("Tema", selection: Binding(
                get: { deposito.impostazioni.tema },
                set: { nuovo in deposito.aggiornaImpostazioni { $0.tema = nuovo } }
            )) {
                ForEach(ThemePreference.allCases) { valore in
                    Text(valore.etichetta).tag(valore)
                }
            }
        }
        .listRowBackground(Palette.carta)
    }

    // MARK: - Notifiche

    private var sezioneNotifiche: some View {
        Section {
            if permessoNotifiche == .denied {
                VStack(alignment: .leading, spacing: Spazio.piccolo) {
                    Text("Le notifiche sono disattivate nelle impostazioni di iOS.")
                        .font(Tipo.didascalia)
                        .foregroundStyle(Palette.testoTenue)

                    Button("Apri le impostazioni di iOS") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                    .font(Tipo.etichetta)
                }
            } else if permessoNotifiche == .notDetermined {
                Button("Attiva le notifiche") {
                    Task {
                        _ = await PianificatoreNotifiche.condiviso.chiediPermesso()
                        permessoNotifiche = await PianificatoreNotifiche.condiviso.statoPermesso()
                        await PianificatoreNotifiche.condiviso.riprogramma(deposito: deposito)
                    }
                }
            }

            interruttore("Buongiorno", chiave: \.notificheMattina)

            if deposito.impostazioni.notificheMattina {
                selettoreOrario("A che ora", chiave: \.oraMattina)
            }

            interruttore("Riepilogo della sera", chiave: \.notificheSera)

            if deposito.impostazioni.notificheSera {
                selettoreOrario("A che ora", chiave: \.oraSera)
            }

            interruttore("Promemoria delle attività", chiave: \.notificheAttivita)
            interruttore("Promemoria delle abitudini", chiave: \.notificheAbitudini)
            interruttore("Inviti al self care", chiave: \.notificheSelfCare)
        } header: {
            Text("Notifiche")
        } footer: {
            Text("Non ti riempio di notifiche: al massimo una al mattino, una la sera e i promemoria che imposti tu.")
        }
        .listRowBackground(Palette.carta)
    }

    private func interruttore(_ titolo: String, chiave: ReferenceWritableKeyPath<Impostazioni, Bool>) -> some View {
        Toggle(titolo, isOn: Binding(
            get: { deposito.impostazioni[keyPath: chiave] },
            set: { nuovo in
                deposito.aggiornaImpostazioni { $0[keyPath: chiave] = nuovo }
                Task { await PianificatoreNotifiche.condiviso.riprogramma(deposito: deposito) }
            }
        ))
    }

    private func selettoreOrario(_ titolo: String, chiave: ReferenceWritableKeyPath<Impostazioni, String>) -> some View {
        DatePicker(
            titolo,
            selection: Binding(
                get: {
                    CalendarioNina.data(giorno: CalendarioNina.oggi, ora: deposito.impostazioni[keyPath: chiave]) ?? Date()
                },
                set: { nuovo in
                    deposito.aggiornaImpostazioni { $0[keyPath: chiave] = CalendarioNina.ora(da: nuovo) }
                    Task { await PianificatoreNotifiche.condiviso.riprogramma(deposito: deposito) }
                }
            ),
            displayedComponents: .hourAndMinute
        )
    }

    // MARK: - Sincronizzazione

    private var sezioneSincronizzazione: some View {
        Section {
            HStack {
                Text("Stato")
                Spacer()
                Text(descrizioneStato)
                    .font(Tipo.didascalia)
                    .foregroundStyle(Palette.testoTenue)
            }

            if deposito.modificheInAttesa > 0 {
                HStack {
                    Text("Da inviare")
                    Spacer()
                    Text("\(deposito.modificheInAttesa)")
                        .font(Tipo.didascalia)
                        .foregroundStyle(Palette.attenzione)
                }
            }

            Button("Sincronizza adesso") { sync.sincronizza() }
        } header: {
            Text("Sincronizzazione")
        } footer: {
            Text("Tutto quello che scrivi viene salvato subito qui e inviato appena c'è rete. iPhone e iPad restano allineati da soli.")
        }
        .listRowBackground(Palette.carta)
    }

    private var descrizioneStato: String {
        switch sync.stato {
        case .ferma:
            deposito.stato.ultimaSincronizzazione == nil ? "Mai" : "Aggiornato"
        case .inCorso:
            "In corso…"
        case .completata(let quando):
            "Alle \(CalendarioNina.ora(da: quando))"
        case .errore:
            "Non riuscita"
        }
    }

    // MARK: - Dispositivi

    @ViewBuilder
    private var sezioneDispositivi: some View {
        if !dispositivi.isEmpty {
            Section("I miei dispositivi") {
                ForEach(dispositivi) { dispositivo in
                    HStack {
                        Image(systemName: dispositivo.name?.lowercased().contains("ipad") == true
                              ? "ipad" : "iphone")
                            .foregroundStyle(Palette.rosa)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(dispositivo.name ?? "Dispositivo")
                                .font(Tipo.corpo)
                            Text(dispositivo.isCurrent
                                 ? "Questo dispositivo"
                                 : "Ultimo accesso: \(testoData(dispositivo.lastSeenAt))")
                                .font(.caption)
                                .foregroundStyle(Palette.testoTenue)
                        }
                    }
                }
            }
            .listRowBackground(Palette.carta)
        }
    }

    private func testoData(_ iso: String) -> String {
        guard let data = CalendarioNina.data(daIso: iso) else { return "—" }
        return CalendarioNina.testoRelativo(CalendarioNina.giorno(da: data))
    }

    private func caricaDispositivi() async -> [Dispositivo] {
        struct Elenco: Codable, Sendable { let items: [Dispositivo] }
        let risposta: Elenco? = try? await ClientAPI.condiviso.richiesta(.get, "me/devices")
        return risposta?.items ?? []
    }

    // MARK: - Admin

    private var sezioneAdmin: some View {
        Section {
            NavigationLink {
                SchermataAdmin()
            } label: {
                Label("Pannello amministratore", systemImage: "key.fill")
            }
        }
        .listRowBackground(Palette.carta)
    }

    // MARK: - Privacy

    private var sezionePrivacy: some View {
        Section {
            Button("Scarica tutti i miei dati") {
                Task { await esportaDati() }
            }
        } header: {
            Text("Privacy")
        } footer: {
            Text("Il diario e i messaggi a Nina sono privati: nessuna funzione di amministrazione può leggerli.")
        }
        .listRowBackground(Palette.carta)
    }

    private func esportaDati() async {
        guard let dati = try? await ClientAPI.condiviso.richiestaSenzaRisposta(.get, "me/export") else { return }

        let percorso = FileManager.default.temporaryDirectory.appendingPathComponent("nina-dati.json")
        try? dati.write(to: percorso)

        await MainActor.run {
            let condivisione = UIActivityViewController(activityItems: [percorso], applicationActivities: nil)
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first?.keyWindow?.rootViewController?
                .present(condivisione, animated: true)
        }
    }

    // MARK: - Account

    private var sezioneAccount: some View {
        Section {
            Button("Esci") {
                Task { await sessione.esci() }
            }

            Button("Elimina il mio account", role: .destructive) {
                mostraEliminaAccount = true
            }
        }
        .listRowBackground(Palette.carta)
    }

    // MARK: - Info

    private var sezioneInfo: some View {
        Section {
            HStack {
                Text("Versione")
                Spacer()
                Text(VersioneApp.corrente)
                    .font(Tipo.didascalia)
                    .foregroundStyle(Palette.testoTenue)
            }
        } footer: {
            Text("Fatta con 💗")
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .listRowBackground(Palette.carta)
    }
}

// MARK: - Eliminazione dell'account

struct EliminaAccount: View {
    @Environment(Sessione.self) private var sessione
    @Environment(\.dismiss) private var chiudi

    @State private var password = ""
    @State private var conferma = ""
    @State private var inCorso = false

    private let fraseRichiesta = "ELIMINA IL MIO ACCOUNT"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spazio.comodo) {
                    Text("Eliminare l'account")
                        .font(Tipo.titolone)
                        .foregroundStyle(Palette.testo)

                    Text("Vengono cancellati davvero, subito e per sempre: le tue attività, le abitudini, i mood, il diario, la wishlist e le sessioni. Non è un archivio nascosto — è una cancellazione dal database.")
                        .font(Tipo.corpo)
                        .foregroundStyle(Palette.testoTenue)
                        .lettura()

                    Text("Se vuoi prima una copia, chiudi e usa «Scarica tutti i miei dati».")
                        .font(Tipo.didascalia)
                        .foregroundStyle(Palette.testoTenue)

                    CampoPassword(etichetta: "La tua password", testo: $password)

                    CampoTesto(
                        etichetta: "Scrivi «\(fraseRichiesta)»",
                        segnaposto: fraseRichiesta,
                        autocapitalizzazione: .characters,
                        testo: $conferma
                    )

                    if let errore = sessione.messaggioErrore {
                        AvvisoErrore(messaggio: errore)
                    }

                    Button {
                        Task {
                            inCorso = true
                            let fatto = await sessione.eliminaAccount(password: password)
                            inCorso = false
                            if fatto { chiudi() }
                        }
                    } label: {
                        HStack {
                            if inCorso { ProgressView().tint(.white) }
                            Text("Elimina definitivamente").font(Tipo.corpoForte)
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spazio.normale)
                        .background(Palette.errore, in: Capsule())
                    }
                    .disabled(password.isEmpty || conferma != fraseRichiesta || inCorso)
                    .opacity(password.isEmpty || conferma != fraseRichiesta ? 0.5 : 1)
                }
                .padding(Spazio.comodo)
            }
            .sfondoNina()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { chiudi() } }
            }
        }
    }
}
