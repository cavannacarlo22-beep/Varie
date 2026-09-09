// FILE: ios/Nina/Features/Onboarding/Onboarding.swift
//
// Le prime schermate.
//
// Quattro frasi, una per pagina, scritte grandi. Nessuna illustrazione, nessun
// elenco di funzionalità: chi apre l'app per la prima volta non vuole sapere
// che c'è anche la wishlist, vuole capire *chi* le sta parlando.
//
// L'ultima frase è quella che dice davvero cos'è Nina — "e ogni tanto ti
// ricorderò anche di respirare 😂" — perché è l'unica che una app di produttività
// normale non direbbe mai.

import SwiftUI

struct Onboarding: View {
    @Environment(Sessione.self) private var sessione
    @State private var pagina = 0

    private struct Passo {
        let titolo: String
        let sottotitolo: String?
        let emoji: String
    }

    private let passi: [Passo] = [
        Passo(titolo: "Hey 💗", sottotitolo: "Piacere di conoscerti.", emoji: "👋"),
        Passo(titolo: "Organizziamo insieme le tue giornate.", sottotitolo: nil, emoji: "📝"),
        Passo(titolo: "Ti ricorderò le cose importanti.", sottotitolo: nil, emoji: "🔔"),
        Passo(titolo: "E ogni tanto ti ricorderò anche di respirare 😂", sottotitolo: nil, emoji: "🌸"),
    ]

    var body: some View {
        ZStack {
            SfondoNina()

            VStack(spacing: 0) {
                TabView(selection: $pagina) {
                    ForEach(Array(passi.enumerated()), id: \.offset) { indice, passo in
                        VStack(spacing: Spazio.comodo) {
                            Spacer()

                            Text(passo.emoji)
                                .font(.system(size: 64))

                            Text(passo.titolo)
                                .font(.system(size: 32, weight: .bold, design: .rounded))
                                .foregroundStyle(Palette.testo)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)

                            if let sottotitolo = passo.sottotitolo {
                                Text(sottotitolo)
                                    .font(Tipo.corpo)
                                    .foregroundStyle(Palette.testoTenue)
                                    .multilineTextAlignment(.center)
                            }

                            Spacer()
                            Spacer()
                        }
                        .padding(.horizontal, Spazio.sezione)
                        .tag(indice)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.nina, value: pagina)

                indicatore

                VStack(spacing: Spazio.medio) {
                    BottoneRosa(titolo: pagina == passi.count - 1 ? "Iniziamo" : "Avanti") {
                        if pagina < passi.count - 1 {
                            withAnimation(.nina) { pagina += 1 }
                        } else {
                            sessione.onboardingCompletato()
                        }
                    }

                    Button("Salta") { sessione.onboardingCompletato() }
                        .font(Tipo.didascalia)
                        .foregroundStyle(Palette.testoTenue)
                        .opacity(pagina == passi.count - 1 ? 0 : 1)
                }
                .padding(.horizontal, Spazio.sezione)
                .padding(.bottom, Spazio.ampio)
            }
        }
    }

    private var indicatore: some View {
        HStack(spacing: Spazio.piccolo) {
            ForEach(0..<passi.count, id: \.self) { indice in
                Capsule()
                    .fill(indice == pagina ? Palette.rosa : Palette.rosa.opacity(0.25))
                    .frame(width: indice == pagina ? 22 : 7, height: 7)
                    .animation(.nina, value: pagina)
            }
        }
        .padding(.bottom, Spazio.sezione)
        .accessibilityHidden(true)
    }
}
