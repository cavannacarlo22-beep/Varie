// FILE: ios/Nina/Core/Serie.swift
//
// Il conteggio dei giorni consecutivi di un'abitudine.
//
// Sta in un file suo, fuori dalle viste, per una ragione precisa: è l'unico
// numero dell'app che, se sbagliato, fa arrabbiare. Dire a qualcuno che ha
// perso una serie di quaranta giorni quando non è vero è il modo più veloce
// per far disinstallare un'app. Una funzione pura si può provare con dieci
// casi in un secondo; la stessa logica dentro una `View` no.

import Foundation

enum Serie {

    /// Giorni consecutivi fino a oggi, guardando all'indietro.
    ///
    /// La giornata in corso non spezza la serie se non è ancora spuntata: alle
    /// nove del mattino non ha senso dire a qualcuno che ha perso lo streak,
    /// ha ancora tutto il giorno per farla. Se invece oggi è già spuntata,
    /// conta anche oggi.
    static func giorniConsecutivi(fatti: Set<String>, oggi: String) -> Int {
        var conteggio = 0
        var giorno = fatti.contains(oggi) ? oggi : CalendarioNina.giorno(spostatoDi: -1, da: oggi)

        // Il tetto a dieci anni non è una regola di prodotto: è una cintura di
        // sicurezza contro un ciclo infinito se un giorno la conversione delle
        // date restituisse sempre la stessa stringa.
        while fatti.contains(giorno) && conteggio < 3650 {
            conteggio += 1
            giorno = CalendarioNina.giorno(spostatoDi: -1, da: giorno)
        }
        return conteggio
    }

    /// La serie più lunga mai raggiunta, per la schermata dei progressi.
    static func serieMassima(fatti: Set<String>) -> Int {
        guard !fatti.isEmpty else { return 0 }

        var massimo = 0
        for giorno in fatti {
            // Si conta solo dall'inizio di ogni sequenza: se il giorno prima
            // c'è, questo non è un inizio e sarebbe conteggiato due volte.
            let precedente = CalendarioNina.giorno(spostatoDi: -1, da: giorno)
            if fatti.contains(precedente) { continue }

            var lunghezza = 0
            var corrente = giorno
            while fatti.contains(corrente) && lunghezza < 3650 {
                lunghezza += 1
                corrente = CalendarioNina.giorno(spostatoDi: 1, da: corrente)
            }
            massimo = max(massimo, lunghezza)
        }
        return massimo
    }
}
