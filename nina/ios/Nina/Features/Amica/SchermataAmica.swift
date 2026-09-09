// FILE: ios/Nina/Features/Amica/SchermataAmica.swift
//
// "La mia amica 💗"
//
// Una conversazione, con due accorgimenti che cambiano tutto:
//
//  1. **Nina scrive con un ritardo.** Una risposta che compare nello stesso
//     istante in cui premi invio è chiaramente una macchina. Mezzo secondo di
//     "sta scrivendo…" non è un trucco: è il tempo che rende la conversazione
//     leggibile invece che meccanica.
//
//  2. **Si vede da dove arriva la risposta.** Se il messaggio arriva dal motore
//     locale, l'app non finge il contrario. Non c'è una scritta a ogni bolla,
//     ma in cima si può sapere come sta rispondendo.

import SwiftUI
import SwiftData

struct SchermataAmica: View {
    @Environment(Deposito.self) private var deposito
    @Environment(Sessione.self) private var sessione

    @Query(filter: #Predicate<MessaggioAmica> { $0.deletedAt == nil },
           sort: [SortDescriptor(\MessaggioAmica.createdAt)])
    private var messaggi: [MessaggioAmica]

    @State private var testo = ""
    @State private var staScrivendo = false
    @State private var errore: String?
    @State private var stato: StatoAmica?
    @State private var mostraInfo = false

    @FocusState private var campoInFocus: Bool

    var body: some View {
        VStack(spacing: 0) {
            conversazione
            barraScrittura
        }
        .sfondoNina()
        .navigationTitle("La mia amica")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { mostraInfo = true } label: { Image(systemName: "info.circle") }
                    .accessibilityLabel("Come funziona")
            }
        }
        .sheet(isPresented: $mostraInfo) { InfoAmica(stato: stato) }
        .task {
            stato = try? await ClientAPI.condiviso.richiesta(.get, "friend/status")
            await caricaStorico()
        }
    }

    // MARK: - Conversazione

    private var conversazione: some View {
        ScrollViewReader { lettore in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spazio.medio) {
                    if messaggi.isEmpty {
                        benvenuto
                    }

                    ForEach(messaggi) { messaggio in
                        BollaMessaggio(messaggio: messaggio)
                            .id(messaggio.id)
                    }

                    if staScrivendo {
                        StaScrivendo().id("staScrivendo")
                    }

                    if let errore {
                        AvvisoErrore(messaggio: errore)
                    }
                }
                .padding(.horizontal, Spazio.normale)
                .padding(.vertical, Spazio.comodo)
            }
            .scrollIndicators(.hidden)
            .onChange(of: messaggi.count) { _, _ in scorriInFondo(lettore) }
            .onChange(of: staScrivendo) { _, _ in scorriInFondo(lettore) }
            .onAppear { scorriInFondo(lettore, animato: false) }
        }
    }

    private func scorriInFondo(_ lettore: ScrollViewProxy, animato: Bool = true) {
        guard let ultimo = messaggi.last?.id else { return }
        let destinazione = staScrivendo ? "staScrivendo" : ultimo.uuidString

        if animato {
            withAnimation(.nina) {
                if staScrivendo { lettore.scrollTo("staScrivendo", anchor: .bottom) }
                else { lettore.scrollTo(ultimo, anchor: .bottom) }
            }
        } else {
            if staScrivendo { lettore.scrollTo("staScrivendo", anchor: .bottom) }
            else { lettore.scrollTo(ultimo, anchor: .bottom) }
        }
        _ = destinazione
    }

    private var benvenuto: some View {
        VStack(alignment: .leading, spacing: Spazio.normale) {
            Text("Ciao \(sessione.nome) 💗")
                .font(Tipo.titolo)
                .foregroundStyle(Palette.testo)

            Text("Scrivimi come sta andando. Anche una parola sola, anche una cosa stupida. Non devo risolverti niente: ti ascolto e basta.")
                .font(Tipo.corpo)
                .foregroundStyle(Palette.testoTenue)
                .lettura()

            // Aperture pronte: davanti a un campo vuoto è difficile cominciare.
            VStack(alignment: .leading, spacing: Spazio.piccolo) {
                ForEach(["Oggi sono stanca", "Sono agitata per domani", "Ho avuto una bella giornata"], id: \.self) { proposta in
                    Button {
                        testo = proposta
                        campoInFocus = true
                    } label: {
                        HStack {
                            Text(proposta)
                                .font(Tipo.didascalia)
                                .foregroundStyle(Palette.rosa)
                            Spacer()
                            Image(systemName: "arrow.up.left")
                                .font(.caption2)
                                .foregroundStyle(Palette.rosa.opacity(0.6))
                        }
                        .padding(.horizontal, Spazio.normale)
                        .padding(.vertical, Spazio.medio)
                        .background(Palette.rosaTenue, in: Capsule())
                    }
                    .buttonStyle(PressioneMorbida())
                }
            }
            .padding(.top, Spazio.piccolo)
        }
        .padding(.bottom, Spazio.normale)
    }

    // MARK: - Scrittura

    private var barraScrittura: some View {
        HStack(alignment: .bottom, spacing: Spazio.medio) {
            TextField("Scrivi a Nina…", text: $testo, axis: .vertical)
                .font(Tipo.corpo)
                .lineLimit(1...5)
                .focused($campoInFocus)
                .padding(.horizontal, Spazio.normale)
                .padding(.vertical, Spazio.medio)
                .background(Palette.carta, in: RoundedRectangle(cornerRadius: Raggio.grande, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Raggio.grande, style: .continuous)
                        .strokeBorder(Palette.bordo, lineWidth: 1)
                }

            Button {
                Task { await invia() }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Palette.testoSuRosa)
                    .frame(width: 44, height: 44)
                    .background(Palette.gradienteRosa, in: Circle())
            }
            .buttonStyle(PressioneMorbida())
            .disabled(testo.trimmingCharacters(in: .whitespaces).isEmpty || staScrivendo)
            .opacity(testo.trimmingCharacters(in: .whitespaces).isEmpty ? 0.5 : 1)
            .accessibilityLabel("Invia")
        }
        .padding(Spazio.normale)
        .background(.ultraThinMaterial)
    }

    // MARK: - Invio

    private func invia() async {
        let contenuto = testo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !contenuto.isEmpty else { return }

        testo = ""
        errore = nil

        // Il messaggio compare subito: l'attesa riguarda la risposta, non
        // quello che ha appena scritto lei.
        deposito.aggiungiMessaggio(MessaggioAmica(autore: "USER", contenuto: contenuto))

        withAnimation(.ninaVeloce) { staScrivendo = true }

        do {
            let risposta: RispostaMessaggio = try await ClientAPI.condiviso.richiesta(
                .post, "friend/messages",
                corpo: RichiestaMessaggio(
                    content: contenuto,
                    hour: Calendar.current.component(.hour, from: Date())
                )
            )

            // Ritardo minimo: vedi la nota in cima al file.
            try? await Task.sleep(for: .milliseconds(450))

            withAnimation(.ninaVeloce) { staScrivendo = false }

            deposito.aggiungiMessaggio(MessaggioAmica(
                id: risposta.reply.id,
                autore: "NINA",
                contenuto: risposta.reply.content,
                createdAt: CalendarioNina.data(daIso: risposta.reply.createdAt) ?? Date()
            ))
        } catch {
            withAnimation(.ninaVeloce) { staScrivendo = false }

            // Anche senza rete Nina dice qualcosa: restare in silenzio proprio
            // quando qualcuno ti sta scrivendo è la cosa peggiore.
            deposito.aggiungiMessaggio(MessaggioAmica(
                autore: "NINA",
                contenuto: "Adesso non riesco a risponderti come vorrei — non c'è connessione. Ma ti ho letta 💗"
            ))
        }
    }

    private func caricaStorico() async {
        guard messaggi.isEmpty else { return }

        struct Elenco: Codable, Sendable { let items: [MessaggioDTO] }
        guard let elenco: Elenco = try? await ClientAPI.condiviso.richiesta(
            .get, "friend/messages", query: ["limit": "100"]
        ) else { return }

        for dto in elenco.items {
            deposito.aggiungiMessaggio(MessaggioAmica(
                id: dto.id,
                autore: dto.author,
                contenuto: dto.content,
                createdAt: CalendarioNina.data(daIso: dto.createdAt) ?? Date()
            ))
        }
    }
}

// MARK: - Bolla

private struct BollaMessaggio: View {
    let messaggio: MessaggioAmica

    var body: some View {
        HStack {
            if !messaggio.scrittoDaNina { Spacer(minLength: 50) }

            Text(messaggio.contenuto)
                .font(Tipo.corpo)
                .foregroundStyle(messaggio.scrittoDaNina ? Palette.testo : Palette.testoSuRosa)
                .lettura()
                .padding(.horizontal, Spazio.normale)
                .padding(.vertical, Spazio.medio)
                .background {
                    if messaggio.scrittoDaNina {
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(Palette.carta)
                            .overlay {
                                RoundedRectangle(cornerRadius: 20, style: .continuous)
                                    .strokeBorder(Palette.bordo, lineWidth: 1)
                            }
                    } else {
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(Palette.gradienteRosa)
                    }
                }
                .frame(maxWidth: 320, alignment: messaggio.scrittoDaNina ? .leading : .trailing)

            if messaggio.scrittoDaNina { Spacer(minLength: 50) }
        }
        .frame(maxWidth: .infinity, alignment: messaggio.scrittoDaNina ? .leading : .trailing)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(messaggio.scrittoDaNina ? "Nina" : "Tu"): \(messaggio.contenuto)")
    }
}

// MARK: - "Sta scrivendo…"

private struct StaScrivendo: View {
    @State private var fase = 0

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3) { indice in
                Circle()
                    .fill(Palette.testoTenue)
                    .frame(width: 7, height: 7)
                    .opacity(fase == indice ? 1 : 0.35)
            }
        }
        .padding(.horizontal, Spazio.normale)
        .padding(.vertical, Spazio.medio)
        .background(Palette.carta, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(Palette.bordo, lineWidth: 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.45).repeatForever()) { fase = 1 }
            Timer.scheduledTimer(withTimeInterval: 0.45, repeats: true) { _ in
                Task { @MainActor in fase = (fase + 1) % 3 }
            }
        }
        .accessibilityLabel("Nina sta scrivendo")
    }
}

// MARK: - Come funziona

private struct InfoAmica: View {
    let stato: StatoAmica?
    @Environment(\.dismiss) private var chiudi

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spazio.comodo) {
                    Text("Come funziona")
                        .font(Tipo.titolo)
                        .foregroundStyle(Palette.testo)

                    if let stato {
                        Card {
                            VStack(alignment: .leading, spacing: Spazio.piccolo) {
                                Text(stato.engine == "ai" ? "Risposte generate da un modello" : "Risposte scritte a mano")
                                    .font(Tipo.corpoForte)
                                    .foregroundStyle(Palette.testo)

                                Text(stato.engine == "ai"
                                     ? "Le risposte le genera un modello linguistico sul server. La chiave resta lì: l'app non la vede mai."
                                     : "Le risposte vengono da un motore conversazionale incluso nel server, che riconosce \(stato.topics) argomenti. Non costa niente e funziona sempre.")
                                    .font(Tipo.didascalia)
                                    .foregroundStyle(Palette.testoTenue)
                                    .lettura()

                                if stato.engine == "ai" && stato.dailyLimit > 0 {
                                    Text("Oggi: \(stato.usedToday) messaggi su \(stato.dailyLimit).")
                                        .font(.caption)
                                        .foregroundStyle(Palette.testoTenue)
                                        .padding(.top, 2)
                                }
                            }
                        }
                    }

                    Text("Cosa Nina non è")
                        .font(Tipo.sottotitolo)
                        .foregroundStyle(Palette.testo)

                    Text("Nina è un'app, non una persona, e non lo nasconde. Non dà pareri medici o psicologici e non sostituisce nessuno. Se stai attraversando un momento difficile, parlarne con qualcuno di preparato aiuta davvero — e non è una cosa grossa da fare.")
                        .font(Tipo.corpo)
                        .foregroundStyle(Palette.testoTenue)
                        .lettura()

                    Card {
                        VStack(alignment: .leading, spacing: Spazio.piccolo) {
                            Text("Se ti serve parlare con qualcuno adesso")
                                .font(Tipo.corpoForte)
                                .foregroundStyle(Palette.testo)

                            Text("Telefono Amico Italia — 02 2327 2327\nTelefono Azzurro — 19696\nEmergenze — 112")
                                .font(Tipo.didascalia)
                                .foregroundStyle(Palette.testoTenue)
                                .lettura()
                        }
                    }
                }
                .padding(Spazio.comodo)
            }
            .sfondoNina()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Chiudi") { chiudi() } }
            }
        }
    }
}
