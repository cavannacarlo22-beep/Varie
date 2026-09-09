// FILE: ios/Nina/App/ContenitorePrincipale.swift
//
// La navigazione principale.
//
// Su iPhone: quattro schede in basso.
// Su iPad: una barra laterale con le sezioni aperte, perché su uno schermo da
// undici pollici quattro schede in fondo lasciano metà spazio inutilizzato e
// costringono a entrare e uscire dalle sezioni per cose che potrebbero stare
// una accanto all'altra.
//
// Non è "l'iPhone ingrandito": la barra laterale mostra le sette voci di "Me"
// come voci di primo livello, perché lì c'è spazio per farlo.

import SwiftUI

enum Sezione: String, Hashable, CaseIterable, Identifiable {
    case home, todo, calendario, me
    case mood, abitudini, selfCare, diario, wishlist, progressi, amica
    case impostazioni, admin

    var id: String { rawValue }

    var titolo: String {
        switch self {
        case .home: "Home"
        case .todo: "To Do"
        case .calendario: "Calendario"
        case .me: "Me"
        case .mood: "Mood"
        case .abitudini: "Abitudini"
        case .selfCare: "Self Care"
        case .diario: "Diario"
        case .wishlist: "Wishlist"
        case .progressi: "Progressi"
        case .amica: "La mia amica"
        case .impostazioni: "Impostazioni"
        case .admin: "Admin"
        }
    }

    var icona: String {
        switch self {
        case .home: "house.fill"
        case .todo: "checkmark.circle.fill"
        case .calendario: "calendar"
        case .me: "heart.fill"
        case .mood: "face.smiling"
        case .abitudini: "flame.fill"
        case .selfCare: "leaf.fill"
        case .diario: "book.closed.fill"
        case .wishlist: "sparkles"
        case .progressi: "chart.bar.fill"
        case .amica: "bubble.left.and.bubble.right.fill"
        case .impostazioni: "gearshape.fill"
        case .admin: "key.fill"
        }
    }
}

struct ContenitorePrincipale: View {
    @Environment(\.horizontalSizeClass) private var classeOrizzontale

    var body: some View {
        if classeOrizzontale == .regular {
            LayoutIPad()
        } else {
            LayoutIPhone()
        }
    }
}

// MARK: - iPhone

private struct LayoutIPhone: View {
    @Environment(Sessione.self) private var sessione
    @State private var scheda: Sezione = .home

    var body: some View {
        TabView(selection: $scheda) {
            NavigationStack { Home() }
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(Sezione.home)

            NavigationStack { ElencoAttivita() }
                .tabItem { Label("To Do", systemImage: "checkmark.circle.fill") }
                .tag(Sezione.todo)

            NavigationStack { Calendario() }
                .tabItem { Label("Calendario", systemImage: "calendar") }
                .tag(Sezione.calendario)

            NavigationStack { AreaMe() }
                .tabItem { Label("Me", systemImage: "heart.fill") }
                .tag(Sezione.me)
        }
        .tint(Palette.rosa)
    }
}

// MARK: - iPad

private struct LayoutIPad: View {
    @Environment(Sessione.self) private var sessione
    @State private var selezione: Sezione? = .home

    private let principali: [Sezione] = [.home, .todo, .calendario]
    private let personali: [Sezione] = [.mood, .abitudini, .selfCare, .diario, .wishlist, .progressi, .amica]

    var body: some View {
        NavigationSplitView {
            List(selection: $selezione) {
                Section {
                    ForEach(principali) { sezione in
                        Label(sezione.titolo, systemImage: sezione.icona).tag(sezione)
                    }
                }

                Section("Me") {
                    ForEach(personali) { sezione in
                        Label(sezione.titolo, systemImage: sezione.icona).tag(sezione)
                    }
                }

                Section {
                    Label(Sezione.impostazioni.titolo, systemImage: Sezione.impostazioni.icona)
                        .tag(Sezione.impostazioni)

                    // La voce Admin esiste solo per chi è amministratrice.
                    // Il backend risponde comunque 404 a chiunque altro: questo
                    // è solo il motivo per cui non si vede il bottone.
                    if sessione.eAmministratrice {
                        Label(Sezione.admin.titolo, systemImage: Sezione.admin.icona)
                            .tag(Sezione.admin)
                    }
                }
            }
            .navigationTitle("Nina")
            .listStyle(.sidebar)
            .tint(Palette.rosa)
        } detail: {
            NavigationStack {
                switch selezione ?? .home {
                case .home: Home()
                case .todo: ElencoAttivita()
                case .calendario: Calendario()
                case .me: AreaMe()
                case .mood: SchermataMood()
                case .abitudini: SchermataAbitudini()
                case .selfCare: SchermataSelfCare()
                case .diario: SchermataDiario()
                case .wishlist: SchermataWishlist()
                case .progressi: SchermataProgressi()
                case .amica: SchermataAmica()
                case .impostazioni: SchermataImpostazioni()
                case .admin: SchermataAdmin()
                }
            }
        }
        .tint(Palette.rosa)
    }
}
