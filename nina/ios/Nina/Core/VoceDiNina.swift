// FILE: ios/Nina/Core/VoceDiNina.swift
//
// I messaggi dell'app.
//
// Questa è la differenza fra un'app che si usa e un'app che si apre volentieri.
// "Attività completata" e "Fatta! Una cosa in meno 😌" costano lo stesso da
// scrivere; la seconda però fa sorridere, e chi sorride torna domani.
//
// Regole che tengono insieme il tono:
//   · si dà del tu, sempre;
//   · non si dice mai "utente", "elemento", "operazione";
//   · l'ironia serve ad alleggerire, mai a commentare un momento difficile;
//   · nessun messaggio è mai colpevolizzante. Le cose non fatte non sono colpe;
//   · ogni categoria ha molte varianti, e non si ripete quella appena usata.
//
// Il file è lungo di proposito: è il copione dell'app.

import Foundation

enum VoceDiNina {

    // MARK: - Selezione

    /// Ricorda l'ultima frase mostrata per ogni categoria, per non ripeterla
    /// due volte di fila.
    ///
    /// È una classe con un lucchetto invece di una semplice `static var`
    /// perché queste frasi non servono solo alle schermate: le usa anche il
    /// pianificatore delle notifiche e le usano gli App Intent di Siri, che
    /// non girano sul main actor. Uno stato statico mutabile senza protezione
    /// sarebbe una corsa critica vera, non un cavillo del compilatore.
    private final class Memoria: @unchecked Sendable {
        private let lucchetto = NSLock()
        private var ultime: [String: String] = [:]

        func scegli(_ categoria: String, da elenco: [String]) -> String {
            guard elenco.count > 1 else { return elenco.first ?? "" }

            lucchetto.lock()
            defer { lucchetto.unlock() }

            let disponibili = elenco.filter { $0 != ultime[categoria] }
            let scelta = disponibili.randomElement() ?? elenco[0]
            ultime[categoria] = scelta
            return scelta
        }

        /// Serve ai test, per partire da una situazione nota.
        func dimentica() {
            lucchetto.lock()
            defer { lucchetto.unlock() }
            ultime.removeAll()
        }
    }

    private static let memoria = Memoria()

    private static func scegli(_ categoria: String, da elenco: [String]) -> String {
        memoria.scegli(categoria, da: elenco)
    }

    /// Azzera la memoria delle ultime frasi. Usato solo dai test.
    static func dimenticaLeUltimeFrasi() {
        memoria.dimentica()
    }

    // MARK: - Buongiorno

    static func buongiorno(nome: String, ora: Int = Calendar.current.component(.hour, from: Date())) -> String {
        switch ora {
        case 5..<11:
            scegli("mattina", da: [
                "Buongiorno, \(nome) 🌸",
                "Ciao \(nome)! Si parte 🌤️",
                "Buongiorno 💗 Come si comincia oggi?",
                "Eccoti. Buongiorno, \(nome)",
                "Nuovo giorno, \(nome) ☀️",
            ])
        case 11..<14:
            scegli("mezzogiorno", da: [
                "Ciao \(nome)!",
                "Buon pomeriggio, \(nome) 🌼",
                "Come sta andando, \(nome)?",
                "Ehi \(nome) 💗",
            ])
        case 14..<19:
            scegli("pomeriggio", da: [
                "Ciao \(nome) 🌷",
                "Buon pomeriggio!",
                "Ehi \(nome), come va?",
                "Bentornata, \(nome)",
            ])
        case 19..<23:
            scegli("sera", da: [
                "Buonasera, \(nome) 🌙",
                "Ciao \(nome), com'è andata?",
                "Sera, \(nome) ✨",
                "Eccoti. Serata tranquilla?",
            ])
        default:
            scegli("notte", da: [
                "Ancora sveglia, \(nome)? 🌙",
                "Ciao \(nome). È tardi, eh?",
                "Notte fonda, \(nome) ✨",
            ])
        }
    }

    // MARK: - Attività completata

    static func attivitaFatta() -> String {
        scegli("fatta", da: [
            "Fatta! Una cosa in meno 😌",
            "Brava! Questa era importante.",
            "Ecco, così 💗",
            "Una in meno. Continua così.",
            "Bene! Tolta di mezzo 😄",
            "Perfetto. Avanti la prossima.",
            "Fatto ✨",
            "Questa se n'è andata 😌",
            "Bravissima.",
            "E anche questa è sistemata.",
        ])
    }

    static func tutteFatte() -> String {
        scegli("tutteFatte", da: [
            "CE L'ABBIAMO FATTA! 🎉",
            "Tutto fatto. Direi che puoi rilassarti 😌",
            "Lista vuota. Che bella sensazione 💗",
            "Non è rimasto niente. Brava davvero.",
            "Finito tutto! Adesso pausa vera.",
            "Zero cose in sospeso. Goditela 🎉",
        ])
    }

    static func rimaste(_ quante: Int) -> String {
        switch quante {
        case 1:
            scegli("rimaste1", da: [
                "Ne manca una sola 💪",
                "Ancora una cosina e abbiamo finito.",
                "Manca l'ultima!",
            ])
        case 2...3:
            scegli("rimastePoche", da: [
                "Abbiamo ancora \(quante) cosine da sistemare 👀",
                "Ne restano \(quante). Ce la facciamo.",
                "\(quante) cose e poi basta 💗",
            ])
        default:
            scegli("rimasteTante", da: [
                "Ci sono \(quante) cose oggi. Una alla volta 😌",
                "\(quante) da fare. Non tutte adesso, eh.",
                "Oggi la lista è lunga. Partiamo dalla prima.",
            ])
        }
    }

    // MARK: - Attività scaduta

    static func attivitaScaduta() -> String {
        scegli("scaduta", da: [
            "Ops 😅 questa ci è scappata.",
            "Questa è rimasta indietro. Capita.",
            "Ci è sfuggita. La spostiamo?",
            "Rimasta lì. Vuoi rimandarla a domani?",
            "Questa è scappata via 😌",
        ])
    }

    // MARK: - Streak delle abitudini

    static func streak(_ giorni: Int) -> String {
        switch giorni {
        case 0:
            scegli("streak0", da: [
                "Si comincia oggi 💗",
                "Primo giorno. Da qualche parte si parte.",
            ])
        case 1:
            "Primo giorno fatto 🔥"
        case 2...6:
            scegli("streakPochi", da: [
                "\(giorni) giorni di fila 🔥",
                "\(giorni) giorni! Sta diventando un'abitudine.",
            ])
        case 7...20:
            scegli("streakMedi", da: [
                "\(giorni) giorni consecutivi 🔥 Che costanza",
                "\(giorni) giorni. Ormai è tua.",
            ])
        default:
            scegli("streakTanti", da: [
                "\(giorni) giorni 🔥🔥 Sei una macchina",
                "\(giorni) giorni di fila. Rispetto.",
            ])
        }
    }

    static func streakInterrotto() -> String {
        scegli("streakRotto", da: [
            "Tranquilla. Non hai perso tutto. Si riparte oggi 💗",
            "Un giorno saltato non cancella quelli prima.",
            "Va bene. Ricominciamo da qui, senza drammi.",
            "Capita a tutte. Oggi è un buon giorno per riprendere.",
        ])
    }

    // MARK: - Mood

    static func moodPositivo() -> String {
        scegli("moodBuono", da: [
            "Che bello leggerlo 💗",
            "Mi fa piacere davvero.",
            "Ottimo! Segnatelo, questo giorno.",
            "Evvai 😄",
            "Bene così ✨",
        ])
    }

    static func moodDifficile() -> String {
        scegli("moodBrutto", da: [
            "Va bene anche così. Non devi stare bene per forza 💗",
            "Grazie di avermelo detto. Ci sono.",
            "Giornate così capitano. Passa.",
            "Mi dispiace. Sii gentile con te oggi.",
            "Ok. Oggi facciamo il minimo, va benissimo.",
        ])
    }

    // MARK: - Sera

    static func riepilogoSera(completate: Int, rimaste: Int) -> String {
        if completate == 0 && rimaste == 0 {
            return scegli("seraVuota", da: [
                "Giornata senza programmi. Ci sta 😌",
                "Oggi niente lista. Va bene anche così.",
            ])
        }

        if rimaste == 0 {
            return scegli("seraTutto", da: [
                "Direi che oggi abbiamo dato abbastanza. Ora relax 😌",
                "Tutto fatto. Te lo sei meritato il divano.",
                "Giornata piena e chiusa bene 💗",
            ])
        }

        if completate == 0 {
            return scegli("seraNiente", da: [
                "Oggi non è andata come volevamo. Pazienza, domani ci riproviamo ❤️",
                "Giornata storta? Capita. Domani è un altro giro.",
                "Va bene. Non tutti i giorni sono produttivi, e non devono esserlo.",
            ])
        }

        return scegli("seraMista", da: [
            "\(completate) fatte, \(rimaste) rimaste. Direi che va bene così 😌",
            "Ne hai fatte \(completate). Il resto aspetta domani.",
            "Buon lavoro oggi. Le \(rimaste) rimaste non scappano.",
        ])
    }

    // MARK: - Self care

    static func inviteSelfCare() -> String {
        scegli("selfCare", da: [
            "Ti sei presa cinque minuti oggi?",
            "Quando è stata l'ultima volta che hai fatto qualcosa solo per te?",
            "Piccola pausa? Te la meriti 💗",
            "Respira. Non devi fare tutto contemporaneamente 😂",
            "Anche solo un bicchiere d'acqua conta.",
        ])
    }

    // MARK: - Motivazione generica

    static func incoraggiamento() -> String {
        scegli("incoraggiamento", da: [
            "Ok bestie, una cosa alla volta.",
            "Non devi fare tutto oggi.",
            "Piano piano si arriva lo stesso.",
            "Sei più avanti di quanto pensi.",
            "Anche i piccoli passi sono passi 💗",
            "Fatto è meglio di perfetto.",
        ])
    }

    // MARK: - Stati vuoti

    static func nienteAttivitaOggi() -> String {
        scegli("vuotoAttivita", da: [
            "Oggi è libero! Aggiungi qualcosa se ti va 💗",
            "Nessun programma. Che lusso 😌",
            "Giornata vuota. La riempiamo o la lasciamo così?",
        ])
    }

    static func nienteAbitudini() -> String {
        "Le abitudini si costruiscono una alla volta. Ne aggiungiamo una?"
    }

    static func nienteDiario() -> String {
        "Il diario è tuo e solo tuo. Nessuno lo legge, nemmeno io."
    }

    static func nienteWishlist() -> String {
        "Cosa ti piacerebbe avere? Anche solo per guardarlo ✨"
    }

    static func nienteNote() -> String {
        "Le cose da ricordare finiscono qui, prima di dimenticarle."
    }

    // MARK: - Errori

    static func erroreGentile() -> String {
        scegli("errore", da: [
            "Qualcosa è andato storto 😅 Riproviamo tra un secondo.",
            "Ops. Non ha funzionato. Riprova?",
            "Mmh, non è andata. Ci riproviamo?",
        ])
    }

    static func offline() -> String {
        scegli("offline", da: [
            "Non c'è rete, ma tranquilla: salvo tutto qui e sincronizzo dopo 💗",
            "Sei offline. Continua pure, penso io a mandare tutto quando torna la linea.",
        ])
    }
}
