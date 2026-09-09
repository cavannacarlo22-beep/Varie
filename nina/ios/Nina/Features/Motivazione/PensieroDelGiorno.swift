// FILE: ios/Nina/Features/Motivazione/PensieroDelGiorno.swift
//
// "✨ Pensiero di oggi".
//
// Il riferimento non è una app: è una pagina di rivista. Le scelte sono quelle
// che fa un impaginatore:
//
//   · la virgoletta aperta è grande, in alto a sinistra, e *straborda* dal
//     testo. Non è un'icona: è un segno tipografico, disegnato con il glifo
//     “ del serif, che è la cosa che rende una citazione riconoscibile a
//     colpo d'occhio prima ancora di leggerla;
//   · il testo è in serif, con interlinea larga. Il serif dice "questo è
//     scritto", il sans direbbe "questo è un'interfaccia";
//   · l'autore è staccato da un filetto sottile e scritto piccolo, in
//     maiuscoletto spaziato: è la firma, non un sottotitolo;
//   · attorno c'è molto vuoto. Il vuoto è ciò che fa sembrare importante quello
//     che sta in mezzo.

import SwiftUI

// MARK: - Card per la Home

struct CardPensiero: View {
    let frase: Frase
    var onPreferito: () -> Void
    var onAltraFrase: () -> Void
    @State private var apriSchermoIntero = false
    @State private var cuoreScatta = false

    var body: some View {
        Button {
            apriSchermoIntero = true
        } label: {
            contenuto
        }
        .buttonStyle(PressioneMorbida())
        .fullScreenCover(isPresented: $apriSchermoIntero) {
            PensieroSchermoIntero(
                frase: frase,
                onPreferito: onPreferito,
                onAltraFrase: onAltraFrase
            )
        }
    }

    private var contenuto: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Intestazione minuscola: dice cos'è, senza rubare la scena.
            Text("Pensiero di oggi")
                .maiuscoletto()
                .foregroundStyle(Palette.rosa.opacity(0.9))
                .padding(.bottom, Spazio.normale)

            // La citazione, con la virgoletta che le sta accanto e un po' sopra.
            HStack(alignment: .top, spacing: Spazio.piccolo) {
                Text(verbatim: "\u{201C}")
                    .font(.system(size: 86, weight: .regular, design: .serif))
                    .foregroundStyle(Palette.rosa.opacity(0.22))
                    // La virgoletta ha molto spazio vuoto sopra nel suo riquadro:
                    // questi offset la riportano dove l'occhio se l'aspetta.
                    .frame(height: 34, alignment: .top)
                    .offset(x: -4, y: -10)
                    .accessibilityHidden(true)

                Text(frase.testo)
                    .font(Tipo.citazione)
                    .foregroundStyle(Palette.testo)
                    .lineSpacing(8)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Firma
            if let firma = frase.firma {
                HStack(spacing: Spazio.medio) {
                    Rectangle()
                        .fill(Palette.rosa.opacity(0.35))
                        .frame(width: 28, height: 1)
                    Text(firma)
                        .maiuscoletto()
                        .foregroundStyle(Palette.testoTenue)
                }
                .padding(.top, Spazio.comodo)
            }

            // Azioni
            HStack(spacing: Spazio.comodo) {
                Button {
                    cuoreScatta = true
                    onPreferito()
                } label: {
                    Image(systemName: frase.preferita ? "heart.fill" : "heart")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(frase.preferita ? Palette.rosa : Palette.testoTenue)
                        .symbolEffect(.bounce, value: cuoreScatta)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(frase.preferita ? "Togli dai preferiti" : "Aggiungi ai preferiti")

                ShareLink(item: frase.testoDaCondividere) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(Palette.testoTenue)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Condividi questa frase")

                Button(action: onAltraFrase) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(Palette.testoTenue)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Mostrami un'altra frase")

                Spacer()

                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.caption)
                    .foregroundStyle(Palette.testoTenue.opacity(0.5))
                    .accessibilityHidden(true)
            }
            .padding(.top, Spazio.comodo)
        }
        .padding(Spazio.comodo + 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: Raggio.card, style: .continuous)
                .fill(Palette.carta)
                .overlay {
                    // Alone rosato in alto a destra: rompe la piattezza del
                    // bianco senza che si noti come "un gradiente".
                    RadialGradient(
                        colors: [Palette.rosaTenue.opacity(0.85), .clear],
                        center: .topTrailing,
                        startRadius: 8,
                        endRadius: 260
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Raggio.card, style: .continuous))
                }
        }
        .overlay {
            RoundedRectangle(cornerRadius: Raggio.card, style: .continuous)
                .strokeBorder(Palette.bordo, lineWidth: 1)
        }
        .shadow(color: Ombra.card.colore, radius: Ombra.card.raggio, y: Ombra.card.y)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Tocca per aprire a schermo intero")
    }
}

// MARK: - Schermo intero

/// La frase da sola, senza interfaccia intorno. Serve a fermarsi un attimo.
struct PensieroSchermoIntero: View {
    let frase: Frase
    var onPreferito: () -> Void
    var onAltraFrase: () -> Void

    @Environment(\.dismiss) private var chiudi
    @State private var comparsa = false
    @State private var preferita: Bool = false

    var body: some View {
        ZStack {
            Palette.sfondo.ignoresSafeArea()

            // Virgoletta enorme, quasi trasparente: fa da texture alla pagina.
            Text(verbatim: "\u{201C}")
                .font(.system(size: 340, weight: .regular, design: .serif))
                .foregroundStyle(Palette.rosa.opacity(0.07))
                .offset(x: -70, y: -190)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                Spacer()

                Text("Pensiero di oggi")
                    .maiuscoletto()
                    .foregroundStyle(Palette.rosa)
                    .padding(.bottom, Spazio.comodo)
                    .opacity(comparsa ? 1 : 0)
                    .offset(y: comparsa ? 0 : 8)

                Text(frase.testo)
                    .font(Tipo.citazioneGrande)
                    .foregroundStyle(Palette.testo)
                    .lineSpacing(12)
                    .fixedSize(horizontal: false, vertical: true)
                    .opacity(comparsa ? 1 : 0)
                    .offset(y: comparsa ? 0 : 14)

                if let firma = frase.firma {
                    HStack(spacing: Spazio.medio) {
                        Rectangle()
                            .fill(Palette.rosa.opacity(0.4))
                            .frame(width: 36, height: 1)
                        Text(firma)
                            .maiuscoletto()
                            .foregroundStyle(Palette.testoTenue)
                    }
                    .padding(.top, Spazio.sezione)
                    .opacity(comparsa ? 1 : 0)
                }

                Spacer()

                HStack(spacing: Spazio.normale) {
                    BottoneTondo(
                        icona: preferita ? "heart.fill" : "heart",
                        etichetta: preferita ? "Togli dai preferiti" : "Salva fra i preferiti",
                        evidenziato: preferita
                    ) {
                        preferita.toggle()
                        onPreferito()
                    }

                    ShareLink(item: frase.testoDaCondividere) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundStyle(Palette.rosa)
                            .frame(width: 52, height: 52)
                            .background(Palette.rosaTenue, in: Circle())
                    }
                    .accessibilityLabel("Condividi")

                    BottoneTondo(icona: "arrow.triangle.2.circlepath", etichetta: "Un'altra frase") {
                        onAltraFrase()
                    }

                    Spacer()

                    Button {
                        chiudi()
                    } label: {
                        Text("Chiudi")
                            .font(Tipo.corpoForte)
                            .foregroundStyle(Palette.testoSuRosa)
                            .padding(.horizontal, Spazio.comodo)
                            .padding(.vertical, Spazio.medio)
                            .background(Palette.gradienteRosa, in: Capsule())
                    }
                    .buttonStyle(PressioneMorbida())
                }
                .opacity(comparsa ? 1 : 0)
            }
            .padding(.horizontal, Spazio.sezione)
            .padding(.vertical, Spazio.ampio)
            .frame(maxWidth: 620)   // su iPad la riga non deve diventare lunghissima
        }
        .onAppear {
            preferita = frase.preferita
            withAnimation(.easeOut(duration: 0.55)) { comparsa = true }
        }
    }
}

/// Bottone tondo con icona, usato nella barra azioni a schermo intero.
private struct BottoneTondo: View {
    let icona: String
    let etichetta: String
    var evidenziato: Bool = false
    let azione: () -> Void

    var body: some View {
        Button(action: azione) {
            Image(systemName: icona)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(evidenziato ? Palette.testoSuRosa : Palette.rosa)
                .frame(width: 52, height: 52)
                .background(evidenziato ? AnyShapeStyle(Palette.gradienteRosa) : AnyShapeStyle(Palette.rosaTenue), in: Circle())
        }
        .buttonStyle(PressioneMorbida())
        .accessibilityLabel(etichetta)
    }
}

// MARK: - Anteprime

#Preview("Card") {
    ScrollView {
        VStack(spacing: Spazio.comodo) {
            CardPensiero(
                frase: Frase(
                    id: UUID(),
                    testo: "Non devi fare tutto oggi. Devi solo fare qualcosa.",
                    autore: nil,
                    fonte: "Nina",
                    preferita: false
                ),
                onPreferito: {},
                onAltraFrase: {}
            )
            CardPensiero(
                frase: Frase(
                    id: UUID(),
                    testo: "Non è che abbiamo poco tempo: è che ne perdiamo molto.",
                    autore: "Seneca",
                    fonte: "De brevitate vitae",
                    preferita: true
                ),
                onPreferito: {},
                onAltraFrase: {}
            )
        }
        .padding()
    }
    .sfondoNina()
}

#Preview("Schermo intero") {
    PensieroSchermoIntero(
        frase: Frase(
            id: UUID(),
            testo: "Le cose belle richiedono tempo. Anche tu sei una cosa bella.",
            autore: nil,
            fonte: "Nina",
            preferita: false
        ),
        onPreferito: {},
        onAltraFrase: {}
    )
}
