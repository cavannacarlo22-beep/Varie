// FILE: ios/Nina/Features/Me/SchermataAbitudini.swift
//
// "Le mie abitudini".
//
// Lo streak è la parte che fa funzionare la sezione, e va trattato con cura:
// premia la costanza ma non deve punire chi salta un giorno. Per questo la
// giornata in corso non spezza mai la serie finché non è finita, e quando una
// serie si interrompe Nina lo dice in modo gentile invece di mostrare uno zero.

import SwiftUI
import SwiftData

struct SchermataAbitudini: View {
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<Abitudine> { $0.deletedAt == nil },
           sort: [SortDescriptor<Abitudine>(\.ordine), SortDescriptor<Abitudine>(\.createdAt)])
    private var abitudini: [Abitudine]

    @Query(filter: #Predicate<CompletamentoAbitudine> { $0.deletedAt == nil && $0.fatta })
    private var completamenti: [CompletamentoAbitudine]

    @State private var mostraNuova = false
    @State private var daModificare: Abitudine?

    private let oggi = CalendarioNina.oggi

    /// I giorni completati per ogni abitudine: si calcola una volta sola.
    private var perAbitudine: [UUID: Set<String>] {
        Dictionary(grouping: completamenti, by: \.abitudineId)
            .mapValues { Set($0.map(\.giorno)) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.comodo) {
                if abitudini.isEmpty {
                    Card {
                        StatoVuoto(
                            icona: "flame",
                            titolo: "Nessuna abitudine, per ora",
                            messaggio: VoceDiNina.nienteAbitudini(),
                            azione: (titolo: "Aggiungi la prima", esegui: { mostraNuova = true })
                        )
                    }
                    suggerimenti
                } else {
                    ForEach(abitudini) { abitudine in
                        CardAbitudine(
                            abitudine: abitudine,
                            giorniFatti: perAbitudine[abitudine.id] ?? [],
                            oggi: oggi,
                            onModifica: { daModificare = abitudine }
                        )
                    }
                }
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("Abitudini")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { mostraNuova = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Nuova abitudine")
            }
        }
        .sheet(isPresented: $mostraNuova) { ModificaAbitudine() }
        .sheet(item: $daModificare) { abitudine in ModificaAbitudine(abitudine: abitudine) }
    }

    /// Proposte pronte: chi apre la sezione per la prima volta spesso non sa da
    /// dove cominciare, e un elenco vuoto con un bottone "+" non aiuta.
    private var suggerimenti: some View {
        VStack(alignment: .leading, spacing: Spazio.medio) {
            Text("Qualche idea")
                .font(Tipo.sottotitolo)
                .foregroundStyle(Palette.testo)

            let proposte: [(String, String)] = [
                ("💧", "Bere acqua"), ("🏃", "Allenamento"), ("📖", "Leggere"),
                ("🧘", "Meditare"), ("🧴", "Skincare"), ("😴", "Dormire presto"),
                ("📵", "Meno telefono"),
            ]

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: Spazio.piccolo)], spacing: Spazio.piccolo) {
                ForEach(proposte, id: \.1) { icona, nome in
                    Button {
                        deposito.creaAbitudine(
                            nome: nome, icona: icona, colore: "#F48FB1",
                            frequenza: .daily, giorni: [1, 2, 3, 4, 5, 6, 7]
                        )
                    } label: {
                        HStack(spacing: Spazio.piccolo) {
                            Text(icona)
                            Text(nome)
                                .font(Tipo.didascalia)
                                .foregroundStyle(Palette.testo)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            Image(systemName: "plus.circle.fill")
                                .font(.footnote)
                                .foregroundStyle(Palette.rosa)
                        }
                        .padding(Spazio.medio)
                        .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.piccolo, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: Raggio.piccolo, style: .continuous)
                                .strokeBorder(Palette.bordo, lineWidth: 1)
                        }
                    }
                    .buttonStyle(PressioneMorbida())
                }
            }
        }
    }
}

// MARK: - Card di un'abitudine

struct CardAbitudine: View {
    let abitudine: Abitudine
    let giorniFatti: Set<String>
    let oggi: String
    let onModifica: () -> Void

    @Environment(Deposito.self) private var deposito
    @State private var appenaSpuntata = false

    // La frase sotto il nome viene scelta a caso fra molte varianti. Se la si
    // calcolasse dentro `body` cambierebbe a ogni ridisegno — anche solo
    // scorrendo l'elenco — e sembrerebbe un difetto. Si sceglie una volta e si
    // aggiorna solo quando il numero cambia davvero.
    @State private var sottotitolo = ""

    private var colore: Color { Color(hexString: abitudine.colore) ?? Palette.rosa }
    private var fattaOggi: Bool { giorniFatti.contains(oggi) }

    /// Giorni consecutivi fino a oggi. Il conteggio vive in `Serie`, fuori
    /// dalle viste, perché è la logica dell'app che si sbaglia più facilmente
    /// e vale la pena poterla provare da sola.
    private var streak: Int {
        Serie.giorniConsecutivi(fatti: giorniFatti, oggi: oggi)
    }

    /// Il record personale: serve solo quando la serie attuale è a zero.
    private var record: Int { Serie.serieMassima(fatti: giorniFatti) }

    /// Gli ultimi sette giorni, per la strisciolina.
    private var ultimaSettimana: [String] {
        (0..<7).reversed().map { CalendarioNina.giorno(spostatoDi: -$0, da: oggi) }
    }

    /// Tre casi, in ordine di quanto sono belli da leggere:
    /// una serie in corso, una serie interrotta (mai uno zero secco: uno zero
    /// è un rimprovero), oppure semplicemente la frequenza dell'abitudine.
    private func nuovoSottotitolo() -> String {
        if streak > 0 { return VoceDiNina.streak(streak) }
        if record > 1 { return VoceDiNina.streakInterrotto() }
        return abitudine.frequenza.etichetta
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Spazio.normale) {
                HStack(spacing: Spazio.medio) {
                    ZStack {
                        Circle().fill(colore.opacity(0.16)).frame(width: 46, height: 46)
                        Text(abitudine.icona).font(.system(size: 22))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(abitudine.nome)
                            .font(Tipo.sottotitolo)
                            .foregroundStyle(Palette.testo)

                        Text(sottotitolo)
                            .font(Tipo.didascalia)
                            .foregroundStyle(streak > 0 ? colore : Palette.testoTenue)
                            .onAppear { if sottotitolo.isEmpty { sottotitolo = nuovoSottotitolo() } }
                            .onChange(of: streak) { sottotitolo = nuovoSottotitolo() }
                    }

                    Spacer(minLength: 0)

                    Button {
                        appenaSpuntata = deposito.alterna(abitudine: abitudine, giorno: oggi)
                    } label: {
                        ZStack {
                            Circle()
                                .fill(fattaOggi ? AnyShapeStyle(colore) : AnyShapeStyle(colore.opacity(0.14)))
                                .frame(width: 44, height: 44)
                            Image(systemName: fattaOggi ? "checkmark" : "plus")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(fattaOggi ? Palette.testoSuRosa : colore)
                        }
                    }
                    .buttonStyle(PressioneMorbida())
                    .sensoryFeedback(.success, trigger: appenaSpuntata) { _, nuovo in nuovo }
                    .accessibilityLabel(fattaOggi ? "Togli la spunta di oggi" : "Segna come fatta oggi")
                }

                // Ultimi sette giorni.
                HStack(spacing: Spazio.piccolo) {
                    ForEach(ultimaSettimana, id: \.self) { giorno in
                        VStack(spacing: 4) {
                            Text(GiornoSettimana(rawValue: CalendarioNina.giornoSettimana(di: giorno))?.lettera ?? "")
                                .font(.system(size: 9, weight: .medium, design: .rounded))
                                .foregroundStyle(Palette.testoTenue)

                            Circle()
                                .fill(giorniFatti.contains(giorno) ? colore : colore.opacity(0.12))
                                .frame(width: 22, height: 22)
                                .overlay {
                                    if giorno == oggi {
                                        Circle().strokeBorder(colore, lineWidth: 1.5)
                                    }
                                }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Ultimi sette giorni: \(ultimaSettimana.filter(giorniFatti.contains).count) su 7")
            }
        }
        .contextMenu {
            Button { onModifica() } label: { Label("Modifica", systemImage: "pencil") }
            Button(role: .destructive) {
                deposito.elimina(abitudine)
            } label: {
                Label("Elimina", systemImage: "trash")
            }
        }
    }
}

// MARK: - Creazione e modifica

struct ModificaAbitudine: View {
    var abitudine: Abitudine?

    @Environment(Deposito.self) private var deposito
    @Environment(\.dismiss) private var chiudi

    @State private var nome = ""
    @State private var icona = "✨"
    @State private var colore = "#F48FB1"
    @State private var frequenza: HabitFrequency = .daily
    @State private var giorni: Set<Int> = [1, 2, 3, 4, 5, 6, 7]

    private let iconeDisponibili = ["💧", "🏃", "📖", "🧘", "🧴", "😴", "📵", "🥗", "✍️", "🎧", "🌿", "☀️", "💪", "🧹", "✨"]
    private let coloriDisponibili = ["#F48FB1", "#E96A95", "#B48FD9", "#8FB8E8", "#7FCBB0", "#E8B87F", "#E88F8F", "#B8A88F"]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Come si chiama", text: $nome)
                        .font(Tipo.corpo)
                }
                .listRowBackground(Palette.carta)

                Section("Icona") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: Spazio.piccolo) {
                        ForEach(iconeDisponibili, id: \.self) { simbolo in
                            Button {
                                icona = simbolo
                            } label: {
                                Text(simbolo)
                                    .font(.system(size: 22))
                                    .frame(width: 44, height: 44)
                                    .background(
                                        icona == simbolo ? Palette.rosaTenue : Color.clear,
                                        in: RoundedRectangle(cornerRadius: Raggio.piccolo, style: .continuous)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .listRowBackground(Palette.carta)

                Section("Colore") {
                    HStack(spacing: Spazio.medio) {
                        ForEach(coloriDisponibili, id: \.self) { valore in
                            Button {
                                colore = valore
                            } label: {
                                Circle()
                                    .fill(Color(hexString: valore) ?? Palette.rosa)
                                    .frame(width: 32, height: 32)
                                    .overlay {
                                        if colore == valore {
                                            Circle().strokeBorder(Palette.testo, lineWidth: 2)
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Colore \(valore)")
                        }
                    }
                }
                .listRowBackground(Palette.carta)

                Section("Ogni quanto") {
                    Picker("Frequenza", selection: $frequenza.animation(.ninaVeloce)) {
                        ForEach(HabitFrequency.allCases) { valore in
                            Text(valore.etichetta).tag(valore)
                        }
                    }

                    if frequenza == .custom {
                        HStack(spacing: Spazio.piccolo) {
                            ForEach(GiornoSettimana.allCases) { giorno in
                                Button {
                                    if giorni.contains(giorno.rawValue) {
                                        giorni.remove(giorno.rawValue)
                                    } else {
                                        giorni.insert(giorno.rawValue)
                                    }
                                } label: {
                                    Text(giorno.lettera)
                                        .font(Tipo.etichetta)
                                        .frame(width: 34, height: 34)
                                        .background(
                                            giorni.contains(giorno.rawValue)
                                                ? AnyShapeStyle(Palette.gradienteRosa)
                                                : AnyShapeStyle(Palette.rosaTenue),
                                            in: Circle()
                                        )
                                        .foregroundStyle(
                                            giorni.contains(giorno.rawValue) ? Palette.testoSuRosa : Palette.rosa
                                        )
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(giorno.nome)
                            }
                        }
                    }
                }
                .listRowBackground(Palette.carta)
            }
            .scrollContentBackground(.hidden)
            .background(SfondoNina())
            .navigationTitle(abitudine == nil ? "Nuova abitudine" : "Modifica")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { chiudi() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") { salva() }
                        .fontWeight(.semibold)
                        .disabled(nome.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                guard let abitudine else { return }
                nome = abitudine.nome
                icona = abitudine.icona
                colore = abitudine.colore
                frequenza = abitudine.frequenza
                giorni = Set(abitudine.giorniObiettivo)
            }
        }
    }

    private func salva() {
        let testo = nome.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !testo.isEmpty else { return }
        let giorniFinali = frequenza == .custom ? Array(giorni).sorted() : [1, 2, 3, 4, 5, 6, 7]

        if let abitudine {
            deposito.modificaAbitudine(abitudine) { modifica in
                modifica.nome = testo
                modifica.icona = icona
                modifica.colore = colore
                modifica.frequenza = frequenza
                modifica.giorniObiettivo = giorniFinali
            }
        } else {
            deposito.creaAbitudine(
                nome: testo, icona: icona, colore: colore,
                frequenza: frequenza, giorni: giorniFinali
            )
        }
        chiudi()
    }
}
