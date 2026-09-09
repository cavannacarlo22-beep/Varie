// FILE: ios/NinaWidgets/NinaWidgets.swift
//
// I widget di Nina.
//
// Il widget gira in un processo separato e **non** apre il database dell'app:
// aprire lo stesso store SwiftData da due processi è il modo più rapido per
// corromperlo. Legge invece la fotografia che l'app scrive nell'App Group
// (vedi Core/DatiCondivisi.swift).
//
// Tre cose che WidgetKit impone e che è facile sbagliare:
//
//  · `placeholder` deve tornare **subito**, senza leggere niente da disco;
//  · `snapshot` è quello che si vede nella galleria dei widget: deve mostrare
//    dati realistici, mai uno stato vuoto o "caricamento";
//  · ogni widget deve dichiarare `.containerBackground(for: .widget)`, o resta
//    bianco nella galleria e il sistema non può sostituire il fondo nelle
//    modalità colorate.

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Identificativi condivisi

/// I `kind` stanno qui in modo che app ed estensione non possano divergere:
/// una stringa sbagliata in `reloadTimelines(ofKind:)` non dà nessun errore,
/// semplicemente non aggiorna niente.
enum TipiWidget {
    static let giornata = "it.nina.widget.giornata"
    static let cose = "it.nina.widget.cose"
    static let pensiero = "it.nina.widget.pensiero"
}

// MARK: - Voce della timeline

struct VoceNina: TimelineEntry {
    let date: Date
    let fotografia: FotografiaGiornata

    /// Dati d'esempio: servono al `placeholder` e alla galleria, dove mostrare
    /// una lista vuota farebbe sembrare il widget rotto.
    static var esempio: VoceNina {
        VoceNina(
            date: .now,
            fotografia: FotografiaGiornata(
                giorno: "2026-09-09",
                nome: "Giulia",
                voci: [
                    .init(id: UUID(), titolo: "Colazione", ora: "09:00", completata: true, categoria: "PERSONALE"),
                    .init(id: UUID(), titolo: "Palestra", ora: "10:30", completata: false, categoria: "SPORT"),
                    .init(id: UUID(), titolo: "Chiamare mamma", ora: "15:30", completata: false, categoria: "SOCIAL"),
                    .init(id: UUID(), titolo: "Spesa", ora: nil, completata: false, categoria: "CASA"),
                ],
                completate: 1,
                totali: 4,
                fraseTesto: "Non devi fare tutto oggi. Devi solo fare qualcosa.",
                fraseAutore: nil,
                aggiornataIl: .now
            )
        )
    }
}

// MARK: - Provider

struct ProviderNina: TimelineProvider {

    func placeholder(in context: Context) -> VoceNina {
        // Deve essere sincrono: niente lettura da disco qui.
        VoceNina.esempio
    }

    func getSnapshot(in context: Context, completion: @escaping (VoceNina) -> Void) {
        // Nella galleria si mostra l'esempio; sullo schermo i dati veri.
        if context.isPreview {
            completion(.esempio)
        } else {
            completion(VoceNina(date: .now, fotografia: DatiCondivisi.leggi()))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<VoceNina>) -> Void) {
        let voce = VoceNina(date: .now, fotografia: DatiCondivisi.leggi())

        // Il contenuto cambia quando l'utente tocca qualcosa nell'app (che
        // chiama `reloadAllTimelines`), non con il passare del tempo. L'unico
        // momento in cui *deve* cambiare da solo è la mezzanotte, quando
        // "oggi" diventa un altro giorno.
        let domani = Calendar.current.startOfDay(for: .now.addingTimeInterval(86_400))

        completion(Timeline(entries: [voce], policy: .after(domani)))
    }
}

// MARK: - Il fondo del contenitore

private struct FondoNina: ViewModifier {
    @Environment(\.widgetFamily) private var famiglia

    private var suSchermataDiBlocco: Bool {
        famiglia == .accessoryCircular
            || famiglia == .accessoryRectangular
            || famiglia == .accessoryInline
    }

    func body(content: Content) -> some View {
        content.containerBackground(for: .widget) {
            if suSchermataDiBlocco {
                EmptyView()
            } else {
                Palette.sfondo
            }
        }
    }
}

extension View {
    /// Applica `containerBackground`, che WidgetKit pretende su ogni widget:
    /// senza, il widget è bianco nella galleria e il sistema non può
    /// sostituire il fondo nelle modalità colorate.
    ///
    /// Sul lock screen però il fondo deve restare **vuoto**, altrimenti copre
    /// lo sfondo scelto dalla persona e il widget sembra una toppa incollata
    /// sopra la foto. Ometterlo del tutto non è la soluzione: in quel caso il
    /// sistema ne mette uno opaco di suo. Va dichiarato, e vuoto.
    func fondoNina() -> some View {
        modifier(FondoNina())
    }
}

// MARK: - Widget piccolo: "Oggi 💗"

struct WidgetGiornata: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TipiWidget.giornata, provider: ProviderNina()) { voce in
            VistaGiornata(fotografia: voce.fotografia)
        }
        .configurationDisplayName("Oggi")
        .description("Quante cose hai fatto oggi, a colpo d'occhio.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

private struct VistaGiornata: View {
    let fotografia: FotografiaGiornata
    @Environment(\.widgetFamily) private var famiglia

    private var percentuale: Double {
        guard fotografia.totali > 0 else { return 0 }
        return Double(fotografia.completate) / Double(fotografia.totali)
    }

    var body: some View {
        contenuto.fondoNina()
    }

    @ViewBuilder
    private var contenuto: some View {
        switch famiglia {
        case .accessoryCircular:
            // Sul lock screen il fondo del contenitore resta vuoto (ci pensa
            // `fondoNina()`), e la pastiglia dietro al gauge la disegna
            // AccessoryWidgetBackground: è quella che il sistema sa adattare
            // allo sfondo scelto dalla persona.
            ZStack {
                AccessoryWidgetBackground()
                Gauge(value: percentuale) {
                    Image(systemName: "checkmark")
                } currentValueLabel: {
                    Text("\(fotografia.completate)")
                }
                .gaugeStyle(.accessoryCircularCapacity)
            }
            .widgetAccentable()

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Oggi")
                    .font(.headline)
                    .widgetAccentable()
                Text(fotografia.totali == 0
                     ? "Niente in lista"
                     : "\(fotografia.completate) di \(fotografia.totali) fatte")
                    .font(.caption)
                if let prossima = fotografia.voci.first(where: { !$0.completata }) {
                    Text(prossima.titolo)
                        .font(.caption2)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

        default:
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Oggi")
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .foregroundStyle(Palette.testo)
                    Spacer()
                    Text("💗").font(.caption)
                }

                Spacer(minLength: 0)

                if fotografia.totali == 0 {
                    Text("Giornata libera")
                        .font(.system(.headline, design: .rounded, weight: .bold))
                        .foregroundStyle(Palette.rosa)
                    Text("Niente in lista 😌")
                        .font(.caption2)
                        .foregroundStyle(Palette.testoTenue)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text("\(fotografia.completate)")
                            .font(.system(size: 34, weight: .heavy, design: .rounded))
                            .foregroundStyle(Palette.rosa)
                            .contentTransition(.numericText())
                        Text("/ \(fotografia.totali)")
                            .font(.system(.subheadline, design: .rounded, weight: .semibold))
                            .foregroundStyle(Palette.testoTenue)
                    }

                    GeometryReader { geometria in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Palette.rosa.opacity(0.18))
                            Capsule()
                                .fill(Palette.rosa)
                                .frame(width: geometria.size.width * percentuale)
                        }
                    }
                    .frame(height: 7)

                    Text(fotografia.rimaste == 0 ? "Tutto fatto 🎉" : "Ne restano \(fotografia.rimaste)")
                        .font(.caption2)
                        .foregroundStyle(Palette.testoTenue)
                        .lineLimit(1)
                }
            }
            .widgetURL(URL(string: "nina://oggi"))
        }
    }
}

// MARK: - Widget medio: "Le mie cose di oggi"

struct WidgetCose: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TipiWidget.cose, provider: ProviderNina()) { voce in
            VistaCose(fotografia: voce.fotografia)
                .containerBackground(for: .widget) { Palette.sfondo }
        }
        .configurationDisplayName("Le mie cose di oggi")
        .description("La lista di oggi, con la possibilità di spuntare senza aprire l'app.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

private struct VistaCose: View {
    let fotografia: FotografiaGiornata
    @Environment(\.widgetFamily) private var famiglia

    private var quante: Int { famiglia == .systemLarge ? 7 : 3 }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Le mie cose di oggi")
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    .foregroundStyle(Palette.testo)
                Spacer()
                if fotografia.totali > 0 {
                    Text("\(fotografia.completate)/\(fotografia.totali)")
                        .font(.system(.caption, design: .rounded, weight: .semibold))
                        .foregroundStyle(Palette.rosa)
                }
            }

            if fotografia.voci.isEmpty {
                Spacer()
                Text("Niente in programma oggi 😌")
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(Palette.testoTenue)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                ForEach(fotografia.voci.prefix(quante)) { voce in
                    HStack(spacing: 8) {
                        // L'unico modo di rendere interattivo un widget: un
                        // Button con un AppIntent. Un onTapGesture qui non
                        // farebbe assolutamente niente, senza nessun errore.
                        Button(intent: SpuntaAttivita(idAttivita: voce.id.uuidString)) {
                            Image(systemName: voce.completata ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 16))
                                .foregroundStyle(voce.completata ? Palette.rosa : Palette.testoTenue.opacity(0.6))
                        }
                        .buttonStyle(.plain)

                        if let ora = voce.ora {
                            Text(ora)
                                .font(.system(.caption2, design: .rounded, weight: .semibold).monospacedDigit())
                                .foregroundStyle(voce.completata ? Palette.testoTenue : Palette.rosa)
                        }

                        Text(voce.titolo)
                            .font(.system(.footnote, design: .rounded))
                            .foregroundStyle(voce.completata ? Palette.testoTenue : Palette.testo)
                            .strikethrough(voce.completata, color: Palette.testoTenue)
                            .lineLimit(1)

                        Spacer(minLength: 0)
                    }
                }

                if fotografia.voci.count > quante {
                    Text("e altre \(fotografia.voci.count - quante)")
                        .font(.caption2)
                        .foregroundStyle(Palette.testoTenue)
                }

                Spacer(minLength: 0)
            }
        }
        .widgetURL(URL(string: "nina://oggi"))
    }
}

// MARK: - Widget del pensiero

struct WidgetPensiero: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TipiWidget.pensiero, provider: ProviderNina()) { voce in
            VistaPensiero(fotografia: voce.fotografia)
        }
        .configurationDisplayName("Pensiero del giorno")
        .description("La frase di oggi, sempre sotto gli occhi.")
        .supportedFamilies([.systemMedium, .accessoryRectangular])
    }
}

private struct VistaPensiero: View {
    let fotografia: FotografiaGiornata
    @Environment(\.widgetFamily) private var famiglia

    var body: some View {
        contenuto.fondoNina()
    }

    @ViewBuilder
    private var contenuto: some View {
        if famiglia == .accessoryRectangular {
            VStack(alignment: .leading, spacing: 1) {
                Text("Pensiero di oggi")
                    .font(.caption2.weight(.semibold))
                    .widgetAccentable()
                Text(fotografia.fraseTesto ?? "Una cosa alla volta 💗")
                    .font(.caption2)
                    .lineLimit(3)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            // Stessa impaginazione della card nell'app: virgoletta grande in
            // alto a sinistra, serif, firma staccata.
            HStack(alignment: .top, spacing: 6) {
                Text(verbatim: "\u{201C}")
                    .font(.system(size: 52, design: .serif))
                    .foregroundStyle(Palette.rosa.opacity(0.25))
                    .frame(height: 20, alignment: .top)
                    .offset(y: -6)

                VStack(alignment: .leading, spacing: 8) {
                    Text(fotografia.fraseTesto ?? "Una cosa alla volta 💗")
                        .font(.system(.subheadline, design: .serif))
                        .foregroundStyle(Palette.testo)
                        .lineSpacing(3)
                        .lineLimit(4)

                    if let autore = fotografia.fraseAutore {
                        HStack(spacing: 6) {
                            Rectangle()
                                .fill(Palette.rosa.opacity(0.4))
                                .frame(width: 16, height: 1)
                            Text(autore.uppercased())
                                .font(.system(size: 9, weight: .semibold, design: .rounded))
                                .tracking(1)
                                .foregroundStyle(Palette.testoTenue)
                        }
                    }

                    Spacer(minLength: 0)
                }
            }
            .widgetURL(URL(string: "nina://pensiero"))
        }
    }
}

// MARK: - Bundle

@main
struct NinaWidgetBundle: WidgetBundle {
    var body: some Widget {
        WidgetGiornata()
        WidgetCose()
        WidgetPensiero()
    }
}

// MARK: - Anteprime

#Preview("Oggi", as: .systemSmall) {
    WidgetGiornata()
} timeline: {
    VoceNina.esempio
}

#Preview("Le mie cose", as: .systemMedium) {
    WidgetCose()
} timeline: {
    VoceNina.esempio
}

#Preview("Pensiero", as: .systemMedium) {
    WidgetPensiero()
} timeline: {
    VoceNina.esempio
}
