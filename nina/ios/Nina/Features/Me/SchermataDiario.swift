// FILE: ios/Nina/Features/Me/SchermataDiario.swift
//
// "Il mio diario 📖"
//
// Due scelte di forma che dicono all'utente cosa può aspettarsi:
//
//   · il testo è in serif, con interlinea larga. Sembra un quaderno, non un
//     campo di un modulo;
//   · in cima c'è scritto, una volta sola e senza enfasi, che nessuno lo legge.
//     Non è una frase di marketing: è vera anche dal lato del server, dove non
//     esiste nessun endpoint amministrativo che restituisca questo testo.

import SwiftUI
import SwiftData

struct SchermataDiario: View {
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<PaginaDiario> { $0.deletedAt == nil },
           sort: [SortDescriptor<PaginaDiario>(\.giorno, order: .reverse),
                  SortDescriptor<PaginaDiario>(\.createdAt, order: .reverse)])
    private var pagine: [PaginaDiario]

    @State private var ricerca = ""
    @State private var mostraNuova = false
    @State private var daAprire: PaginaDiario?

    private var filtrate: [PaginaDiario] {
        guard !ricerca.isEmpty else { return pagine }
        let termine = ricerca.lowercased()
        return pagine.filter {
            $0.contenuto.lowercased().contains(termine) ||
            ($0.titolo?.lowercased().contains(termine) ?? false)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spazio.medio) {
                if pagine.isEmpty {
                    nota
                    Card {
                        StatoVuoto(
                            icona: "book.closed",
                            titolo: "Il diario è vuoto",
                            messaggio: VoceDiNina.nienteDiario(),
                            azione: (titolo: "Scrivi la prima pagina", esegui: { mostraNuova = true })
                        )
                    }
                } else {
                    nota
                    ForEach(filtrate) { pagina in
                        Button {
                            daAprire = pagina
                        } label: {
                            CardPagina(pagina: pagina)
                        }
                        .buttonStyle(PressioneMorbida())
                    }

                    if filtrate.isEmpty {
                        Card {
                            StatoVuoto(
                                icona: "magnifyingglass",
                                titolo: "Nessun risultato",
                                messaggio: "Non ho trovato niente con «\(ricerca)»."
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("Diario")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $ricerca, prompt: "Cerca nel diario")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { mostraNuova = true } label: { Image(systemName: "square.and.pencil") }
                    .accessibilityLabel("Scrivi una pagina")
            }
        }
        .sheet(isPresented: $mostraNuova) { ScritturaDiario() }
        .sheet(item: $daAprire) { pagina in ScritturaDiario(pagina: pagina) }
    }

    private var nota: some View {
        HStack(spacing: Spazio.piccolo) {
            Image(systemName: "lock.fill")
                .font(.caption2)
                .foregroundStyle(Palette.testoTenue)
            Text("Solo tuo. Non lo legge nessuno, nemmeno io.")
                .font(.caption)
                .foregroundStyle(Palette.testoTenue)
        }
        .padding(.bottom, Spazio.piccolo)
    }
}

// MARK: - Anteprima di una pagina

private struct CardPagina: View {
    let pagina: PaginaDiario

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spazio.piccolo) {
                HStack {
                    Text(CalendarioNina.testoRelativo(pagina.giorno))
                        .maiuscoletto()
                        .foregroundStyle(Palette.rosa)

                    Spacer()

                    if let umore = pagina.umore {
                        Text(umore.emoji).font(.footnote)
                    }
                }

                if let titolo = pagina.titolo, !titolo.isEmpty {
                    Text(titolo)
                        .font(Tipo.titoloDiario)
                        .foregroundStyle(Palette.testo)
                }

                Text(pagina.anteprima)
                    .font(Tipo.corpoDiario)
                    .foregroundStyle(Palette.testoTenue)
                    .lineLimit(3)
                    .lineSpacing(4)
                    .multilineTextAlignment(.leading)
            }
        }
    }
}

// MARK: - Scrittura

struct ScritturaDiario: View {
    var pagina: PaginaDiario?

    @Environment(Deposito.self) private var deposito
    @Environment(\.dismiss) private var chiudi

    @State private var titolo = ""
    @State private var contenuto = ""
    @State private var umore: MoodKind?
    @State private var giorno = CalendarioNina.oggi
    @State private var mostraConfermaEliminazione = false

    @FocusState private var scriveNelCorpo: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spazio.comodo) {
                    Text(CalendarioNina.testoLungo(giorno))
                        .maiuscoletto()
                        .foregroundStyle(Palette.rosa)

                    TextField("Titolo (facoltativo)", text: $titolo)
                        .font(Tipo.titoloDiario)
                        .foregroundStyle(Palette.testo)

                    Divider().overlay(Palette.bordo)

                    TextField("Scrivi quello che ti va…", text: $contenuto, axis: .vertical)
                        .font(Tipo.corpoDiario)
                        .foregroundStyle(Palette.testo)
                        .lineSpacing(6)
                        .lineLimit(10...)
                        .focused($scriveNelCorpo)

                    VStack(alignment: .leading, spacing: Spazio.piccolo) {
                        Text("Come stavi")
                            .font(Tipo.etichetta)
                            .foregroundStyle(Palette.testoTenue)

                        ScrollView(.horizontal) {
                            HStack(spacing: Spazio.piccolo) {
                                ForEach(MoodKind.allCases) { valore in
                                    Button {
                                        umore = umore == valore ? nil : valore
                                    } label: {
                                        HStack(spacing: 4) {
                                            Text(valore.emoji)
                                            Text(valore.etichetta).font(Tipo.etichetta)
                                        }
                                        .padding(.horizontal, Spazio.medio)
                                        .padding(.vertical, Spazio.piccolo)
                                        .background(
                                            umore == valore
                                                ? AnyShapeStyle(Palette.mood(valore).opacity(0.25))
                                                : AnyShapeStyle(Palette.cartaAlta),
                                            in: Capsule()
                                        )
                                        .foregroundStyle(umore == valore ? Palette.mood(valore) : Palette.testoTenue)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                    }
                }
                .padding(Spazio.comodo)
            }
            .sfondoNina()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Chiudi") { salvaSePossibile() } }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") { salvaSePossibile() }
                        .fontWeight(.semibold)
                        .disabled(contenuto.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                if pagina != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(role: .destructive) {
                            mostraConfermaEliminazione = true
                        } label: {
                            Image(systemName: "trash")
                        }
                        .accessibilityLabel("Elimina questa pagina")
                    }
                }
            }
            .confirmationDialog(
                "Eliminare questa pagina?",
                isPresented: $mostraConfermaEliminazione,
                titleVisibility: .visible
            ) {
                Button("Elimina", role: .destructive) {
                    if let pagina { deposito.elimina(pagina) }
                    chiudi()
                }
                Button("Annulla", role: .cancel) {}
            } message: {
                Text("Non si può recuperare.")
            }
            .onAppear {
                if let pagina {
                    titolo = pagina.titolo ?? ""
                    contenuto = pagina.contenuto
                    umore = pagina.umore
                    giorno = pagina.giorno
                } else {
                    scriveNelCorpo = true
                }
            }
        }
    }

    private func salvaSePossibile() {
        let testo = contenuto.trimmingCharacters(in: .whitespacesAndNewlines)
        let intestazione = titolo.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !testo.isEmpty else {
            chiudi()
            return
        }

        if let pagina {
            deposito.modificaPagina(pagina) { modifica in
                modifica.titolo = intestazione.isEmpty ? nil : intestazione
                modifica.contenuto = testo
                modifica.umore = umore
            }
        } else {
            deposito.creaPagina(
                titolo: intestazione.isEmpty ? nil : intestazione,
                contenuto: testo,
                umore: umore,
                giorno: giorno
            )
        }

        chiudi()
    }
}
