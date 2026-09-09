// FILE: ios/Nina/Features/Me/SchermataProgressi.swift
//
// "I miei progressi 📊"
//
// Regola di questa schermata: nessun numero che possa far sentire in colpa.
// Non c'è la percentuale di cose *non* fatte, non ci sono grafici in rosso, non
// c'è il confronto con la settimana scorsa quando è andata peggio. Si mostra
// quello che è stato fatto, e basta.
//
// I dati arrivano dal server, che li calcola con query aggregate; se non c'è
// rete si mostra quello che si può calcolare in locale.

import SwiftUI
import SwiftData

struct SchermataProgressi: View {
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<Attivita> { $0.deletedAt == nil }) private var attivita: [Attivita]
    @Query(filter: #Predicate<CompletamentoAbitudine> { $0.deletedAt == nil && $0.fatta })
    private var completamenti: [CompletamentoAbitudine]
    @Query(filter: #Predicate<Umore> { $0.deletedAt == nil }) private var umori: [Umore]

    @State private var statistiche: StatisticheDTO?
    @State private var periodo = "month"
    @State private var caricamento = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.sezione) {
                selettorePeriodo
                riquadri
                if let statistiche { andamentoGiornaliero(statistiche) }
                perCategoria
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("I miei progressi")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: periodo) { await carica() }
        .refreshable { await carica() }
    }

    // MARK: - Periodo

    private var selettorePeriodo: some View {
        Picker("Periodo", selection: $periodo) {
            Text("Settimana").tag("week")
            Text("Mese").tag("month")
            Text("Anno").tag("year")
        }
        .pickerStyle(.segmented)
        .padding(.top, Spazio.piccolo)
    }

    private var giorniPeriodo: Int {
        switch periodo {
        case "week": 7
        case "year": 365
        default: 30
        }
    }

    // MARK: - Riquadri

    private var riquadri: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: Spazio.medio)], spacing: Spazio.medio) {
            RiquadroNumero(
                titolo: "Cose fatte",
                valore: "\(statistiche?.tasks.completed ?? completateLocali)",
                sottotitolo: "su \(statistiche?.tasks.total ?? totaliLocali)",
                icona: "checkmark.circle.fill"
            )

            RiquadroNumero(
                titolo: "Completamento",
                valore: "\(Int(statistiche?.tasks.completionRate ?? percentualeLocale))%",
                sottotitolo: "delle cose in lista",
                icona: "chart.pie.fill"
            )

            RiquadroNumero(
                titolo: "Streak migliore",
                valore: "\(statistiche?.habits.bestStreak ?? streakLocale)",
                sottotitolo: statistiche?.habits.bestStreakHabit ?? "giorni di fila",
                icona: "flame.fill"
            )

            RiquadroNumero(
                titolo: "Giorni produttivi",
                valore: "\(statistiche?.productiveDays ?? giorniProduttiviLocali)",
                sottotitolo: "almeno metà fatta",
                icona: "sun.max.fill"
            )

            RiquadroNumero(
                titolo: "Abitudini",
                valore: "\(statistiche?.habits.completionsInPeriod ?? completamentiLocali)",
                sottotitolo: "spuntate nel periodo",
                icona: "repeat.circle.fill"
            )

            RiquadroNumero(
                titolo: "Mood segnati",
                valore: "\(statistiche?.mood.entries ?? umoriLocali)",
                sottotitolo: moodPiuFrequente,
                icona: "face.smiling.fill"
            )
        }
    }

    // MARK: - Andamento giornaliero

    private func andamentoGiornaliero(_ dati: StatisticheDTO) -> some View {
        VStack(alignment: .leading, spacing: Spazio.normale) {
            IntestazioneSezione("Giorno per giorno")

            Card {
                if dati.tasks.perDay.isEmpty {
                    Text("Ancora niente da mostrare in questo periodo.")
                        .font(Tipo.didascalia)
                        .foregroundStyle(Palette.testoTenue)
                } else {
                    let massimo = max(dati.tasks.perDay.map(\.total).max() ?? 1, 1)

                    ScrollView(.horizontal) {
                        HStack(alignment: .bottom, spacing: 6) {
                            ForEach(dati.tasks.perDay, id: \.date) { giorno in
                                VStack(spacing: 4) {
                                    ZStack(alignment: .bottom) {
                                        RoundedRectangle(cornerRadius: 4)
                                            .fill(Palette.rosaTenue)
                                            .frame(width: 14, height: 90 * Double(giorno.total) / Double(massimo))

                                        RoundedRectangle(cornerRadius: 4)
                                            .fill(Palette.gradienteRosa)
                                            .frame(width: 14, height: 90 * Double(giorno.completed) / Double(massimo))
                                    }
                                    .frame(height: 90, alignment: .bottom)

                                    Text(String(giorno.date.suffix(2)))
                                        .font(.system(size: 9, design: .rounded))
                                        .foregroundStyle(Palette.testoTenue)
                                }
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel(
                                    "\(CalendarioNina.testoBreve(giorno.date)): \(giorno.completed) fatte su \(giorno.total)"
                                )
                            }
                        }
                        .padding(.vertical, Spazio.piccolo)
                    }
                    .scrollIndicators(.hidden)
                }
            }
        }
    }

    // MARK: - Per categoria

    private var perCategoria: some View {
        let dati: [(TaskCategory, Int, Int)] = {
            if let statistiche {
                return statistiche.tasks.byCategory.compactMap { voce in
                    guard let categoria = TaskCategory(rawValue: voce.category) else { return nil }
                    return (categoria, voce.total, voce.completed)
                }
            }
            return Dictionary(grouping: attivitaNelPeriodo, by: \.categoria)
                .map { ($0.key, $0.value.count, $0.value.filter(\.completata).count) }
                .sorted { $0.1 > $1.1 }
        }()

        return VStack(alignment: .leading, spacing: Spazio.normale) {
            IntestazioneSezione("Dove va il tuo tempo")

            if dati.isEmpty {
                Card {
                    StatoVuoto(
                        icona: "chart.bar",
                        titolo: "Ancora presto",
                        messaggio: "Aggiungi qualche cosa da fare e qui vedrai come si distribuiscono le tue giornate."
                    )
                }
            } else {
                Card {
                    VStack(spacing: Spazio.medio) {
                        ForEach(dati, id: \.0) { categoria, totale, fatte in
                            HStack(spacing: Spazio.medio) {
                                Text(categoria.emoji)
                                Text(categoria.etichetta)
                                    .font(Tipo.didascalia)
                                    .foregroundStyle(Palette.testo)
                                    .frame(width: 84, alignment: .leading)

                                GeometryReader { geometria in
                                    ZStack(alignment: .leading) {
                                        Capsule()
                                            .fill(Palette.categoria(categoria).opacity(0.18))
                                        Capsule()
                                            .fill(Palette.categoria(categoria))
                                            .frame(width: geometria.size.width * (Double(fatte) / Double(max(totale, 1))))
                                    }
                                }
                                .frame(height: 10)

                                Text("\(fatte)/\(totale)")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(Palette.testoTenue)
                                    .frame(width: 42, alignment: .trailing)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Dati

    private func carica() async {
        caricamento = true
        defer { caricamento = false }

        statistiche = try? await ClientAPI.condiviso.richiesta(
            .get, "stats", query: ["period": periodo]
        )
    }

    // MARK: - Calcolo locale (quando non c'è rete)

    private var da: String {
        CalendarioNina.giorno(spostatoDi: -(giorniPeriodo - 1), da: CalendarioNina.oggi)
    }

    private var attivitaNelPeriodo: [Attivita] {
        attivita.filter { $0.giorno >= da && $0.giorno <= CalendarioNina.oggi }
    }

    private var totaliLocali: Int { attivitaNelPeriodo.count }
    private var completateLocali: Int { attivitaNelPeriodo.filter(\.completata).count }

    private var percentualeLocale: Double {
        guard totaliLocali > 0 else { return 0 }
        return Double(completateLocali) / Double(totaliLocali) * 100
    }

    private var completamentiLocali: Int {
        completamenti.filter { $0.giorno >= da }.count
    }

    private var umoriLocali: Int {
        umori.filter { $0.giorno >= da }.count
    }

    private var moodPiuFrequente: String {
        if let dal = statistiche?.mood.mostFrequent,
           let umore = MoodKind(rawValue: dal) {
            return "spesso \(umore.etichetta.lowercased())"
        }

        let conteggi = Dictionary(grouping: umori.filter { $0.giorno >= da }, by: \.umore)
        guard let piu = conteggi.max(by: { $0.value.count < $1.value.count })?.key else {
            return "nel periodo"
        }
        return "spesso \(piu.etichetta.lowercased())"
    }

    private var giorniProduttiviLocali: Int {
        Dictionary(grouping: attivitaNelPeriodo, by: \.giorno)
            .filter { _, elenco in
                !elenco.isEmpty && Double(elenco.filter(\.completata).count) / Double(elenco.count) >= 0.5
            }
            .count
    }

    private var streakLocale: Int {
        let perAbitudine = Dictionary(grouping: completamenti, by: \.abitudineId)
            .mapValues { Set($0.map(\.giorno)) }

        var migliore = 0
        for giorniFatti in perAbitudine.values {
            var corrente = 0
            var giorno = CalendarioNina.oggi
            while giorniFatti.contains(giorno) && corrente < 3650 {
                corrente += 1
                giorno = CalendarioNina.giorno(spostatoDi: -1, da: giorno)
            }
            migliore = max(migliore, corrente)
        }
        return migliore
    }
}

// MARK: - Riquadro

private struct RiquadroNumero: View {
    let titolo: String
    let valore: String
    let sottotitolo: String
    let icona: String

    var body: some View {
        Card(riempimento: Spazio.normale) {
            VStack(alignment: .leading, spacing: Spazio.piccolo) {
                HStack {
                    Image(systemName: icona)
                        .font(.footnote)
                        .foregroundStyle(Palette.rosa)
                    Text(titolo)
                        .font(Tipo.etichetta)
                        .foregroundStyle(Palette.testoTenue)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }

                Text(valore)
                    .font(.system(.title, design: .rounded, weight: .bold))
                    .foregroundStyle(Palette.testo)
                    .contentTransition(.numericText())

                Text(sottotitolo)
                    .font(.caption)
                    .foregroundStyle(Palette.testoTenue)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(titolo): \(valore), \(sottotitolo)")
    }
}
