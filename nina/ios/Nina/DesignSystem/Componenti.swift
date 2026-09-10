// FILE: ios/Nina/DesignSystem/Componenti.swift
//
// I mattoni riusabili dell'interfaccia.
//
// Ogni schermata è composta da questi: è il motivo per cui l'app sembra una
// cosa sola invece di quindici schermate scritte in giorni diversi.

import SwiftUI

// MARK: - Card

/// Il contenitore base. Fondo, angoli morbidi, bordo appena accennato, ombra
/// rosata larga.
struct Card<Contenuto: View>: View {
    var riempimento: CGFloat = Spazio.comodo
    var sfondo: Color = Palette.carta
    var sollevata: Bool = false
    @ViewBuilder var contenuto: Contenuto

    var body: some View {
        contenuto
            .padding(riempimento)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(sfondo, in: RoundedRectangle(cornerRadius: Raggio.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Raggio.card, style: .continuous)
                    .strokeBorder(Palette.bordo, lineWidth: 1)
            }
            .shadow(
                color: sollevata ? Ombra.sollevata.colore : Ombra.card.colore,
                radius: sollevata ? Ombra.sollevata.raggio : Ombra.card.raggio,
                y: sollevata ? Ombra.sollevata.y : Ombra.card.y
            )
    }
}

// MARK: - Bottoni

/// Il bottone principale: rosa pieno, a pillola, occupa la larghezza.
struct BottoneRosa: View {
    let titolo: String
    var icona: String?
    var inCorso: Bool = false
    var disabilitato: Bool = false
    let azione: () -> Void

    var body: some View {
        Button(action: azione) {
            HStack(spacing: Spazio.piccolo) {
                if inCorso {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Palette.testoSuRosa)
                } else if let icona {
                    Image(systemName: icona)
                }
                Text(titolo)
                    .font(Tipo.corpoForte)
            }
            .foregroundStyle(Palette.testoSuRosa)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spazio.normale)
            .background(Palette.gradienteRosa, in: Capsule())
            .opacity(disabilitato || inCorso ? 0.6 : 1)
        }
        .disabled(disabilitato || inCorso)
        .buttonStyle(PressioneMorbida())
    }
}

/// Bottone secondario: solo contorno, per le azioni che non sono la principale.
struct BottoneTenue: View {
    let titolo: String
    var icona: String?
    let azione: () -> Void

    var body: some View {
        Button(action: azione) {
            HStack(spacing: Spazio.piccolo) {
                if let icona { Image(systemName: icona) }
                Text(titolo).font(Tipo.corpoForte)
            }
            .foregroundStyle(Palette.rosa)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spazio.normale)
            .background(Palette.rosaTenue, in: Capsule())
        }
        .buttonStyle(PressioneMorbida())
    }
}

/// Riduce leggermente la vista alla pressione: dà la sensazione fisica del tocco.
struct PressioneMorbida: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.ninaVeloce, value: configuration.isPressed)
    }
}

// MARK: - Pillole ed etichette

/// Badge piccolo colorato: categorie, priorità, stati.
struct Pillola: View {
    let testo: String
    var icona: String?
    var colore: Color = Palette.rosa

    var body: some View {
        HStack(spacing: Spazio.minimo) {
            if let icona { Image(systemName: icona).font(.caption2) }
            Text(testo)
        }
        .font(Tipo.etichetta)
        .foregroundStyle(colore)
        .padding(.horizontal, Spazio.piccolo + 2)
        .padding(.vertical, 5)
        .background(colore.opacity(0.14), in: Capsule())
    }
}

/// Intestazione di sezione, con azione facoltativa a destra.
struct IntestazioneSezione<Azione: View>: View {
    let titolo: String
    var sottotitolo: String?
    @ViewBuilder var azione: Azione

    /// Il titolo è sempre il primo argomento e non ha etichetta.
    ///
    /// Questo `init` esiste per togliere di mezzo quello sintetizzato da
    /// Swift, che avrebbe voluto `titolo:`. Averne due significava poterla
    /// scrivere in due modi — con l'etichetta quando c'era un bottone in
    /// coda, senza quando non c'era — e la differenza non è visibile finché
    /// il compilatore non la segnala. È già successo una volta.
    init(_ titolo: String, sottotitolo: String? = nil, @ViewBuilder azione: () -> Azione) {
        self.titolo = titolo
        self.sottotitolo = sottotitolo
        self.azione = azione()
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titolo).font(Tipo.titolo).foregroundStyle(Palette.testo)
                if let sottotitolo {
                    Text(sottotitolo).font(Tipo.didascalia).foregroundStyle(Palette.testoTenue)
                }
            }
            Spacer(minLength: Spazio.piccolo)
            azione
        }
    }
}

extension IntestazioneSezione where Azione == EmptyView {
    /// La stessa cosa, quando non c'è niente da mettere a destra.
    init(_ titolo: String, sottotitolo: String? = nil) {
        self.init(titolo, sottotitolo: sottotitolo) { EmptyView() }
    }
}

// MARK: - Progresso

/// Barra di avanzamento a pillola, con animazione.
struct BarraProgresso: View {
    let valore: Double        // da 0 a 1
    var altezza: CGFloat = 10
    var colore: Color = Palette.rosa

    var body: some View {
        GeometryReader { geometria in
            ZStack(alignment: .leading) {
                Capsule().fill(colore.opacity(0.16))
                Capsule()
                    .fill(Palette.gradienteRosa)
                    .frame(width: max(0, min(1, valore)) * geometria.size.width)
            }
        }
        .frame(height: altezza)
        .animation(.nina, value: valore)
        .accessibilityHidden(true)   // il valore è già annunciato dal testo accanto
    }
}

// MARK: - Stato vuoto

/// Cosa si vede quando non c'è ancora niente.
///
/// Non è un dettaglio: è la prima schermata che l'utente incontra, e nella
/// maggior parte delle app è una scritta grigia deprimente. Qui parla Nina.
struct StatoVuoto: View {
    let icona: String
    let titolo: String
    let messaggio: String
    var azione: (titolo: String, esegui: () -> Void)?

    var body: some View {
        VStack(spacing: Spazio.normale) {
            ZStack {
                Circle()
                    .fill(Palette.rosaTenue)
                    .frame(width: 88, height: 88)
                Image(systemName: icona)
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(Palette.rosa)
            }

            VStack(spacing: Spazio.piccolo) {
                Text(titolo)
                    .font(Tipo.sottotitolo)
                    .foregroundStyle(Palette.testo)
                Text(messaggio)
                    .font(Tipo.didascalia)
                    .foregroundStyle(Palette.testoTenue)
                    .multilineTextAlignment(.center)
                    .lettura()
            }

            if let azione {
                BottoneRosa(titolo: azione.titolo, icona: "plus", azione: azione.esegui)
                    .frame(maxWidth: 260)
                    .padding(.top, Spazio.piccolo)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spazio.ampio)
        .padding(.horizontal, Spazio.comodo)
    }
}

// MARK: - Campi di testo

struct CampoTesto: View {
    let etichetta: String
    var segnaposto: String = ""
    var icona: String?
    var tastiera: UIKeyboardType = .default
    var contenuto: UITextContentType?
    var autocapitalizzazione: TextInputAutocapitalization = .sentences
    @Binding var testo: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spazio.piccolo) {
            Text(etichetta)
                .font(Tipo.etichetta)
                .foregroundStyle(Palette.testoTenue)

            HStack(spacing: Spazio.medio) {
                if let icona {
                    Image(systemName: icona)
                        .foregroundStyle(Palette.testoTenue)
                        .frame(width: 20)
                }
                TextField(segnaposto, text: $testo)
                    .font(Tipo.corpo)
                    .keyboardType(tastiera)
                    .textContentType(contenuto)
                    .textInputAutocapitalization(autocapitalizzazione)
                    .autocorrectionDisabled(tastiera == .emailAddress)
            }
            .padding(Spazio.normale)
            .background(Palette.cartaAlta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                    .strokeBorder(Palette.bordo, lineWidth: 1)
            }
        }
    }
}

struct CampoPassword: View {
    let etichetta: String
    var segnaposto: String = ""
    var nuova: Bool = false
    @Binding var testo: String
    @State private var visibile = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spazio.piccolo) {
            Text(etichetta)
                .font(Tipo.etichetta)
                .foregroundStyle(Palette.testoTenue)

            HStack(spacing: Spazio.medio) {
                Image(systemName: "lock")
                    .foregroundStyle(Palette.testoTenue)
                    .frame(width: 20)

                Group {
                    if visibile {
                        TextField(segnaposto, text: $testo)
                    } else {
                        SecureField(segnaposto, text: $testo)
                    }
                }
                .font(Tipo.corpo)
                .textContentType(nuova ? .newPassword : .password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

                Button {
                    visibile.toggle()
                } label: {
                    Image(systemName: visibile ? "eye.slash" : "eye")
                        .foregroundStyle(Palette.testoTenue)
                }
                .accessibilityLabel(visibile ? "Nascondi la password" : "Mostra la password")
            }
            .padding(Spazio.normale)
            .background(Palette.cartaAlta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                    .strokeBorder(Palette.bordo, lineWidth: 1)
            }
        }
    }
}

// MARK: - Sfondo

/// Lo sfondo di ogni schermata.
struct SfondoNina: View {
    var body: some View {
        Palette.gradienteSfondo.ignoresSafeArea()
    }
}

extension View {
    /// Applica lo sfondo dell'app dietro una schermata.
    func sfondoNina() -> some View {
        self.background(SfondoNina())
    }
}

// MARK: - Messaggi di errore

/// Striscia di errore gentile, nella voce di Nina.
struct AvvisoErrore: View {
    let messaggio: String
    var riprova: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: Spazio.medio) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Palette.errore)

            VStack(alignment: .leading, spacing: Spazio.piccolo) {
                Text(messaggio)
                    .font(Tipo.didascalia)
                    .foregroundStyle(Palette.testo)
                    .fixedSize(horizontal: false, vertical: true)

                if let riprova {
                    Button("Riprova", action: riprova)
                        .font(Tipo.etichetta)
                        .foregroundStyle(Palette.rosa)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(Spazio.normale)
        .background(Palette.errore.opacity(0.10), in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
    }
}
