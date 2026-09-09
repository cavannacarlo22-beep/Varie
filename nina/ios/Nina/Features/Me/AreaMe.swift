// FILE: ios/Nina/Features/Me/AreaMe.swift
//
// La scheda "Me": tutto quello che riguarda lei e non la lista delle cose.
//
// È un indice, non una schermata piena: mostra abbastanza di ogni sezione da
// far venire voglia di aprirla (il mood di oggi, lo streak più lungo, quante
// pagine di diario) senza diventare una seconda Home.

import SwiftUI
import SwiftData

struct AreaMe: View {
    @Environment(Sessione.self) private var sessione
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<Abitudine> { $0.deletedAt == nil }) private var abitudini: [Abitudine]
    @Query(filter: #Predicate<PaginaDiario> { $0.deletedAt == nil }) private var diario: [PaginaDiario]
    @Query(filter: #Predicate<Desiderio> { $0.deletedAt == nil }) private var desideri: [Desiderio]
    @Query(filter: #Predicate<NotaVeloce> { $0.deletedAt == nil }) private var note: [NotaVeloce]

    private let oggi = CalendarioNina.oggi

    var body: some View {
        ScrollView {
            VStack(spacing: Spazio.comodo) {
                profilo

                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 150), spacing: Spazio.medio)],
                    spacing: Spazio.medio
                ) {
                    RiquadroSezione(
                        titolo: "Mood",
                        icona: "face.smiling",
                        valore: deposito.umore(del: oggi)?.umore.emoji ?? "—",
                        sottotitolo: deposito.umore(del: oggi)?.umore.etichetta ?? "Non ancora"
                    ) { SchermataMood() }

                    RiquadroSezione(
                        titolo: "Abitudini",
                        icona: "flame.fill",
                        valore: "\(abitudini.count)",
                        sottotitolo: abitudini.isEmpty ? "Nessuna" : "attive"
                    ) { SchermataAbitudini() }

                    RiquadroSezione(
                        titolo: "Diario",
                        icona: "book.closed.fill",
                        valore: "\(diario.count)",
                        sottotitolo: diario.count == 1 ? "pagina" : "pagine"
                    ) { SchermataDiario() }

                    RiquadroSezione(
                        titolo: "Wishlist",
                        icona: "sparkles",
                        valore: "\(desideri.filter { !$0.acquistato }.count)",
                        sottotitolo: "desideri"
                    ) { SchermataWishlist() }

                    RiquadroSezione(
                        titolo: "Self Care",
                        icona: "leaf.fill",
                        valore: "✨",
                        sottotitolo: "Sorprendimi"
                    ) { SchermataSelfCare() }

                    RiquadroSezione(
                        titolo: "Progressi",
                        icona: "chart.bar.fill",
                        valore: "📊",
                        sottotitolo: "Come sta andando"
                    ) { SchermataProgressi() }
                }

                collegamentoAmica

                if !note.isEmpty {
                    sezioneNote
                }
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("Me")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    SchermataImpostazioni()
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Impostazioni")
            }
        }
    }

    // MARK: - Profilo

    private var profilo: some View {
        Card {
            HStack(spacing: Spazio.normale) {
                ZStack {
                    Circle().fill(Palette.gradienteRosa).frame(width: 60, height: 60)
                    Text(iniziali)
                        .font(.system(.title3, design: .rounded, weight: .bold))
                        .foregroundStyle(Palette.testoSuRosa)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(sessione.nome)
                        .font(Tipo.titolo)
                        .foregroundStyle(Palette.testo)

                    if let utente = sessione.utente {
                        Text(utente.email)
                            .font(Tipo.didascalia)
                            .foregroundStyle(Palette.testoTenue)
                            .lineLimit(1)
                    }

                    if sessione.eAmministratrice {
                        Pillola(testo: "Amministratrice", icona: "key.fill")
                            .padding(.top, 2)
                    }
                }

                Spacer(minLength: 0)
            }
        }
    }

    private var iniziali: String {
        let nome = sessione.nome.trimmingCharacters(in: .whitespaces)
        guard let prima = nome.first else { return "N" }
        return String(prima).uppercased()
    }

    // MARK: - La mia amica

    private var collegamentoAmica: some View {
        NavigationLink {
            SchermataAmica()
        } label: {
            Card(sfondo: Palette.rosaTenue) {
                HStack(spacing: Spazio.normale) {
                    Text("💗").font(.system(size: 32))

                    VStack(alignment: .leading, spacing: 2) {
                        Text("La mia amica")
                            .font(Tipo.sottotitolo)
                            .foregroundStyle(Palette.testo)
                        Text("Scrivimi come sta andando")
                            .font(Tipo.didascalia)
                            .foregroundStyle(Palette.testoTenue)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Palette.rosa)
                }
            }
        }
        .buttonStyle(PressioneMorbida())
    }

    // MARK: - Note veloci

    private var sezioneNote: some View {
        VStack(alignment: .leading, spacing: Spazio.medio) {
            IntestazioneSezione("Devo ricordarmi…")

            VStack(spacing: Spazio.piccolo) {
                ForEach(note.sorted { $0.createdAt > $1.createdAt }.prefix(5)) { nota in
                    RigaNota(nota: nota)
                }
            }
        }
    }
}

// MARK: - Riquadro di sezione

private struct RiquadroSezione<Destinazione: View>: View {
    let titolo: String
    let icona: String
    let valore: String
    let sottotitolo: String
    @ViewBuilder var destinazione: Destinazione

    var body: some View {
        NavigationLink {
            destinazione
        } label: {
            Card(riempimento: Spazio.normale) {
                VStack(alignment: .leading, spacing: Spazio.piccolo) {
                    HStack {
                        Image(systemName: icona)
                            .font(.footnote)
                            .foregroundStyle(Palette.rosa)
                        Text(titolo)
                            .font(Tipo.etichetta)
                            .foregroundStyle(Palette.testoTenue)
                        Spacer()
                    }

                    Text(valore)
                        .font(.system(.title, design: .rounded, weight: .bold))
                        .foregroundStyle(Palette.testo)

                    Text(sottotitolo)
                        .font(.caption)
                        .foregroundStyle(Palette.testoTenue)
                        .lineLimit(1)
                }
            }
        }
        .buttonStyle(PressioneMorbida())
    }
}

// MARK: - Riga di una nota veloce

struct RigaNota: View {
    let nota: NotaVeloce
    @Environment(Deposito.self) private var deposito

    var body: some View {
        HStack(alignment: .top, spacing: Spazio.medio) {
            Image(systemName: nota.attivitaCollegata == nil ? "circle.dotted" : "checkmark.circle.fill")
                .foregroundStyle(nota.attivitaCollegata == nil ? Palette.testoTenue : Palette.successo)
                .padding(.top, 2)

            Text(nota.contenuto)
                .font(Tipo.corpo)
                .foregroundStyle(Palette.testo)
                .frame(maxWidth: .infinity, alignment: .leading)

            if nota.attivitaCollegata == nil {
                Button {
                    deposito.trasformaInAttivita(nota)
                } label: {
                    Image(systemName: "arrow.right.circle")
                        .foregroundStyle(Palette.rosa)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Trasforma in cosa da fare")
            }
        }
        .padding(Spazio.normale)
        .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                .strokeBorder(Palette.bordo, lineWidth: 1)
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                deposito.elimina(nota)
            } label: {
                Label("Elimina", systemImage: "trash")
            }
        }
    }
}
