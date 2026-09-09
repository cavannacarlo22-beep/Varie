// FILE: ios/Nina/App/NinaApp.swift

import SwiftUI
import SwiftData

@main
struct NinaApp: App {

    @State private var deposito: Deposito
    @State private var sync: MotoreSync
    @State private var sessione: Sessione

    @Environment(\.scenePhase) private var faseScena

    init() {
        // I test di interfaccia partono con `-ninaAzzera` e trovano l'app come
        // appena installata. Fuori dai test l'argomento non c'è e questa riga
        // non fa niente.
        if ProcessInfo.processInfo.arguments.contains("-ninaAzzera") {
            Sessione.azzeraStatoPerTest()
        }

        let deposito = Deposito()
        let sync = MotoreSync(deposito: deposito)
        let sessione = Sessione(deposito: deposito, sync: sync)

        // Ogni scrittura locale sveglia la sincronizzazione, accorpando le
        // chiamate ravvicinate: spuntare cinque attività di fila fa partire
        // una sola richiesta, non cinque.
        deposito.alCambiamento = { [weak sync] in
            sync?.sincronizzaFraPoco()
        }

        _deposito = State(initialValue: deposito)
        _sync = State(initialValue: sync)
        _sessione = State(initialValue: sessione)
    }

    var body: some Scene {
        WindowGroup {
            RadiceView()
                .environment(sessione)
                .environment(deposito)
                .environment(sync)
                .modelContainer(deposito.contenitore)
                .tint(Palette.rosa)
                .preferredColorScheme(schemaColore)
                .onOpenURL { url in apri(url) }
        }
        .onChange(of: faseScena) { _, nuova in
            switch nuova {
            case .active:
                // Tornando in primo piano si riallinea subito: gli eventi in
                // tempo reale non arrivano mentre l'app è sospesa.
                sync.sincronizza()
                sync.avviaFlusso()
                Task { await PianificatoreNotifiche.condiviso.riprogramma(deposito: deposito) }

            case .background:
                sync.fermaFlusso()
                // Andando in background si riscrive la fotografia per i widget
                // e si chiede un ultimo giro di sincronizzazione: è il momento
                // in cui iOS concede ancora qualche secondo di lavoro.
                aggiornaWidget()
                sync.sincronizza()

            default:
                break
            }
        }
    }

    /// Gestisce gli indirizzi `nina://` aperti dai widget.
    ///
    /// Per ora tutti portano dentro l'app, che si apre sulla Home: è già la
    /// schermata giusta per "oggi" e per il pensiero del giorno. Lo schema
    /// esiste perché aggiungere una destinazione in futuro non richieda di
    /// ripubblicare i widget.
    private func apri(_ url: URL) {
        guard url.scheme == "nina" else { return }
        sync.sincronizza()
    }

    private func aggiornaWidget() {
        DatiCondivisi.aggiorna(
            deposito: deposito,
            nome: sessione.nome,
            frase: deposito.fraseLocale()
        )
    }

    /// Il tema segue le impostazioni salvate, che a loro volta si sincronizzano
    /// fra i dispositivi: scegliere "scuro" sull'iPhone lo imposta anche sull'iPad.
    private var schemaColore: ColorScheme? {
        switch deposito.impostazioni.tema {
        case .light: .light
        case .dark: .dark
        case .system: nil
        }
    }
}
