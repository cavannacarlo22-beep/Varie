// FILE: ios/Nina/Features/Attivita/ElencoAttivita.swift
//
// La To Do vera e propria: tutte le attività, non solo quelle di oggi.
//
// L'organizzazione è per *quando*, non per categoria o priorità, perché la
// domanda che ci si fa aprendo una lista è "cosa devo fare adesso" e non "cosa
// c'è nella categoria casa". I filtri esistono, ma non sono l'impostazione
// predefinita: una lista già filtrata nasconde cose, e nascondere cose in una
// to do è il modo migliore per non fidarsene più.

import SwiftUI
import SwiftData

struct ElencoAttivita: View {
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<Attivita> { $0.deletedAt == nil },
           sort: [SortDescriptor(\Attivita.giorno), SortDescriptor(\Attivita.ora)])
    private var attivita: [Attivita]

    @State private var mostraNuova = false
    @State private var categoriaFiltro: TaskCategory?
    @State private var nascondiCompletate = false
    @State private var ricerca = ""

    private let oggi = CalendarioNina.oggi

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spazio.sezione, pinnedViews: [.sectionHeaders]) {
                filtri

                ForEach(gruppi, id: \.titolo) { gruppo in
                    Section {
                        VStack(spacing: Spazio.piccolo) {
                            ForEach(gruppo.attivita) { singola in
                                RigaAttivita(attivita: singola)
                            }
                        }
                    } header: {
                        intestazione(gruppo)
                    }
                }

                if gruppi.isEmpty {
                    Card {
                        StatoVuoto(
                            icona: ricerca.isEmpty ? "checkmark.circle" : "magnifyingglass",
                            titolo: ricerca.isEmpty ? "Non c'è niente in lista" : "Nessun risultato",
                            messaggio: ricerca.isEmpty
                                ? "Aggiungi la prima cosa da fare. Anche piccola, anzi: meglio piccola 💗"
                                : "Non ho trovato niente con «\(ricerca)».",
                            azione: ricerca.isEmpty
                                ? (titolo: "Aggiungi", esegui: { mostraNuova = true })
                                : nil
                        )
                    }
                }
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("To Do")
        .searchable(text: $ricerca, prompt: "Cerca fra le tue cose")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Toggle("Nascondi le completate", isOn: $nascondiCompletate)

                    Divider()

                    Button {
                        categoriaFiltro = nil
                    } label: {
                        Label("Tutte le categorie", systemImage: categoriaFiltro == nil ? "checkmark" : "")
                    }

                    ForEach(TaskCategory.allCases) { categoria in
                        Button {
                            categoriaFiltro = categoria
                        } label: {
                            Label(
                                "\(categoria.emoji)  \(categoria.etichetta)",
                                systemImage: categoriaFiltro == categoria ? "checkmark" : ""
                            )
                        }
                    }
                } label: {
                    Image(systemName: categoriaFiltro == nil && !nascondiCompletate
                          ? "line.3.horizontal.decrease.circle"
                          : "line.3.horizontal.decrease.circle.fill")
                }
                .accessibilityLabel("Filtri")
            }

            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    mostraNuova = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nuova attività")
            }
        }
        .sheet(isPresented: $mostraNuova) {
            ModificaAttivita(giornoPredefinito: oggi)
        }
    }

    // MARK: - Filtri rapidi

    private var filtri: some View {
        ScrollView(.horizontal) {
            HStack(spacing: Spazio.piccolo) {
                ChipFiltro(testo: "Tutte", attivo: categoriaFiltro == nil) {
                    categoriaFiltro = nil
                }
                ForEach(TaskCategory.allCases) { categoria in
                    ChipFiltro(
                        testo: "\(categoria.emoji) \(categoria.etichetta)",
                        attivo: categoriaFiltro == categoria,
                        colore: Palette.categoria(categoria)
                    ) {
                        categoriaFiltro = categoriaFiltro == categoria ? nil : categoria
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Raggruppamento

    private struct Gruppo {
        let titolo: String
        let sottotitolo: String?
        let attivita: [Attivita]
        let inRitardo: Bool
    }

    private var filtrate: [Attivita] {
        attivita.filter { singola in
            if nascondiCompletate && singola.completata { return false }
            if let categoriaFiltro, singola.categoria != categoriaFiltro { return false }
            if !ricerca.isEmpty {
                let termine = ricerca.lowercased()
                let corrisponde = singola.titolo.lowercased().contains(termine)
                    || (singola.note?.lowercased().contains(termine) ?? false)
                if !corrisponde { return false }
            }
            return true
        }
    }

    /// I gruppi: in ritardo, oggi, domani, questa settimana, più avanti, passate.
    private var gruppi: [Gruppo] {
        let tutte = filtrate
        var risultato: [Gruppo] = []

        let inRitardo = tutte.filter { $0.giorno < oggi && !$0.completata }
        if !inRitardo.isEmpty {
            risultato.append(Gruppo(
                titolo: "Rimaste indietro",
                sottotitolo: "Nessun problema: spostale o spuntale",
                attivita: inRitardo,
                inRitardo: true
            ))
        }

        let diOggi = tutte.filter { $0.giorno == oggi }
        if !diOggi.isEmpty {
            risultato.append(Gruppo(titolo: "Oggi", sottotitolo: CalendarioNina.testoLungo(oggi), attivita: diOggi, inRitardo: false))
        }

        let domani = CalendarioNina.giorno(spostatoDi: 1, da: oggi)
        let diDomani = tutte.filter { $0.giorno == domani }
        if !diDomani.isEmpty {
            risultato.append(Gruppo(titolo: "Domani", sottotitolo: nil, attivita: diDomani, inRitardo: false))
        }

        let fraSetteGiorni = CalendarioNina.giorno(spostatoDi: 7, da: oggi)
        let questaSettimana = tutte.filter { $0.giorno > domani && $0.giorno <= fraSetteGiorni }
        if !questaSettimana.isEmpty {
            risultato.append(Gruppo(titolo: "Nei prossimi giorni", sottotitolo: nil, attivita: questaSettimana, inRitardo: false))
        }

        let piuAvanti = tutte.filter { $0.giorno > fraSetteGiorni }
        if !piuAvanti.isEmpty {
            risultato.append(Gruppo(titolo: "Più avanti", sottotitolo: nil, attivita: piuAvanti, inRitardo: false))
        }

        let passate = tutte.filter { $0.giorno < oggi && $0.completata }
        if !passate.isEmpty && !nascondiCompletate {
            risultato.append(Gruppo(titolo: "Già fatte", sottotitolo: nil, attivita: passate.suffix(20).reversed(), inRitardo: false))
        }

        return risultato
    }

    private func intestazione(_ gruppo: Gruppo) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(gruppo.titolo)
                    .font(Tipo.titolo)
                    .foregroundStyle(gruppo.inRitardo ? Palette.attenzione : Palette.testo)
                if let sottotitolo = gruppo.sottotitolo {
                    Text(sottotitolo)
                        .font(Tipo.didascalia)
                        .foregroundStyle(Palette.testoTenue)
                }
            }
            Spacer()
            Text("\(gruppo.attivita.count)")
                .font(Tipo.etichetta)
                .foregroundStyle(Palette.testoTenue)
        }
        .padding(.vertical, Spazio.piccolo)
        .background(Palette.sfondo.opacity(0.96))
    }
}

// MARK: - Chip di filtro

struct ChipFiltro: View {
    let testo: String
    let attivo: Bool
    var colore: Color = Palette.rosa
    let azione: () -> Void

    var body: some View {
        Button(action: azione) {
            Text(testo)
                .font(Tipo.etichetta)
                .foregroundStyle(attivo ? Palette.testoSuRosa : colore)
                .padding(.horizontal, Spazio.medio)
                .padding(.vertical, Spazio.piccolo)
                .background(
                    attivo ? AnyShapeStyle(colore) : AnyShapeStyle(colore.opacity(0.13)),
                    in: Capsule()
                )
        }
        .buttonStyle(PressioneMorbida())
    }
}
