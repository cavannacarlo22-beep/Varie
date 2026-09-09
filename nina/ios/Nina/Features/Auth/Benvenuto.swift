// FILE: ios/Nina/Features/Auth/Benvenuto.swift
//
// Accesso e registrazione.
//
// Un solo schermo con due modalità invece di due schermate separate: chi sbaglia
// e finisce nella registrazione avendo già un account cambia con un tocco,
// senza tornare indietro e senza riscrivere l'email.
//
// Dopo la registrazione arriva la domanda "come vuoi che ti chiami?", che è il
// momento in cui l'app smette di essere un modulo e diventa Nina.

import SwiftUI

struct Benvenuto: View {
    @Environment(Sessione.self) private var sessione

    private enum Modo { case accesso, registrazione }

    @State private var modo: Modo = .accesso
    @State private var nome = ""
    @State private var cognome = ""
    @State private var email = ""
    @State private var password = ""
    @State private var conferma = ""
    @State private var mostraPasswordDimenticata = false
    @State private var mostraNomePreferito = false

    var body: some View {
        ScrollView {
            VStack(spacing: Spazio.comodo) {
                intestazione

                Card {
                    VStack(spacing: Spazio.normale) {
                        selettoreModo

                        if modo == .registrazione {
                            HStack(spacing: Spazio.medio) {
                                CampoTesto(
                                    etichetta: "Nome", segnaposto: "Giulia",
                                    contenuto: .givenName, testo: $nome
                                )
                                CampoTesto(
                                    etichetta: "Cognome", segnaposto: "Bianchi",
                                    contenuto: .familyName, testo: $cognome
                                )
                            }
                        }

                        CampoTesto(
                            etichetta: "Email",
                            segnaposto: "tu@esempio.it",
                            icona: "envelope",
                            tastiera: .emailAddress,
                            contenuto: .emailAddress,
                            autocapitalizzazione: .never,
                            testo: $email
                        )

                        CampoPassword(
                            etichetta: "Password",
                            segnaposto: modo == .registrazione ? "Almeno 10 caratteri" : "",
                            nuova: modo == .registrazione,
                            testo: $password
                        )

                        if modo == .registrazione {
                            CampoPassword(etichetta: "Ripeti la password", nuova: true, testo: $conferma)

                            Text("Una frase che ricordi facilmente va benissimo — è più sicura di una password corta piena di simboli.")
                                .font(.caption)
                                .foregroundStyle(Palette.testoTenue)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        if let errore = sessione.messaggioErrore {
                            AvvisoErrore(messaggio: errore)
                        }

                        BottoneRosa(
                            titolo: modo == .accesso ? "Entra" : "Crea il mio account",
                            inCorso: sessione.inCorso,
                            disabilitato: !puoProcedere
                        ) {
                            Task { await procedi() }
                        }

                        if modo == .accesso {
                            Button("Ho dimenticato la password") {
                                mostraPasswordDimenticata = true
                            }
                            .font(Tipo.didascalia)
                            .foregroundStyle(Palette.rosa)
                        }
                    }
                }

                Text("I tuoi dati restano tuoi. Il diario non lo legge nessuno, nemmeno chi gestisce l'app.")
                    .font(.caption)
                    .foregroundStyle(Palette.testoTenue)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spazio.comodo)
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .sfondoNina()
        .sheet(isPresented: $mostraPasswordDimenticata) {
            PasswordDimenticata(emailIniziale: email)
        }
        .sheet(isPresented: $mostraNomePreferito) {
            ComeTiChiamo()
        }
        .onChange(of: sessione.stato) { _, nuovo in
            // Appena registrata, si chiede il nome preferito.
            if case .dentro = nuovo, modo == .registrazione {
                mostraNomePreferito = true
            }
        }
    }

    // MARK: - Parti

    private var intestazione: some View {
        VStack(spacing: Spazio.piccolo) {
            Text("Nina")
                .font(.system(size: 46, weight: .bold, design: .rounded))
                .foregroundStyle(Palette.rosa)

            Text("La tua piccola migliore amica 💗")
                .font(Tipo.didascalia)
                .foregroundStyle(Palette.testoTenue)
        }
        .padding(.top, Spazio.ampio)
        .padding(.bottom, Spazio.piccolo)
    }

    private var selettoreModo: some View {
        Picker("", selection: $modo.animation(.ninaVeloce)) {
            Text("Accedi").tag(Modo.accesso)
            Text("Registrati").tag(Modo.registrazione)
        }
        .pickerStyle(.segmented)
    }

    private var puoProcedere: Bool {
        guard email.contains("@"), password.count >= 6 else { return false }
        if modo == .registrazione {
            return !nome.trimmingCharacters(in: .whitespaces).isEmpty
                && !cognome.trimmingCharacters(in: .whitespaces).isEmpty
                && password == conferma
                && password.count >= 10
        }
        return true
    }

    private func procedi() async {
        switch modo {
        case .accesso:
            await sessione.accedi(email: email, password: password)
        case .registrazione:
            await sessione.registrati(nome: nome, cognome: cognome, email: email, password: password)
        }
    }
}

// MARK: - "Come vuoi che ti chiami?"

struct ComeTiChiamo: View {
    @Environment(Sessione.self) private var sessione
    @Environment(\.dismiss) private var chiudi

    @State private var nomeScelto = ""
    @FocusState private var inFocus: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Spazio.comodo) {
                Text("Come vuoi che ti chiami? 💗")
                    .font(Tipo.titolone)
                    .foregroundStyle(Palette.testo)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Il nome, un soprannome, quello che ti chiamano le tue amiche. Userò questo ogni volta che ti parlo.")
                    .font(Tipo.corpo)
                    .foregroundStyle(Palette.testoTenue)
                    .lettura()

                CampoTesto(
                    etichetta: "Chiamami",
                    segnaposto: sessione.utente?.firstName ?? "Giulia",
                    icona: "heart",
                    testo: $nomeScelto
                )
                .focused($inFocus)

                if !nomeScelto.trimmingCharacters(in: .whitespaces).isEmpty {
                    Card(sfondo: Palette.rosaTenue) {
                        Text("Perfetto, \(nomeScelto.trimmingCharacters(in: .whitespaces)). Iniziamo? 💗")
                            .font(Tipo.corpo)
                            .foregroundStyle(Palette.testo)
                    }
                    .transition(.opacity)
                }

                Spacer()

                BottoneRosa(titolo: "Iniziamo") {
                    Task {
                        let scelto = nomeScelto.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !scelto.isEmpty {
                            await sessione.aggiornaNomeVisualizzato(scelto)
                        }
                        chiudi()
                    }
                }
            }
            .padding(Spazio.comodo)
            .sfondoNina()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Dopo") { chiudi() }
                        .foregroundStyle(Palette.testoTenue)
                }
            }
            .onAppear {
                nomeScelto = sessione.utente?.firstName ?? ""
                inFocus = true
            }
            .animation(.ninaVeloce, value: nomeScelto.isEmpty)
        }
        .interactiveDismissDisabled()
    }
}

// MARK: - Password dimenticata

struct PasswordDimenticata: View {
    var emailIniziale: String = ""

    @Environment(Sessione.self) private var sessione
    @Environment(\.dismiss) private var chiudi

    @State private var email = ""
    @State private var inviata = false
    @State private var inCorso = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Spazio.comodo) {
                if inviata {
                    VStack(alignment: .leading, spacing: Spazio.normale) {
                        Text("Fatto 💌")
                            .font(Tipo.titolone)
                            .foregroundStyle(Palette.testo)

                        Text("Se esiste un account con questa email, fra poco arriva un messaggio con il link per reimpostare la password. Controlla anche lo spam.")
                            .font(Tipo.corpo)
                            .foregroundStyle(Palette.testoTenue)
                            .lettura()
                    }
                } else {
                    Text("Capita a tutte")
                        .font(Tipo.titolone)
                        .foregroundStyle(Palette.testo)

                    Text("Scrivi la tua email e ti mando il link per sceglierne una nuova.")
                        .font(Tipo.corpo)
                        .foregroundStyle(Palette.testoTenue)
                        .lettura()

                    CampoTesto(
                        etichetta: "Email",
                        segnaposto: "tu@esempio.it",
                        icona: "envelope",
                        tastiera: .emailAddress,
                        contenuto: .emailAddress,
                        autocapitalizzazione: .never,
                        testo: $email
                    )
                }

                Spacer()

                BottoneRosa(
                    titolo: inviata ? "Chiudi" : "Mandami il link",
                    inCorso: inCorso,
                    disabilitato: !inviata && !email.contains("@")
                ) {
                    if inviata {
                        chiudi()
                        return
                    }
                    Task {
                        inCorso = true
                        let esito = await sessione.passwordDimenticata(email: email)
                        inCorso = false
                        // La risposta è la stessa in ogni caso: l'endpoint non
                        // rivela se l'email è registrata.
                        if esito { withAnimation(.nina) { inviata = true } }
                    }
                }
            }
            .padding(Spazio.comodo)
            .sfondoNina()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { chiudi() } }
            }
            .onAppear { email = emailIniziale }
        }
        .presentationDetents([.medium])
    }
}
