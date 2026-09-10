// FILE: ios/Nina/Features/Me/SchermataSelfCare.swift
//
// "Self Care 💆🏻‍♀️"
//
// La funzione centrale è "Sorprendimi": una carta alla volta, grande, senza
// elenchi. Un elenco di quaranta idee produce paralisi; una sola idea produce
// un gesto. L'elenco completo resta, ma sotto.
//
// Le idee arrivano dal server e vengono tenute in locale, quindi il bottone
// funziona anche in aereo.

import SwiftUI
import SwiftData

struct SchermataSelfCare: View {
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<IdeaSelfCare> { $0.attiva },
           sort: [SortDescriptor<IdeaSelfCare>(\.titolo)])
    private var idee: [IdeaSelfCare]

    @State private var scelta: IdeaSelfCare?
    @State private var categoria: SelfCareCategory?
    @State private var animazione = 0

    private var filtrate: [IdeaSelfCare] {
        guard let categoria else { return idee }
        return idee.filter { $0.categoria == categoria }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.sezione) {
                cartaSorpresa
                filtri
                elenco
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("Self Care")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { if scelta == nil { pescaUnaIdea() } }
    }

    // MARK: - Sorprendimi

    private var cartaSorpresa: some View {
        VStack(spacing: Spazio.normale) {
            if let scelta {
                Card(sollevata: true) {
                    VStack(alignment: .leading, spacing: Spazio.medio) {
                        HStack {
                            Text(scelta.categoria.emoji).font(.system(size: 34))
                            Spacer()
                            if let minuti = scelta.minuti {
                                Pillola(testo: "\(minuti) min", icona: "clock")
                            }
                        }

                        Text(scelta.titolo)
                            .font(Tipo.titolo)
                            .foregroundStyle(Palette.testo)
                            .fixedSize(horizontal: false, vertical: true)

                        if let dettaglio = scelta.dettaglio {
                            Text(dettaglio)
                                .font(Tipo.corpo)
                                .foregroundStyle(Palette.testoTenue)
                                .lettura()
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .id(animazione)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .scale(scale: 0.96)),
                    removal: .opacity
                ))
            } else {
                Card {
                    StatoVuoto(
                        icona: "leaf",
                        titolo: "Ancora nessuna idea",
                        messaggio: "Le idee arrivano dal server: appena c'è connessione le trovi qui, e restano anche offline."
                    )
                }
            }

            BottoneRosa(titolo: "Sorprendimi", icona: "sparkles") {
                pescaUnaIdea()
            }
        }
    }

    private func pescaUnaIdea() {
        let disponibili = filtrate.filter { $0.id != scelta?.id }
        guard let nuova = disponibili.randomElement() ?? filtrate.randomElement() else { return }

        withAnimation(.nina) {
            scelta = nuova
            animazione += 1
        }
    }

    // MARK: - Filtri

    private var filtri: some View {
        ScrollView(.horizontal) {
            HStack(spacing: Spazio.piccolo) {
                ChipFiltro(testo: "Tutto", attivo: categoria == nil) {
                    categoria = nil
                    pescaUnaIdea()
                }
                ForEach(SelfCareCategory.allCases) { valore in
                    ChipFiltro(
                        testo: "\(valore.emoji) \(valore.etichetta)",
                        attivo: categoria == valore
                    ) {
                        categoria = categoria == valore ? nil : valore
                        pescaUnaIdea()
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Elenco completo

    private var elenco: some View {
        VStack(alignment: .leading, spacing: Spazio.medio) {
            IntestazioneSezione(
                "Tutte le idee",
                sottotitolo: filtrate.isEmpty ? nil : "\(filtrate.count) cose che puoi fare per te"
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 165), spacing: Spazio.medio)], spacing: Spazio.medio) {
                ForEach(filtrate) { idea in
                    Button {
                        withAnimation(.nina) {
                            scelta = idea
                            animazione += 1
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: Spazio.piccolo) {
                            Text(idea.categoria.emoji).font(.system(size: 22))

                            Text(idea.titolo)
                                .font(Tipo.corpoForte)
                                .foregroundStyle(Palette.testo)
                                .multilineTextAlignment(.leading)
                                .lineLimit(3)

                            if let minuti = idea.minuti {
                                Text("\(minuti) min")
                                    .font(.caption)
                                    .foregroundStyle(Palette.testoTenue)
                            }

                            Spacer(minLength: 0)
                        }
                        .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
                        .padding(Spazio.normale)
                        .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                                .strokeBorder(scelta?.id == idea.id ? Palette.rosa : Palette.bordo, lineWidth: 1)
                        }
                    }
                    .buttonStyle(PressioneMorbida())
                }
            }
        }
    }
}
