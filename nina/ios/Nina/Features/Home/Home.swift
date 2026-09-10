// FILE: ios/Nina/Features/Home/Home.swift
//
// La Home deve rispondere a quattro domande, in quest'ordine:
//
//   1. Cosa devo fare oggi?
//   2. Cosa mi vuole dire Nina?
//   3. Come mi sento?
//   4. Cosa posso fare per me?
//
// L'ordine è deliberato. La prima cosa che si vede è la giornata, perché è il
// motivo per cui si apre l'app. Il resto viene dopo, e non chiede niente:
// nessun rosso, nessun contatore di cose non fatte, nessun rimprovero.

import SwiftUI
import SwiftData

struct Home: View {
    @Environment(Sessione.self) private var sessione
    @Environment(Deposito.self) private var deposito
    @Environment(MotoreSync.self) private var sync

    @Query(filter: #Predicate<Attivita> { $0.deletedAt == nil },
           sort: [SortDescriptor<Attivita>(\.ora), SortDescriptor<Attivita>(\.createdAt)])
    private var tutteLeAttivita: [Attivita]

    @Query(filter: #Predicate<Abitudine> { $0.deletedAt == nil },
           sort: [SortDescriptor<Abitudine>(\.ordine)])
    private var abitudini: [Abitudine]

    @State private var frase: Frase?
    @State private var oggi = CalendarioNina.oggi
    @State private var mostraNuovaAttivita = false
    @State private var mostraNotaVeloce = false
    @State private var saluto = ""

    private var attivitaDiOggi: [Attivita] {
        tutteLeAttivita.filter { $0.giorno == oggi }
    }

    private var completate: Int {
        attivitaDiOggi.filter(\.completata).count
    }

    private var umoreDiOggi: Umore? {
        deposito.umore(del: oggi)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.sezione) {
                intestazione
                riepilogoGiornata

                if let frase {
                    CardPensiero(
                        frase: frase,
                        onPreferito: { alternaPreferito() },
                        onAltraFrase: { Task { await caricaAltraFrase() } }
                    )
                }

                sezioneOggi

                if umoreDiOggi == nil {
                    invitoMood
                }

                if !abitudini.isEmpty {
                    strisciaAbitudini
                }

                invitoSelfCare
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { barraStrumenti }
        .refreshable { sync.sincronizza() }
        .task {
            saluto = VoceDiNina.buongiorno(nome: sessione.nome)
            await caricaFraseDelGiorno()
        }
        .onAppear {
            // Se l'app è rimasta aperta oltre la mezzanotte, "oggi" è cambiato.
            let adesso = CalendarioNina.oggi
            if adesso != oggi {
                oggi = adesso
                saluto = VoceDiNina.buongiorno(nome: sessione.nome)
                Task { await caricaFraseDelGiorno() }
            }
        }
        .sheet(isPresented: $mostraNuovaAttivita) {
            ModificaAttivita(giornoPredefinito: oggi)
        }
        .sheet(isPresented: $mostraNotaVeloce) {
            NuovaNotaVeloce()
        }
    }

    // MARK: - Intestazione

    private var intestazione: some View {
        VStack(alignment: .leading, spacing: Spazio.minimo) {
            Text(saluto)
                .font(Tipo.titolone)
                .foregroundStyle(Palette.testo)

            Text(CalendarioNina.testoLungo(oggi))
                .font(Tipo.didascalia)
                .foregroundStyle(Palette.testoTenue)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Spazio.piccolo)
    }

    @ToolbarContentBuilder
    private var barraStrumenti: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: Spazio.medio) {
                IndicatoreSync()

                Button {
                    mostraNotaVeloce = true
                } label: {
                    Image(systemName: "square.and.pencil")
                }
                .accessibilityLabel("Scrivi una nota veloce")
            }
        }
    }

    // MARK: - Riepilogo della giornata

    private var riepilogoGiornata: some View {
        Card {
            VStack(alignment: .leading, spacing: Spazio.medio) {
                HStack(alignment: .firstTextBaseline) {
                    Text(attivitaDiOggi.isEmpty ? "Oggi" : "\(completate) di \(attivitaDiOggi.count) completate")
                        .font(Tipo.sottotitolo)
                        .foregroundStyle(Palette.testo)

                    Spacer()

                    if !attivitaDiOggi.isEmpty {
                        Text("\(Int(percentuale * 100))%")
                            .font(Tipo.etichetta)
                            .foregroundStyle(Palette.rosa)
                            .contentTransition(.numericText())
                    }
                }

                if !attivitaDiOggi.isEmpty {
                    BarraProgresso(valore: percentuale)
                }

                Text(messaggioRiepilogo)
                    .font(Tipo.didascalia)
                    .foregroundStyle(Palette.testoTenue)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var percentuale: Double {
        guard !attivitaDiOggi.isEmpty else { return 0 }
        return Double(completate) / Double(attivitaDiOggi.count)
    }

    private var messaggioRiepilogo: String {
        if attivitaDiOggi.isEmpty { return VoceDiNina.nienteAttivitaOggi() }
        let rimaste = attivitaDiOggi.count - completate
        return rimaste == 0 ? VoceDiNina.tutteFatte() : VoceDiNina.rimaste(rimaste)
    }

    // MARK: - Le cose di oggi

    private var sezioneOggi: some View {
        VStack(alignment: .leading, spacing: Spazio.normale) {
            IntestazioneSezione(titolo: "Oggi") {
                Button {
                    mostraNuovaAttivita = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(Palette.rosa)
                }
                .accessibilityLabel("Aggiungi un'attività")
            }

            if attivitaDiOggi.isEmpty {
                Card {
                    StatoVuoto(
                        icona: "sun.max",
                        titolo: "Giornata libera",
                        messaggio: VoceDiNina.nienteAttivitaOggi(),
                        azione: (titolo: "Aggiungi una cosa", esegui: { mostraNuovaAttivita = true })
                    )
                }
            } else {
                VStack(spacing: Spazio.piccolo) {
                    ForEach(attivitaDiOggi) { attivita in
                        RigaAttivita(attivita: attivita)
                    }
                }
            }
        }
    }

    // MARK: - Mood

    private var invitoMood: some View {
        NavigationLink {
            SchermataMood()
        } label: {
            Card(sfondo: Palette.rosaTenue) {
                HStack(spacing: Spazio.normale) {
                    Text("💗").font(.system(size: 30))

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Come stai oggi?")
                            .font(Tipo.sottotitolo)
                            .foregroundStyle(Palette.testo)
                        Text("Un tocco e basta")
                            .font(Tipo.didascalia)
                            .foregroundStyle(Palette.testoTenue)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Palette.rosa)
                }
            }
        }
        .buttonStyle(PressioneMorbida())
    }

    // MARK: - Abitudini

    private var strisciaAbitudini: some View {
        VStack(alignment: .leading, spacing: Spazio.normale) {
            IntestazioneSezione(titolo: "Le mie abitudini") {
                NavigationLink {
                    SchermataAbitudini()
                } label: {
                    Text("Tutte")
                        .font(Tipo.etichetta)
                        .foregroundStyle(Palette.rosa)
                }
            }

            ScrollView(.horizontal) {
                HStack(spacing: Spazio.medio) {
                    ForEach(abitudini.prefix(8)) { abitudine in
                        PastiglaAbitudine(abitudine: abitudine, giorno: oggi)
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 4)
            }
            .scrollIndicators(.hidden)
        }
    }

    // MARK: - Self care

    private var invitoSelfCare: some View {
        NavigationLink {
            SchermataSelfCare()
        } label: {
            Card {
                HStack(spacing: Spazio.normale) {
                    ZStack {
                        Circle().fill(Palette.rosaTenue).frame(width: 46, height: 46)
                        Image(systemName: "leaf.fill").foregroundStyle(Palette.rosa)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Qualcosa per te")
                            .font(Tipo.sottotitolo)
                            .foregroundStyle(Palette.testo)
                        Text(VoceDiNina.inviteSelfCare())
                            .font(Tipo.didascalia)
                            .foregroundStyle(Palette.testoTenue)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Palette.testoTenue)
                }
            }
        }
        .buttonStyle(PressioneMorbida())
    }

    // MARK: - Frase del giorno

    private func caricaFraseDelGiorno() async {
        // Prima si mostra quella locale: la Home non deve mai aspettare la rete
        // per disegnarsi.
        if frase == nil { frase = deposito.fraseLocale(per: oggi) }

        do {
            let dto: FraseDTO = try await ClientAPI.condiviso.richiesta(
                .get, "quotes/daily", query: ["date": oggi]
            )
            frase = dto.frase
        } catch {
            // Nessuna rete: resta quella locale, che è già a schermo.
        }
    }

    private func caricaAltraFrase() async {
        do {
            let dto: FraseDTO = try await ClientAPI.condiviso.richiesta(.get, "quotes/random")
            withAnimation(.nina) { frase = dto.frase }
        } catch {
            if let locale = deposito.frasi().randomElement()?.frase {
                withAnimation(.nina) { frase = locale }
            }
        }
    }

    private func alternaPreferito() {
        guard let corrente = frase else { return }
        let nuovoStato = !corrente.preferita

        frase = Frase(
            id: corrente.id, testo: corrente.testo, autore: corrente.autore,
            fonte: corrente.fonte, preferita: nuovoStato
        )

        Task {
            _ = try? await ClientAPI.condiviso.richiestaSenzaRisposta(
                nuovoStato ? .post : .delete,
                "quotes/\(corrente.id.uuidString.lowercased())/favorite"
            )
        }
    }
}

// MARK: - Pastiglia di un'abitudine

struct PastiglaAbitudine: View {
    let abitudine: Abitudine
    let giorno: String

    @Environment(Deposito.self) private var deposito
    @State private var fatta = false

    var body: some View {
        Button {
            fatta = deposito.alterna(abitudine: abitudine, giorno: giorno)
        } label: {
            VStack(spacing: Spazio.piccolo) {
                ZStack {
                    Circle()
                        .fill(fatta ? coloreAbitudine.opacity(0.9) : coloreAbitudine.opacity(0.14))
                        .frame(width: 58, height: 58)

                    Text(abitudine.icona)
                        .font(.system(size: 24))
                        .grayscale(fatta ? 0 : 0.4)
                        .opacity(fatta ? 1 : 0.75)

                    if fatta {
                        Circle()
                            .strokeBorder(coloreAbitudine, lineWidth: 2)
                            .frame(width: 66, height: 66)
                    }
                }

                Text(abitudine.nome)
                    .font(.caption2)
                    .foregroundStyle(fatta ? Palette.testo : Palette.testoTenue)
                    .lineLimit(1)
                    .frame(maxWidth: 72)
            }
        }
        .buttonStyle(PressioneMorbida())
        .sensoryFeedback(.success, trigger: fatta) { _, nuovo in nuovo }
        .onAppear {
            let completamento = deposito.completamento(abitudine: abitudine.id, giorno: giorno)
            fatta = completamento?.fatta == true && completamento?.deletedAt == nil
        }
        .accessibilityLabel("\(abitudine.nome), \(fatta ? "fatta" : "da fare")")
        .accessibilityAddTraits(.isButton)
    }

    private var coloreAbitudine: Color {
        Color(hexString: abitudine.colore) ?? Palette.rosa
    }
}

// MARK: - Indicatore di sincronizzazione

/// Piccolo segnale nella barra: appare solo quando c'è qualcosa da dire.
struct IndicatoreSync: View {
    @Environment(MotoreSync.self) private var sync
    @Environment(Deposito.self) private var deposito

    var body: some View {
        Group {
            switch sync.stato {
            case .inCorso:
                ProgressView()
                    .controlSize(.small)
                    .tint(Palette.testoTenue)

            case .errore:
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundStyle(Palette.attenzione)

            case .ferma where deposito.modificheInAttesa > 0:
                Image(systemName: "icloud.and.arrow.up")
                    .foregroundStyle(Palette.testoTenue)

            default:
                EmptyView()
            }
        }
        .font(.footnote)
        .accessibilityLabel(descrizione)
    }

    private var descrizione: String {
        switch sync.stato {
        case .inCorso: "Sincronizzazione in corso"
        case .errore: "Sincronizzazione non riuscita"
        default:
            deposito.modificheInAttesa > 0
                ? "\(deposito.modificheInAttesa) modifiche in attesa di essere inviate"
                : "Tutto sincronizzato"
        }
    }
}
