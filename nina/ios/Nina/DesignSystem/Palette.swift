// FILE: ios/Nina/DesignSystem/Palette.swift
//
// I colori di Nina.
//
// Sono definiti in codice e non in un catalogo di asset per una ragione
// pratica: qui si vedono i valori uno accanto all'altro, si capisce il
// rapporto fra chiaro e scuro, e si possono commentare. In un catalogo
// sarebbero dodici file JSON illeggibili.
//
// La palette di partenza è quella richiesta. In scuro non è stata "invertita":
// il rosa è stato schiarito e desaturato quel tanto che serve a restare
// riconoscibile su fondo nero senza vibrare, e il fondo non è nero puro ma un
// bruno rosato molto scuro — il nero puro accanto al rosa lo fa sembrare fluo.

import SwiftUI

enum Palette {

    // MARK: - Costruzione

    /// Colore che cambia con il tema del dispositivo.
    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }

    // MARK: - Rosa

    /// Il rosa dell'app. Bottoni, elementi attivi, accento.
    static let rosa = adaptive(light: 0xE96A95, dark: 0xFF9DBB)

    /// Rosa pieno per le superfici grandi (card in evidenza, gradienti).
    static let rosaChiaro = adaptive(light: 0xF48FB1, dark: 0xE87FA3)

    /// Sfondo tenue rosato: badge, riempimenti, stati selezionati.
    static let rosaTenue = adaptive(light: 0xFCE4EC, dark: 0x3A2A31)

    // MARK: - Superfici

    /// Fondo dell'app.
    static let sfondo = adaptive(light: 0xFFF9FB, dark: 0x171114)

    /// Card e fogli, sopra il fondo.
    static let carta = adaptive(light: 0xFFFFFF, dark: 0x221A1E)

    /// Card annidate dentro altre card.
    static let cartaAlta = adaptive(light: 0xFFF4F8, dark: 0x2B2126)

    /// Bordi e separatori: quasi invisibili, ma tengono insieme il layout.
    static let bordo = adaptive(light: 0xF3D9E2, dark: 0x372931)

    // MARK: - Testo

    static let testo = adaptive(light: 0x30252A, dark: 0xF6EAEF)

    /// Testo secondario: date, didascalie, note.
    static let testoTenue = adaptive(light: 0xB88A9A, dark: 0xB08D9B)

    /// Testo su fondo rosa pieno.
    ///
    /// Non è bianco e basta, ed è il motivo per cui questa riga ha un commento
    /// lungo. In modalità scura il rosa si schiarisce — deve, altrimenti su
    /// fondo quasi nero sparirebbe — e il bianco sopra un rosa chiaro arriva a
    /// 2,6:1 di contrasto: sotto il minimo perfino per il testo grande. La
    /// scritta «Avanti» c'era, ma si leggeva male.
    ///
    /// Quindi il colore si gira: bianco sul rosa profondo del tema chiaro,
    /// prugna scura sul rosa acceso di quello scuro. È la stessa scelta che fa
    /// iOS con i suoi bottoni colorati, e porta il contrasto a 6,3:1.
    static let testoSuRosa = adaptive(light: 0xFFFFFF, dark: 0x2E1D24)

    // MARK: - Semantici
    //
    // Non sono decorazioni: sono gli unici colori che comunicano uno stato, e
    // sono sempre accompagnati da un'icona o da una parola, mai da soli — chi
    // non distingue i colori deve capire lo stesso.

    static let successo = adaptive(light: 0x3E9C6D, dark: 0x6FD1A0)
    static let attenzione = adaptive(light: 0xC97A2B, dark: 0xF0B265)
    static let errore = adaptive(light: 0xC94F5E, dark: 0xFF8D9B)

    // MARK: - Priorità delle attività

    static func priorita(_ priorita: TaskPriority) -> Color {
        switch priorita {
        case .low: testoTenue
        case .medium: rosa
        case .high: adaptive(light: 0xD94F73, dark: 0xFF7FA3)
        }
    }

    // MARK: - Mood
    //
    // Ogni mood ha il suo colore, ma tutti restano nella famiglia calda della
    // palette: la schermata dei mood non deve sembrare un semaforo.

    static func mood(_ mood: MoodKind) -> Color {
        switch mood {
        case .fantastica: adaptive(light: 0xE8478B, dark: 0xFF8FC0)
        case .bene: adaptive(light: 0xF48FB1, dark: 0xFFA9C4)
        case .cosiCosi: adaptive(light: 0xD9A88A, dark: 0xE8BFA3)
        case .stanca: adaptive(light: 0xA890B8, dark: 0xC4AFD1)
        case .giu: adaptive(light: 0x7E8FB5, dark: 0x9DAECF)
        case .nervosa: adaptive(light: 0xC96A5A, dark: 0xE59182)
        }
    }

    // MARK: - Categorie delle attività

    static func categoria(_ categoria: TaskCategory) -> Color {
        switch categoria {
        case .lavoro: adaptive(light: 0x8E7CC3, dark: 0xB4A4E8)
        case .casa: adaptive(light: 0xC98A6B, dark: 0xE3AC90)
        case .personale: rosa
        case .sport: adaptive(light: 0x5FA894, dark: 0x86D3BC)
        case .studio: adaptive(light: 0x6E8FC9, dark: 0x9DB6E8)
        case .shopping: adaptive(light: 0xD97BA8, dark: 0xF0A0C6)
        case .social: adaptive(light: 0xD9A03F, dark: 0xEEC172)
        case .altro: testoTenue
        }
    }

    // MARK: - Gradienti

    /// Gradiente d'accento per le superfici grandi.
    /// Il gradiente delle superfici piene: bottoni, spunte, giorni selezionati.
    ///
    /// Nel tema chiaro il rosa è un filo più profondo di `rosaChiaro`/`rosa`:
    /// sul rosa originale il bianco stava a 2,2:1, e nemmeno le lettere grandi
    /// reggevano. Affiancando i due si nota; guardando l'app, no.
    ///
    /// Nel tema scuro succede l'opposto — la superficie resta accesa, perché
    /// sopra ci va la prugna scura di `testoSuRosa`.
    static var gradienteRosa: LinearGradient {
        LinearGradient(
            colors: [
                adaptive(light: 0xEF89A9, dark: 0xE87FA3),
                adaptive(light: 0xD9527F, dark: 0xFF9DBB),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// Velatura appena percettibile sul fondo, per non avere schermate piatte.
    static var gradienteSfondo: LinearGradient {
        LinearGradient(
            colors: [sfondo, rosaTenue.opacity(0.45), sfondo],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Colori da esadecimale

extension UIColor {
    /// Costruisce un colore da 0xRRGGBB.
    fileprivate convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    /// Per i colori scelti dall'utente (le abitudini), salvati come "#RRGGBB".
    init?(hexString: String) {
        var cleaned = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.hasPrefix("#") { cleaned.removeFirst() }
        guard cleaned.count == 6, let value = UInt32(cleaned, radix: 16) else { return nil }
        self.init(uiColor: UIColor(hex: value))
    }

    /// Rappresentazione "#RRGGBB", per rimandare il colore al backend.
    var hexString: String {
        let components = UIColor(self).cgColor.components ?? [0, 0, 0]
        let red = Int((components.count > 0 ? components[0] : 0) * 255)
        let green = Int((components.count > 1 ? components[1] : 0) * 255)
        let blue = Int((components.count > 2 ? components[2] : 0) * 255)
        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}
