// FILE: ios/Nina/Features/Me/SchermataMood.swift
//
// "Come stai oggi? 💗"
//
// La schermata deve costare un tocco. Sei bolle grandi, nessun campo
// obbligatorio, la nota è facoltativa e compare solo dopo aver scelto.
// Se registrare come si sta richiede più di tre secondi, non lo si fa —
// e senza dati quotidiani il grafico non dice niente.

import SwiftUI
import SwiftData

struct SchermataMood: View {
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<Umore> { $0.deletedAt == nil },
           sort: [SortDescriptor(\Umore.giorno, order: .reverse)])
    private var umori: [Umore]

    @State private var scelto: MoodKind?
    @State private var nota = ""
    @State private var rispostaDiNina: String?
    @State private var periodo: Periodo = .mese

    private let oggi = CalendarioNina.oggi

    enum Periodo: String, CaseIterable, Identifiable {
        case settimana, mese, anno
        var id: String { rawValue }
        var giorni: Int {
            switch self {
            case .settimana: 7
            case .mese: 30
            case .anno: 365
            }
        }
        var etichetta: String {
            switch self {
            case .settimana: "Settimana"
            case .mese: "Mese"
            case .anno: "Anno"
            }
        }
    }

    private var umoreDiOggi: Umore? {
        umori.first { $0.giorno == oggi }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.sezione) {
                selettore

                if let rispostaDiNina {
                    Card(sfondo: Palette.rosaTenue) {
                        HStack(alignment: .top, spacing: Spazio.medio) {
                            Text("💗")
                            Text(rispostaDiNina)
                                .font(Tipo.corpo)
                                .foregroundStyle(Palette.testo)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }

                if scelto != nil || umoreDiOggi != nil {
                    campoNota
                }

                andamento
                storico
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("Come stai")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            scelto = umoreDiOggi?.umore
            nota = umoreDiOggi?.nota ?? ""
        }
    }

    // MARK: - Scelta

    private var selettore: some View {
        VStack(alignment: .leading, spacing: Spazio.normale) {
            Text(umoreDiOggi == nil ? "Come stai oggi? 💗" : "Oggi ti sei sentita così")
                .font(Tipo.titolo)
                .foregroundStyle(Palette.testo)

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: Spazio.medio), count: 3),
                spacing: Spazio.medio
            ) {
                ForEach(MoodKind.allCases) { umore in
                    BollaMood(umore: umore, scelto: scelto == umore) {
                        seleziona(umore)
                    }
                }
            }
        }
    }

    private func seleziona(_ umore: MoodKind) {
        withAnimation(.nina) {
            scelto = umore
            rispostaDiNina = umore.difficile ? VoceDiNina.moodDifficile() : VoceDiNina.moodPositivo()
        }
        deposito.registra(umore: umore, nota: nota.isEmpty ? nil : nota)
    }

    private var campoNota: some View {
        VStack(alignment: .leading, spacing: Spazio.piccolo) {
            Text("Vuoi aggiungere qualcosa?")
                .font(Tipo.etichetta)
                .foregroundStyle(Palette.testoTenue)

            TextField("Facoltativo", text: $nota, axis: .vertical)
                .font(Tipo.corpo)
                .lineLimit(2...5)
                .padding(Spazio.normale)
                .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                        .strokeBorder(Palette.bordo, lineWidth: 1)
                }
                .onChange(of: nota) { _, nuovo in
                    guard let scelto else { return }
                    deposito.registra(umore: scelto, nota: nuovo.isEmpty ? nil : nuovo)
                }
        }
    }

    // MARK: - Andamento

    private var andamento: some View {
        let da = CalendarioNina.giorno(spostatoDi: -(periodo.giorni - 1), da: oggi)
        let nelPeriodo = umori.filter { $0.giorno >= da }

        return VStack(alignment: .leading, spacing: Spazio.normale) {
            IntestazioneSezione(titolo: "Come è andata") {
                Picker("Periodo", selection: $periodo) {
                    ForEach(Periodo.allCases) { valore in
                        Text(valore.etichetta).tag(valore)
                    }
                }
                .pickerStyle(.menu)
                .tint(Palette.rosa)
            }

            if nelPeriodo.isEmpty {
                Card {
                    StatoVuoto(
                        icona: "chart.line.uptrend.xyaxis",
                        titolo: "Ancora niente da mostrare",
                        messaggio: "Registra come stai per qualche giorno e qui comparirà l'andamento."
                    )
                }
            } else {
                Card {
                    VStack(alignment: .leading, spacing: Spazio.comodo) {
                        GraficoMood(umori: nelPeriodo.reversed(), giorni: periodo.giorni)

                        Divider().overlay(Palette.bordo)

                        distribuzione(nelPeriodo)
                    }
                }
            }
        }
    }

    private func distribuzione(_ elenco: [Umore]) -> some View {
        let conteggi = Dictionary(grouping: elenco, by: \.umore)
            .mapValues(\.count)
            .sorted { $0.value > $1.value }

        return VStack(alignment: .leading, spacing: Spazio.piccolo) {
            ForEach(conteggi, id: \.key) { voce in
                HStack(spacing: Spazio.medio) {
                    Text(voce.key.emoji)
                    Text(voce.key.etichetta)
                        .font(Tipo.didascalia)
                        .foregroundStyle(Palette.testo)
                        .frame(width: 80, alignment: .leading)

                    GeometryReader { geometria in
                        Capsule()
                            .fill(Palette.mood(voce.key))
                            .frame(width: geometria.size.width * (Double(voce.value) / Double(elenco.count)))
                    }
                    .frame(height: 8)

                    Text("\(voce.value)")
                        .font(Tipo.etichetta.monospacedDigit())
                        .foregroundStyle(Palette.testoTenue)
                        .frame(width: 26, alignment: .trailing)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(voce.key.etichetta): \(voce.value) giorni")
            }
        }
    }

    // MARK: - Storico

    private var storico: some View {
        VStack(alignment: .leading, spacing: Spazio.normale) {
            IntestazioneSezione("Gli ultimi giorni")

            VStack(spacing: Spazio.piccolo) {
                ForEach(umori.prefix(14)) { umore in
                    HStack(spacing: Spazio.medio) {
                        Text(umore.umore.emoji).font(.title3)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(CalendarioNina.testoRelativo(umore.giorno))
                                .font(Tipo.corpoForte)
                                .foregroundStyle(Palette.testo)
                            if let nota = umore.nota, !nota.isEmpty {
                                Text(nota)
                                    .font(Tipo.didascalia)
                                    .foregroundStyle(Palette.testoTenue)
                                    .lineLimit(2)
                            }
                        }

                        Spacer(minLength: 0)

                        Text(umore.umore.etichetta)
                            .font(Tipo.etichetta)
                            .foregroundStyle(Palette.mood(umore.umore))
                    }
                    .padding(Spazio.normale)
                    .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                            .strokeBorder(Palette.bordo, lineWidth: 1)
                    }
                }
            }
        }
    }
}

// MARK: - Bolla di un mood

private struct BollaMood: View {
    let umore: MoodKind
    let scelto: Bool
    let azione: () -> Void

    var body: some View {
        Button(action: azione) {
            VStack(spacing: Spazio.piccolo) {
                Text(umore.emoji)
                    .font(.system(size: 34))
                    .scaleEffect(scelto ? 1.1 : 1)

                Text(umore.etichetta)
                    .font(Tipo.etichetta)
                    .foregroundStyle(scelto ? Palette.testoSuRosa : Palette.testo)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spazio.normale)
            .background {
                RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                    .fill(scelto ? AnyShapeStyle(Palette.mood(umore)) : AnyShapeStyle(Palette.carta))
            }
            .overlay {
                RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                    .strokeBorder(scelto ? Palette.mood(umore) : Palette.bordo, lineWidth: scelto ? 2 : 1)
            }
        }
        .buttonStyle(PressioneMorbida())
        .sensoryFeedback(.selection, trigger: scelto) { _, nuovo in nuovo }
        .accessibilityLabel(umore.etichetta)
        .accessibilityAddTraits(scelto ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Grafico

/// Grafico dell'umore disegnato a mano invece che con Swift Charts.
///
/// Motivo: qui i punti sono pochi e discreti (un valore al giorno, sei valori
/// possibili), e servono i colori dei mood sui punti. Un grafico su misura di
/// quaranta righe fa esattamente questo; adattare una libreria generica
/// costerebbe più codice e darebbe un risultato meno pertinente.
private struct GraficoMood: View {
    let umori: [Umore]
    let giorni: Int

    var body: some View {
        GeometryReader { geometria in
            let larghezza = geometria.size.width
            let altezza = geometria.size.height
            let punti = posizioni(larghezza: larghezza, altezza: altezza)

            ZStack {
                // Linee guida orizzontali.
                ForEach(0..<5) { indice in
                    let y = altezza * (Double(indice) / 4)
                    Path { percorso in
                        percorso.move(to: CGPoint(x: 0, y: y))
                        percorso.addLine(to: CGPoint(x: larghezza, y: y))
                    }
                    .stroke(Palette.bordo, lineWidth: 0.5)
                }

                // Linea dell'andamento.
                if punti.count > 1 {
                    Path { percorso in
                        percorso.move(to: punti[0].posizione)
                        for punto in punti.dropFirst() {
                            percorso.addLine(to: punto.posizione)
                        }
                    }
                    .stroke(Palette.rosa.opacity(0.55), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                }

                // Punti colorati per mood.
                ForEach(Array(punti.enumerated()), id: \.offset) { _, punto in
                    Circle()
                        .fill(Palette.mood(punto.umore))
                        .frame(width: 8, height: 8)
                        .position(punto.posizione)
                }
            }
        }
        .frame(height: 120)
        .accessibilityElement()
        .accessibilityLabel("Andamento dell'umore negli ultimi \(giorni) giorni")
    }

    private struct Punto {
        let posizione: CGPoint
        let umore: MoodKind
    }

    private func posizioni(larghezza: CGFloat, altezza: CGFloat) -> [Punto] {
        guard !umori.isEmpty else { return [] }
        let passo = umori.count > 1 ? larghezza / CGFloat(umori.count - 1) : larghezza / 2

        return umori.enumerated().map { indice, umore in
            // Il punteggio va da 1 a 5: si normalizza e si inverte, perché in
            // grafica la y cresce verso il basso.
            let normalizzato = (umore.umore.punteggio - 1) / 4
            return Punto(
                posizione: CGPoint(
                    x: umori.count > 1 ? CGFloat(indice) * passo : larghezza / 2,
                    y: altezza * (1 - normalizzato)
                ),
                umore: umore.umore
            )
        }
    }
}
