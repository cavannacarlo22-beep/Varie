// FILE: ios/Nina/Features/Attivita/ModificaAttivita.swift
//
// Creare o modificare un'attività.
//
// La schermata è progettata perché il caso normale — "scrivo una cosa da fare
// oggi" — costi un campo e un tocco. Tutto il resto (ora, categoria, priorità,
// ripetizione, promemoria) sta sotto, già compilato con valori sensati, e si
// tocca solo se serve davvero.
//
// È la differenza fra una to do che si usa e una che si abbandona dopo tre
// giorni: se aggiungere una cosa richiede sei decisioni, si smette di aggiungerle.

import SwiftUI

struct ModificaAttivita: View {
    /// L'attività da modificare, oppure nil per crearne una nuova.
    var attivita: Attivita?
    var giornoPredefinito: String = CalendarioNina.oggi

    @Environment(Deposito.self) private var deposito
    @Environment(\.dismiss) private var chiudi

    @State private var titolo = ""
    @State private var giorno = CalendarioNina.oggi
    @State private var conOrario = false
    @State private var orario = Date()
    @State private var categoria: TaskCategory = .personale
    @State private var priorita: TaskPriority = .medium
    @State private var note = ""
    @State private var ripetizione: RepeatType = .never
    @State private var giorniRipetizione: Set<Int> = []
    @State private var promemoria = false
    @State private var minutiPrima = 15
    @State private var mostraEliminaSerie = false

    @FocusState private var titoloInFocus: Bool

    private var eNuova: Bool { attivita == nil }

    var body: some View {
        NavigationStack {
            Form {
                sezionePrincipale
                sezioneQuando
                sezioneDettagli
                sezioneRipetizione
                sezionePromemoria

                if !eNuova {
                    sezioneElimina
                }
            }
            .scrollContentBackground(.hidden)
            .background(SfondoNina())
            .navigationTitle(eNuova ? "Nuova cosa da fare" : "Modifica")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { chiudi() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") { salva() }
                        .fontWeight(.semibold)
                        .disabled(titolo.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear(perform: carica)
            .confirmationDialog(
                "Questa attività si ripete",
                isPresented: $mostraEliminaSerie,
                titleVisibility: .visible
            ) {
                Button("Elimina solo questa", role: .destructive) {
                    if let attivita { deposito.elimina(attivita) }
                    chiudi()
                }
                Button("Elimina questa e le successive", role: .destructive) {
                    if let attivita { deposito.eliminaSerie(da: attivita) }
                    chiudi()
                }
                Button("Annulla", role: .cancel) {}
            }
        }
    }

    // MARK: - Sezioni

    private var sezionePrincipale: some View {
        Section {
            TextField("Cosa devi fare?", text: $titolo, axis: .vertical)
                .font(Tipo.corpo)
                .lineLimit(1...3)
                .focused($titoloInFocus)
                .submitLabel(.done)
        }
        .listRowBackground(Palette.carta)
    }

    private var sezioneQuando: some View {
        Section("Quando") {
            DatePicker(
                "Giorno",
                selection: Binding(
                    get: { CalendarioNina.data(daGiorno: giorno) ?? Date() },
                    set: { giorno = CalendarioNina.giorno(da: $0) }
                ),
                displayedComponents: .date
            )
            .datePickerStyle(.compact)

            Toggle("A un'ora precisa", isOn: $conOrario.animation(.ninaVeloce))

            if conOrario {
                DatePicker("Ora", selection: $orario, displayedComponents: .hourAndMinute)
            }

            // Scorciatoie: coprono il 90% dei casi senza aprire il calendario.
            HStack(spacing: Spazio.piccolo) {
                ChipFiltro(testo: "Oggi", attivo: giorno == CalendarioNina.oggi) {
                    giorno = CalendarioNina.oggi
                }
                ChipFiltro(
                    testo: "Domani",
                    attivo: giorno == CalendarioNina.giorno(spostatoDi: 1, da: CalendarioNina.oggi)
                ) {
                    giorno = CalendarioNina.giorno(spostatoDi: 1, da: CalendarioNina.oggi)
                }
                ChipFiltro(
                    testo: "Fra una settimana",
                    attivo: giorno == CalendarioNina.giorno(spostatoDi: 7, da: CalendarioNina.oggi)
                ) {
                    giorno = CalendarioNina.giorno(spostatoDi: 7, da: CalendarioNina.oggi)
                }
            }
        }
        .listRowBackground(Palette.carta)
    }

    private var sezioneDettagli: some View {
        Section("Dettagli") {
            Picker("Categoria", selection: $categoria) {
                ForEach(TaskCategory.allCases) { valore in
                    Text("\(valore.emoji)  \(valore.etichetta)").tag(valore)
                }
            }

            Picker("Priorità", selection: $priorita) {
                ForEach(TaskPriority.allCases) { valore in
                    Text(valore.etichetta).tag(valore)
                }
            }
            .pickerStyle(.segmented)

            TextField("Note (facoltative)", text: $note, axis: .vertical)
                .lineLimit(2...6)
        }
        .listRowBackground(Palette.carta)
    }

    private var sezioneRipetizione: some View {
        Section("Si ripete") {
            Picker("Ripetizione", selection: $ripetizione.animation(.ninaVeloce)) {
                ForEach(RepeatType.allCases) { valore in
                    Text(valore.etichetta).tag(valore)
                }
            }

            if ripetizione == .custom {
                VStack(alignment: .leading, spacing: Spazio.piccolo) {
                    Text("In quali giorni")
                        .font(Tipo.etichetta)
                        .foregroundStyle(Palette.testoTenue)

                    HStack(spacing: Spazio.piccolo) {
                        ForEach(GiornoSettimana.allCases) { giornoSettimana in
                            Button {
                                if giorniRipetizione.contains(giornoSettimana.rawValue) {
                                    giorniRipetizione.remove(giornoSettimana.rawValue)
                                } else {
                                    giorniRipetizione.insert(giornoSettimana.rawValue)
                                }
                            } label: {
                                Text(giornoSettimana.lettera)
                                    .font(Tipo.etichetta)
                                    .frame(width: 34, height: 34)
                                    .background(
                                        giorniRipetizione.contains(giornoSettimana.rawValue)
                                            ? AnyShapeStyle(Palette.gradienteRosa)
                                            : AnyShapeStyle(Palette.rosaTenue),
                                        in: Circle()
                                    )
                                    .foregroundStyle(
                                        giorniRipetizione.contains(giornoSettimana.rawValue)
                                            ? Palette.testoSuRosa : Palette.rosa
                                    )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(giornoSettimana.nome)
                            .accessibilityAddTraits(
                                giorniRipetizione.contains(giornoSettimana.rawValue) ? .isSelected : []
                            )
                        }
                    }
                }
                .padding(.vertical, Spazio.minimo)
            }

            if ripetizione != .never && eNuova {
                Text("Creo le prossime occorrenze fino a tre mesi avanti, e le rinnovo man mano 💗")
                    .font(.caption)
                    .foregroundStyle(Palette.testoTenue)
            }
        }
        .listRowBackground(Palette.carta)
    }

    private var sezionePromemoria: some View {
        Section("Promemoria") {
            Toggle("Avvisami", isOn: $promemoria.animation(.ninaVeloce))
                .disabled(!conOrario)

            if !conOrario {
                Text("Per avvisarti mi serve un orario.")
                    .font(.caption)
                    .foregroundStyle(Palette.testoTenue)
            }

            if promemoria && conOrario {
                Picker("Quanto prima", selection: $minutiPrima) {
                    Text("Sul momento").tag(0)
                    Text("5 minuti prima").tag(5)
                    Text("15 minuti prima").tag(15)
                    Text("30 minuti prima").tag(30)
                    Text("1 ora prima").tag(60)
                    Text("Il giorno prima").tag(1440)
                }
            }
        }
        .listRowBackground(Palette.carta)
    }

    private var sezioneElimina: some View {
        Section {
            Button(role: .destructive) {
                guard let attivita else { return }
                if attivita.serieId != nil {
                    mostraEliminaSerie = true
                } else {
                    deposito.elimina(attivita)
                    chiudi()
                }
            } label: {
                Label("Elimina", systemImage: "trash")
                    .frame(maxWidth: .infinity)
            }
        }
        .listRowBackground(Palette.carta)
    }

    // MARK: - Dati

    private func carica() {
        guard let attivita else {
            giorno = giornoPredefinito
            titoloInFocus = true
            return
        }

        titolo = attivita.titolo
        giorno = attivita.giorno
        conOrario = attivita.ora != nil
        if let ora = attivita.ora,
           let data = CalendarioNina.data(giorno: attivita.giorno, ora: ora) {
            orario = data
        }
        categoria = attivita.categoria
        priorita = attivita.priorita
        note = attivita.note ?? ""
        ripetizione = attivita.ripetizione
        giorniRipetizione = Set(attivita.giorniRipetizione)
        promemoria = attivita.notificaAttiva
        minutiPrima = attivita.minutiPrima
    }

    private func salva() {
        let testo = titolo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !testo.isEmpty else { return }

        let oraTesto = conOrario ? CalendarioNina.ora(da: orario) : nil
        let noteTesto = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let giorni = ripetizione == .custom ? Array(giorniRipetizione).sorted() : []

        if let attivita {
            deposito.modificaAttivita(attivita) { modifica in
                modifica.titolo = testo
                modifica.giorno = giorno
                modifica.ora = oraTesto
                modifica.categoria = categoria
                modifica.priorita = priorita
                modifica.note = noteTesto.isEmpty ? nil : noteTesto
                modifica.ripetizione = ripetizione
                modifica.giorniRipetizione = giorni
                modifica.notificaAttiva = promemoria && conOrario
                modifica.minutiPrima = minutiPrima
            }
        } else {
            deposito.creaAttivita(
                titolo: testo,
                giorno: giorno,
                ora: oraTesto,
                categoria: categoria,
                priorita: priorita,
                note: noteTesto.isEmpty ? nil : noteTesto,
                ripetizione: ripetizione,
                giorniRipetizione: giorni,
                notificaAttiva: promemoria && conOrario,
                minutiPrima: minutiPrima
            )
        }

        Task { await PianificatoreNotifiche.condiviso.riprogramma(deposito: deposito) }
        chiudi()
    }
}

// MARK: - Nota veloce

/// "Devo ricordarmi…": il foglio più semplice dell'app, di proposito.
struct NuovaNotaVeloce: View {
    @Environment(Deposito.self) private var deposito
    @Environment(\.dismiss) private var chiudi

    @State private var testo = ""
    @FocusState private var inFocus: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Spazio.comodo) {
                Text("Devo ricordarmi…")
                    .font(Tipo.titolo)
                    .foregroundStyle(Palette.testo)

                TextField("Prenotare il parrucchiere", text: $testo, axis: .vertical)
                    .font(Tipo.corpo)
                    .lineLimit(3...8)
                    .focused($inFocus)
                    .padding(Spazio.normale)
                    .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: Raggio.medio, style: .continuous)
                            .strokeBorder(Palette.bordo, lineWidth: 1)
                    }

                Text("Poi potrai trasformarla in una cosa da fare, se serve.")
                    .font(Tipo.didascalia)
                    .foregroundStyle(Palette.testoTenue)

                Spacer()

                BottoneRosa(titolo: "Salva", icona: "checkmark") {
                    salva()
                }
                .disabled(testo.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(Spazio.comodo)
            .sfondoNina()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { chiudi() }
                }
            }
            .onAppear { inFocus = true }
        }
        .presentationDetents([.medium])
    }

    private func salva() {
        let contenuto = testo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !contenuto.isEmpty else { return }
        deposito.creaNota(contenuto)
        chiudi()
    }
}
