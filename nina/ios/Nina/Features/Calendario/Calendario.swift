// FILE: ios/Nina/Features/Calendario/Calendario.swift
//
// Il calendario: mese, settimana, giorno.
//
// La vista mensile mostra dei puntini, non i titoli: a quella dimensione un
// testo non si legge, e provarci produce solo rumore. I puntini dicono
// "qui c'è qualcosa" e il colore dice di che tipo — è tutto ciò che serve per
// decidere dove toccare.

import SwiftUI
import SwiftData

struct Calendario: View {
    enum Vista: String, CaseIterable, Identifiable {
        case mese, settimana, giorno
        var id: String { rawValue }
        var etichetta: String {
            switch self {
            case .mese: "Mese"
            case .settimana: "Settimana"
            case .giorno: "Giorno"
            }
        }
    }

    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<Attivita> { $0.deletedAt == nil },
           sort: [SortDescriptor<Attivita>(\.ora)])
    private var attivita: [Attivita]

    @State private var vista: Vista = .mese
    @State private var giornoSelezionato = CalendarioNina.oggi
    @State private var mostraNuova = false

    /// Le attività raggruppate per giorno: si calcola una volta e si riusa,
    /// invece di filtrare l'intero elenco per ognuna delle 42 celle del mese.
    private var perGiorno: [String: [Attivita]] {
        Dictionary(grouping: attivita, by: \.giorno)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.comodo) {
                selettoreVista

                switch vista {
                case .mese: vistaMese
                case .settimana: vistaSettimana
                case .giorno: EmptyView()
                }

                elencoDelGiorno
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("Calendario")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { mostraNuova = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Nuova attività")
            }
        }
        .sheet(isPresented: $mostraNuova) {
            ModificaAttivita(giornoPredefinito: giornoSelezionato)
        }
    }

    // MARK: - Selettore

    private var selettoreVista: some View {
        Picker("Vista", selection: $vista.animation(.ninaVeloce)) {
            ForEach(Vista.allCases) { valore in
                Text(valore.etichetta).tag(valore)
            }
        }
        .pickerStyle(.segmented)
        .padding(.top, Spazio.piccolo)
    }

    // MARK: - Mese

    private var vistaMese: some View {
        Card {
            VStack(spacing: Spazio.normale) {
                intestazioneMese

                // Iniziali dei giorni della settimana.
                HStack(spacing: 0) {
                    ForEach(GiornoSettimana.allCases) { giornoSettimana in
                        Text(giornoSettimana.lettera)
                            .font(Tipo.etichetta)
                            .foregroundStyle(Palette.testoTenue)
                            .frame(maxWidth: .infinity)
                    }
                }

                let griglia = CalendarioNina.grigliaMese(contenente: giornoSelezionato)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 6) {
                    ForEach(griglia, id: \.self) { giorno in
                        CellaGiorno(
                            giorno: giorno,
                            attivita: perGiorno[giorno] ?? [],
                            selezionato: giorno == giornoSelezionato,
                            nelMese: CalendarioNina.eStessoMese(giorno, giornoSelezionato)
                        ) {
                            withAnimation(.ninaVeloce) { giornoSelezionato = giorno }
                        }
                    }
                }
            }
        }
    }

    private var intestazioneMese: some View {
        HStack {
            Button {
                withAnimation(.ninaVeloce) {
                    giornoSelezionato = CalendarioNina.giorno(spostatoDi: -28, da: giornoSelezionato)
                }
            } label: {
                Image(systemName: "chevron.left").foregroundStyle(Palette.rosa)
            }
            .accessibilityLabel("Mese precedente")

            Spacer()

            Text(CalendarioNina.testoMese(giornoSelezionato))
                .font(Tipo.sottotitolo)
                .foregroundStyle(Palette.testo)
                .contentTransition(.numericText())

            Spacer()

            Button {
                withAnimation(.ninaVeloce) {
                    giornoSelezionato = CalendarioNina.giorno(spostatoDi: 28, da: giornoSelezionato)
                }
            } label: {
                Image(systemName: "chevron.right").foregroundStyle(Palette.rosa)
            }
            .accessibilityLabel("Mese successivo")
        }
    }

    // MARK: - Settimana

    private var vistaSettimana: some View {
        Card {
            VStack(alignment: .leading, spacing: Spazio.normale) {
                HStack {
                    Text(CalendarioNina.testoMese(giornoSelezionato))
                        .font(Tipo.sottotitolo)
                        .foregroundStyle(Palette.testo)
                    Spacer()
                    Button("Oggi") {
                        withAnimation(.ninaVeloce) { giornoSelezionato = CalendarioNina.oggi }
                    }
                    .font(Tipo.etichetta)
                    .foregroundStyle(Palette.rosa)
                }

                HStack(spacing: Spazio.piccolo) {
                    ForEach(CalendarioNina.settimana(contenente: giornoSelezionato), id: \.self) { giorno in
                        ColonnaGiorno(
                            giorno: giorno,
                            attivita: perGiorno[giorno] ?? [],
                            selezionato: giorno == giornoSelezionato
                        ) {
                            withAnimation(.ninaVeloce) { giornoSelezionato = giorno }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Elenco del giorno scelto

    private var elencoDelGiorno: some View {
        let delGiorno = (perGiorno[giornoSelezionato] ?? []).sorted { primo, secondo in
            (primo.ora ?? "99:99") < (secondo.ora ?? "99:99")
        }

        return VStack(alignment: .leading, spacing: Spazio.normale) {
            IntestazioneSezione(
                CalendarioNina.testoRelativo(giornoSelezionato),
                sottotitolo: delGiorno.isEmpty ? nil : "\(delGiorno.count) cose"
            ) {
                Button {
                    mostraNuova = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(Palette.rosa)
                }
                .accessibilityLabel("Aggiungi in questo giorno")
            }

            if delGiorno.isEmpty {
                Card {
                    StatoVuoto(
                        icona: "calendar.badge.plus",
                        titolo: "Niente in programma",
                        messaggio: CalendarioNina.eOggi(giornoSelezionato)
                            ? VoceDiNina.nienteAttivitaOggi()
                            : "Questo giorno è libero.",
                        azione: (titolo: "Aggiungi", esegui: { mostraNuova = true })
                    )
                }
            } else {
                VStack(spacing: Spazio.piccolo) {
                    ForEach(delGiorno) { singola in
                        RigaAttivita(attivita: singola)
                    }
                }
            }
        }
    }
}

// MARK: - Cella del mese

private struct CellaGiorno: View {
    let giorno: String
    let attivita: [Attivita]
    let selezionato: Bool
    let nelMese: Bool
    let azione: () -> Void

    private var eOggi: Bool { CalendarioNina.eOggi(giorno) }
    private var daFare: Int { attivita.filter { !$0.completata }.count }

    var body: some View {
        Button(action: azione) {
            VStack(spacing: 4) {
                Text(CalendarioNina.numeroDelGiorno(giorno))
                    .font(.system(.subheadline, design: .rounded, weight: eOggi ? .bold : .regular))
                    .foregroundStyle(colorePrincipale)
                    .frame(width: 32, height: 32)
                    .background {
                        if selezionato {
                            Circle().fill(Palette.gradienteRosa)
                        } else if eOggi {
                            Circle().strokeBorder(Palette.rosa, lineWidth: 1.5)
                        }
                    }

                // Fino a tre puntini: oltre, il conteggio non aggiunge niente
                // e la cella diventa illeggibile.
                HStack(spacing: 2) {
                    ForEach(Array(attivita.prefix(3).enumerated()), id: \.offset) { _, singola in
                        Circle()
                            .fill(singola.completata
                                  ? Palette.testoTenue.opacity(0.35)
                                  : Palette.categoria(singola.categoria))
                            .frame(width: 5, height: 5)
                    }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: .infinity)
            .opacity(nelMese ? 1 : 0.3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(etichettaAccessibile)
    }

    private var colorePrincipale: Color {
        if selezionato { return Palette.testoSuRosa }
        if eOggi { return Palette.rosa }
        return Palette.testo
    }

    private var etichettaAccessibile: String {
        let base = CalendarioNina.testoLungo(giorno)
        if attivita.isEmpty { return base }
        return "\(base), \(attivita.count) attività, \(daFare) da fare"
    }
}

// MARK: - Colonna della settimana

private struct ColonnaGiorno: View {
    let giorno: String
    let attivita: [Attivita]
    let selezionato: Bool
    let azione: () -> Void

    private var eOggi: Bool { CalendarioNina.eOggi(giorno) }
    private var completate: Int { attivita.filter(\.completata).count }

    var body: some View {
        Button(action: azione) {
            VStack(spacing: Spazio.piccolo) {
                Text(GiornoSettimana(rawValue: CalendarioNina.giornoSettimana(di: giorno))?.lettera ?? "")
                    .font(.caption2)
                    .foregroundStyle(selezionato ? Palette.testoSuRosa.opacity(0.85) : Palette.testoTenue)

                Text(CalendarioNina.numeroDelGiorno(giorno))
                    .font(.system(.body, design: .rounded, weight: .semibold))
                    .foregroundStyle(selezionato ? Palette.testoSuRosa : (eOggi ? Palette.rosa : Palette.testo))

                if attivita.isEmpty {
                    Circle().fill(.clear).frame(width: 6, height: 6)
                } else {
                    Text("\(completate)/\(attivita.count)")
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                        .foregroundStyle(selezionato ? Palette.testoSuRosa.opacity(0.9) : Palette.testoTenue)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spazio.medio)
            .background {
                if selezionato {
                    RoundedRectangle(cornerRadius: Raggio.piccolo, style: .continuous)
                        .fill(Palette.gradienteRosa)
                } else if eOggi {
                    RoundedRectangle(cornerRadius: Raggio.piccolo, style: .continuous)
                        .fill(Palette.rosaTenue)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(CalendarioNina.testoLungo(giorno)), \(attivita.count) attività")
    }
}
