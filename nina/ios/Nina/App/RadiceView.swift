// FILE: ios/Nina/App/RadiceView.swift
//
// Il bivio: onboarding, accesso, oppure l'app vera.

import SwiftUI

struct RadiceView: View {
    @Environment(Sessione.self) private var sessione

    var body: some View {
        Group {
            switch sessione.stato {
            case .controllo:
                SchermataAvvio()

            case .primoAvvio:
                Onboarding()

            case .fuori:
                Benvenuto()

            case .dentro:
                ContenitorePrincipale()
            }
        }
        .animation(.easeInOut(duration: 0.35), value: sessione.stato)
        .task {
            await sessione.avvia()
        }
    }
}

/// Quello che si vede per la frazione di secondo in cui si controlla la sessione.
/// Non è una schermata vuota: è già Nina.
struct SchermataAvvio: View {
    @State private var pulsa = false

    var body: some View {
        ZStack {
            SfondoNina()

            VStack(spacing: Spazio.comodo) {
                Text("Nina")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundStyle(Palette.rosa)

                Text("💗")
                    .font(.system(size: 28))
                    .scaleEffect(pulsa ? 1.12 : 0.94)
                    .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulsa)
            }
        }
        .onAppear { pulsa = true }
    }
}
