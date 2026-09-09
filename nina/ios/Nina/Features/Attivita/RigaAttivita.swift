// FILE: ios/Nina/Features/Attivita/RigaAttivita.swift
//
// La riga di un'attività: l'elemento più usato di tutta l'app.
//
// Dettagli che sembrano piccoli e non lo sono:
//
//   · la spunta è un bersaglio da 44 punti, la misura minima che Apple indica
//     per un tocco affidabile. Sotto quella soglia si sbaglia, e sbagliare a
//     spuntare una cosa fatta è irritante;
//   · quando si spunta, il testo si barra e sbiadisce ma la riga NON sparisce
//     e non si sposta: vedere la cosa fatta è metà della soddisfazione;
//   · il feedback aptico c'è solo sul completamento, non su ogni tocco. Un
//     telefono che vibra in continuazione stanca.

import SwiftUI

struct RigaAttivita: View {
    let attivita: Attivita
    var mostraGiorno: Bool = false

    @Environment(Deposito.self) private var deposito
    @State private var mostraModifica = false
    @State private var appenaCompletata = false

    var body: some View {
        HStack(alignment: .top, spacing: Spazio.medio) {
            spunta

            Button {
                mostraModifica = true
            } label: {
                contenuto
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, Spazio.medio)
        .padding(.horizontal, Spazio.normale)
        .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                .strokeBorder(bordo, lineWidth: 1)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                deposito.elimina(attivita)
            } label: {
                Label("Elimina", systemImage: "trash")
            }

            Button {
                deposito.modificaAttivita(attivita) {
                    $0.giorno = CalendarioNina.giorno(spostatoDi: 1, da: $0.giorno)
                }
            } label: {
                Label("Domani", systemImage: "arrow.turn.up.right")
            }
            .tint(Palette.rosaChiaro)
        }
        .sheet(isPresented: $mostraModifica) {
            ModificaAttivita(attivita: attivita)
        }
        .sensoryFeedback(.success, trigger: appenaCompletata) { _, nuovo in nuovo }
        .animation(.nina, value: attivita.completata)
    }

    // MARK: - Spunta

    private var spunta: some View {
        Button {
            let ora = !attivita.completata
            deposito.completa(attivita, ora)
            appenaCompletata = ora
        } label: {
            ZStack {
                Circle()
                    .strokeBorder(
                        attivita.completata ? Palette.rosa : Palette.testoTenue.opacity(0.45),
                        lineWidth: 2
                    )
                    .frame(width: 24, height: 24)

                if attivita.completata {
                    Circle().fill(Palette.gradienteRosa).frame(width: 24, height: 24)
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Palette.testoSuRosa)
                }
            }
            // Il bersaglio è più grande del cerchio disegnato.
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(attivita.completata ? "Segna come da fare" : "Segna come fatta")
        .accessibilityAddTraits(attivita.completata ? [.isSelected, .isButton] : .isButton)
    }

    // MARK: - Testo

    private var contenuto: some View {
        VStack(alignment: .leading, spacing: Spazio.piccolo) {
            HStack(alignment: .firstTextBaseline, spacing: Spazio.piccolo) {
                if let ora = attivita.ora {
                    Text(ora)
                        .font(Tipo.corpoForte.monospacedDigit())
                        .foregroundStyle(attivita.completata ? Palette.testoTenue : Palette.rosa)
                }

                Text(attivita.titolo)
                    .font(Tipo.corpo)
                    .foregroundStyle(attivita.completata ? Palette.testoTenue : Palette.testo)
                    .strikethrough(attivita.completata, color: Palette.testoTenue)
                    .multilineTextAlignment(.leading)
            }

            if attivita.scaduta {
                Text(VoceDiNina.attivitaScaduta())
                    .font(.caption)
                    .foregroundStyle(Palette.attenzione)
            }

            HStack(spacing: Spazio.piccolo) {
                if mostraGiorno {
                    Pillola(
                        testo: CalendarioNina.testoRelativo(attivita.giorno),
                        icona: "calendar",
                        colore: Palette.testoTenue
                    )
                }

                Pillola(
                    testo: attivita.categoria.etichetta,
                    icona: attivita.categoria.simbolo,
                    colore: Palette.categoria(attivita.categoria)
                )

                if attivita.priorita == .high {
                    Pillola(testo: "Importante", icona: "exclamationmark", colore: Palette.priorita(.high))
                }

                if attivita.ripetizione != .never {
                    Image(systemName: "repeat")
                        .font(.caption2)
                        .foregroundStyle(Palette.testoTenue)
                }

                if attivita.notificaAttiva {
                    Image(systemName: "bell.fill")
                        .font(.caption2)
                        .foregroundStyle(Palette.testoTenue)
                }
            }
            .opacity(attivita.completata ? 0.5 : 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var bordo: Color {
        if attivita.scaduta { return Palette.attenzione.opacity(0.35) }
        return Palette.bordo
    }
}
