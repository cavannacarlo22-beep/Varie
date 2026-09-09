// FILE: ios/Nina/Features/Admin/SchermataAdmin.swift
//
// Il pannello amministratore.
//
// Nota importante: questa schermata non è la sicurezza. La sicurezza è nel
// backend, che rilegge il ruolo a ogni richiesta e risponde 404 a chiunque non
// sia amministratore. Qui si nasconde solo un bottone che non servirebbe.
//
// E non c'è nessuna funzione per leggere i diari o le conversazioni: non perché
// l'app non le mostri, ma perché l'API non le espone.

import SwiftUI

struct SchermataAdmin: View {
    @State private var sezione: Sezione = .statistiche

    enum Sezione: String, CaseIterable, Identifiable {
        case statistiche, utenti, frasi, selfCare
        var id: String { rawValue }
        var etichetta: String {
            switch self {
            case .statistiche: "Numeri"
            case .utenti: "Utenti"
            case .frasi: "Frasi"
            case .selfCare: "Self Care"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("Sezione", selection: $sezione) {
                ForEach(Sezione.allCases) { valore in
                    Text(valore.etichetta).tag(valore)
                }
            }
            .pickerStyle(.segmented)
            .padding(Spazio.normale)

            switch sezione {
            case .statistiche: AdminStatistiche()
            case .utenti: AdminUtenti()
            case .frasi: AdminFrasi()
            case .selfCare: AdminSelfCare()
            }
        }
        .sfondoNina()
        .navigationTitle("Admin")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Statistiche

private struct AdminStatistiche: View {
    struct Dati: Codable, Sendable {
        struct Utenti: Codable, Sendable {
            let total, active, verified, newLast7Days, activeLast7Days: Int
        }
        struct Contenuti: Codable, Sendable {
            let tasks, tasksCompleted, habits, habitCompletions: Int
            let moods, diaryEntries, wishlistItems, friendMessages: Int
        }
        struct Catalogo: Codable, Sendable {
            let quotes, quotesActive, selfCareIdeas, selfCareActive: Int
        }
        let users: Utenti
        let content: Contenuti
        let catalog: Catalogo
    }

    @State private var dati: Dati?
    @State private var errore: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.sezione) {
                if let errore {
                    AvvisoErrore(messaggio: errore)
                }

                if let dati {
                    gruppo("Persone", voci: [
                        ("Utenti", dati.users.total),
                        ("Attivi", dati.users.active),
                        ("Email confermate", dati.users.verified),
                        ("Nuovi (7 giorni)", dati.users.newLast7Days),
                        ("Attivi (7 giorni)", dati.users.activeLast7Days),
                    ])

                    gruppo("Utilizzo", voci: [
                        ("Attività", dati.content.tasks),
                        ("Completate", dati.content.tasksCompleted),
                        ("Abitudini", dati.content.habits),
                        ("Spuntate", dati.content.habitCompletions),
                        ("Mood", dati.content.moods),
                        ("Pagine di diario", dati.content.diaryEntries),
                        ("Desideri", dati.content.wishlistItems),
                        ("Messaggi a Nina", dati.content.friendMessages),
                    ])

                    gruppo("Catalogo", voci: [
                        ("Frasi", dati.catalog.quotes),
                        ("Frasi attive", dati.catalog.quotesActive),
                        ("Idee self care", dati.catalog.selfCareIdeas),
                        ("Idee attive", dati.catalog.selfCareActive),
                    ])

                    Text("Sono conteggi. Il contenuto dei diari e delle conversazioni non è accessibile da nessuna funzione amministrativa.")
                        .font(.caption)
                        .foregroundStyle(Palette.testoTenue)
                        .lettura()
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, Spazio.ampio)
                }
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .task { await carica() }
        .refreshable { await carica() }
    }

    private func gruppo(_ titolo: String, voci: [(String, Int)]) -> some View {
        VStack(alignment: .leading, spacing: Spazio.medio) {
            IntestazioneSezione(titolo)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: Spazio.medio)], spacing: Spazio.medio) {
                ForEach(voci, id: \.0) { etichetta, valore in
                    Card(riempimento: Spazio.normale) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(valore)")
                                .font(.system(.title2, design: .rounded, weight: .bold))
                                .foregroundStyle(Palette.testo)
                            Text(etichetta)
                                .font(.caption)
                                .foregroundStyle(Palette.testoTenue)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
    }

    private func carica() async {
        do {
            dati = try await ClientAPI.condiviso.richiesta(.get, "admin/stats")
            errore = nil
        } catch {
            errore = (error as? ErroreNina)?.localizedDescription ?? VoceDiNina.erroreGentile()
        }
    }
}

// MARK: - Utenti

private struct AdminUtenti: View {
    struct Utente: Codable, Identifiable, Sendable {
        let id: UUID
        let email, firstName, lastName, displayName: String
        let role: UserRole
        let isActive, emailVerified: Bool
        let createdAt: String
        let lastLoginAt: String?
        let taskCount, habitCount, diaryCount: Int
    }

    @State private var utenti: [Utente] = []
    @State private var ricerca = ""

    var body: some View {
        List {
            ForEach(utenti) { utente in
                VStack(alignment: .leading, spacing: Spazio.piccolo) {
                    HStack {
                        Text(utente.displayName).font(Tipo.corpoForte)
                        if utente.role == .admin {
                            Pillola(testo: "Admin", icona: "key.fill")
                        }
                        if !utente.isActive {
                            Pillola(testo: "Disattivato", colore: Palette.errore)
                        }
                        Spacer()
                    }

                    Text(utente.email)
                        .font(.caption)
                        .foregroundStyle(Palette.testoTenue)

                    HStack(spacing: Spazio.medio) {
                        Label("\(utente.taskCount)", systemImage: "checkmark.circle")
                        Label("\(utente.habitCount)", systemImage: "flame")
                        Label("\(utente.diaryCount)", systemImage: "book.closed")
                    }
                    .font(.caption2)
                    .foregroundStyle(Palette.testoTenue)

                    if let accesso = utente.lastLoginAt, let data = CalendarioNina.data(daIso: accesso) {
                        Text("Ultimo accesso: \(CalendarioNina.testoRelativo(CalendarioNina.giorno(da: data)))")
                            .font(.caption2)
                            .foregroundStyle(Palette.testoTenue)
                    }
                }
                .padding(.vertical, 4)
                .listRowBackground(Palette.carta)
                .swipeActions {
                    Button(utente.isActive ? "Disattiva" : "Attiva") {
                        Task { await cambiaStato(utente) }
                    }
                    .tint(utente.isActive ? Palette.errore : Palette.successo)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .searchable(text: $ricerca, prompt: "Cerca per nome o email")
        .task(id: ricerca) { await carica() }
        .refreshable { await carica() }
    }

    private func carica() async {
        struct Elenco: Codable, Sendable { let items: [Utente]; let total: Int }
        let query = ricerca.isEmpty ? [:] : ["search": ricerca]
        let risposta: Elenco? = try? await ClientAPI.condiviso.richiesta(.get, "admin/users", query: query)
        utenti = risposta?.items ?? []
    }

    private func cambiaStato(_ utente: Utente) async {
        struct Corpo: Codable, Sendable { let isActive: Bool }
        _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
            .post, "admin/users/\(utente.id.uuidString.lowercased())/active",
            corpo: Corpo(isActive: !utente.isActive)
        )
        await carica()
    }
}

// MARK: - Frasi

private struct AdminFrasi: View {
    @State private var frasi: [FraseDTO] = []
    @State private var mostraNuova = false
    @State private var testoNuova = ""
    @State private var autoreNuova = ""

    var body: some View {
        List {
            Section {
                Button {
                    mostraNuova = true
                } label: {
                    Label("Aggiungi una frase", systemImage: "plus.circle.fill")
                }
                .listRowBackground(Palette.carta)
            }

            ForEach(frasi, id: \.id) { frase in
                VStack(alignment: .leading, spacing: 4) {
                    Text(frase.text)
                        .font(Tipo.corpoDiario)
                        .foregroundStyle(frase.isActive ? Palette.testo : Palette.testoTenue)

                    HStack {
                        if let autore = frase.author {
                            Text(autore).font(.caption).foregroundStyle(Palette.testoTenue)
                        }
                        if !frase.isActive {
                            Pillola(testo: "Nascosta", colore: Palette.testoTenue)
                        }
                    }
                }
                .padding(.vertical, 4)
                .listRowBackground(Palette.carta)
                .swipeActions {
                    Button("Elimina", role: .destructive) {
                        Task { await elimina(frase) }
                    }
                    Button(frase.isActive ? "Nascondi" : "Mostra") {
                        Task { await alterna(frase) }
                    }
                    .tint(Palette.rosa)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .task { await carica() }
        .refreshable { await carica() }
        .alert("Nuova frase", isPresented: $mostraNuova) {
            TextField("Il testo della frase", text: $testoNuova)
            TextField("Autore (facoltativo)", text: $autoreNuova)
            Button("Annulla", role: .cancel) { testoNuova = ""; autoreNuova = "" }
            Button("Aggiungi") { Task { await aggiungi() } }
        }
    }

    private func carica() async {
        struct Elenco: Codable, Sendable { let items: [FraseDTO]; let total: Int }
        let risposta: Elenco? = try? await ClientAPI.condiviso.richiesta(.get, "admin/quotes")
        frasi = risposta?.items ?? []
    }

    private func aggiungi() async {
        struct Corpo: Codable, Sendable { let text: String; let author: String? }
        let testo = testoNuova.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !testo.isEmpty else { return }

        _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
            .post, "admin/quotes",
            corpo: Corpo(text: testo, author: autoreNuova.isEmpty ? nil : autoreNuova)
        )
        testoNuova = ""
        autoreNuova = ""
        await carica()
    }

    private func alterna(_ frase: FraseDTO) async {
        struct Corpo: Codable, Sendable { let isActive: Bool }
        _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
            .put, "admin/quotes/\(frase.id.uuidString.lowercased())",
            corpo: Corpo(isActive: !frase.isActive)
        )
        await carica()
    }

    private func elimina(_ frase: FraseDTO) async {
        _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
            .delete, "admin/quotes/\(frase.id.uuidString.lowercased())"
        )
        await carica()
    }
}

// MARK: - Self care

private struct AdminSelfCare: View {
    @State private var idee: [IdeaSelfCareDTO] = []
    @State private var mostraNuova = false
    @State private var titoloNuova = ""
    @State private var dettaglioNuova = ""

    var body: some View {
        List {
            Section {
                Button {
                    mostraNuova = true
                } label: {
                    Label("Aggiungi un'idea", systemImage: "plus.circle.fill")
                }
                .listRowBackground(Palette.carta)
            }

            ForEach(idee, id: \.id) { idea in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(idea.category.emoji)
                        Text(idea.title)
                            .font(Tipo.corpoForte)
                            .foregroundStyle(idea.isActive ? Palette.testo : Palette.testoTenue)
                    }
                    if let dettaglio = idea.description {
                        Text(dettaglio).font(.caption).foregroundStyle(Palette.testoTenue)
                    }
                }
                .padding(.vertical, 4)
                .listRowBackground(Palette.carta)
                .swipeActions {
                    Button("Elimina", role: .destructive) {
                        Task {
                            _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
                                .delete, "admin/self-care/\(idea.id.uuidString.lowercased())"
                            )
                            await carica()
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .task { await carica() }
        .refreshable { await carica() }
        .alert("Nuova idea", isPresented: $mostraNuova) {
            TextField("Titolo", text: $titoloNuova)
            TextField("Descrizione", text: $dettaglioNuova)
            Button("Annulla", role: .cancel) { titoloNuova = ""; dettaglioNuova = "" }
            Button("Aggiungi") { Task { await aggiungi() } }
        }
    }

    private func carica() async {
        struct Elenco: Codable, Sendable { let items: [IdeaSelfCareDTO]; let total: Int }
        let risposta: Elenco? = try? await ClientAPI.condiviso.richiesta(.get, "admin/self-care")
        idee = risposta?.items ?? []
    }

    private func aggiungi() async {
        struct Corpo: Codable, Sendable {
            let title: String
            let description: String?
            let category: String
        }

        let titolo = titoloNuova.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !titolo.isEmpty else { return }

        _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
            .post, "admin/self-care",
            corpo: Corpo(
                title: titolo,
                description: dettaglioNuova.isEmpty ? nil : dettaglioNuova,
                category: SelfCareCategory.relax.rawValue
            )
        )
        titoloNuova = ""
        dettaglioNuova = ""
        await carica()
    }
}
