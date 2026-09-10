// FILE: ios/Nina/Features/Me/SchermataWishlist.swift
//
// "Wishlist ✨"
//
// Il totale in alto è il motivo per cui una wishlist si guarda volentieri: dice
// a colpo d'occhio "ecco quanto vale la lista dei desideri". Conta solo ciò che
// non è ancora stato comprato, e i già presi restano visibili in fondo — vedere
// quello che si è ottenuto è metà del piacere.

import SwiftUI
import SwiftData

struct SchermataWishlist: View {
    @Environment(Deposito.self) private var deposito

    @Query(filter: #Predicate<Desiderio> { $0.deletedAt == nil },
           sort: [SortDescriptor<Desiderio>(\.createdAt, order: .reverse)])
    private var desideri: [Desiderio]

    @State private var mostraNuovo = false
    @State private var daModificare: Desiderio?
    @State private var categoria: WishlistCategory?

    private var daPrendere: [Desiderio] {
        desideri.filter { !$0.acquistato && (categoria == nil || $0.categoria == categoria) }
    }

    private var presi: [Desiderio] {
        desideri.filter { $0.acquistato && (categoria == nil || $0.categoria == categoria) }
    }

    private var totale: Double {
        daPrendere.compactMap(\.prezzo).reduce(0, +)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spazio.comodo) {
                if !desideri.isEmpty {
                    riepilogo
                    filtri
                }

                if desideri.isEmpty {
                    Card {
                        StatoVuoto(
                            icona: "sparkles",
                            titolo: "La wishlist è vuota",
                            messaggio: VoceDiNina.nienteWishlist(),
                            azione: (titolo: "Aggiungi un desiderio", esegui: { mostraNuovo = true })
                        )
                    }
                } else {
                    ForEach(daPrendere) { desiderio in
                        RigaDesiderio(desiderio: desiderio) { daModificare = desiderio }
                    }

                    if !presi.isEmpty {
                        Text("Già presi")
                            .font(Tipo.sottotitolo)
                            .foregroundStyle(Palette.testoTenue)
                            .padding(.top, Spazio.piccolo)

                        ForEach(presi) { desiderio in
                            RigaDesiderio(desiderio: desiderio) { daModificare = desiderio }
                        }
                    }
                }
            }
            .padding(.horizontal, Spazio.normale)
            .padding(.bottom, Spazio.ampio)
        }
        .scrollIndicators(.hidden)
        .sfondoNina()
        .navigationTitle("Wishlist")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { mostraNuovo = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Aggiungi un desiderio")
            }
        }
        .sheet(isPresented: $mostraNuovo) { ModificaDesiderio() }
        .sheet(item: $daModificare) { desiderio in ModificaDesiderio(desiderio: desiderio) }
    }

    private var riepilogo: some View {
        Card {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Valore totale")
                        .maiuscoletto()
                        .foregroundStyle(Palette.testoTenue)

                    Text(totale, format: .currency(code: "EUR").precision(.fractionLength(0)))
                        .font(Tipo.numero)
                        .foregroundStyle(Palette.testo)
                        .contentTransition(.numericText())
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(daPrendere.count)")
                        .font(Tipo.titolo)
                        .foregroundStyle(Palette.rosa)
                    Text(daPrendere.count == 1 ? "desiderio" : "desideri")
                        .font(.caption)
                        .foregroundStyle(Palette.testoTenue)
                }
            }
        }
    }

    private var filtri: some View {
        ScrollView(.horizontal) {
            HStack(spacing: Spazio.piccolo) {
                ChipFiltro(testo: "Tutti", attivo: categoria == nil) { categoria = nil }
                ForEach(WishlistCategory.allCases) { valore in
                    ChipFiltro(
                        testo: "\(valore.emoji) \(valore.etichetta)",
                        attivo: categoria == valore
                    ) {
                        categoria = categoria == valore ? nil : valore
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
    }
}

// MARK: - Riga

private struct RigaDesiderio: View {
    let desiderio: Desiderio
    let onModifica: () -> Void

    @Environment(Deposito.self) private var deposito

    var body: some View {
        Card(riempimento: Spazio.normale) {
            HStack(spacing: Spazio.normale) {
                ZStack {
                    RoundedRectangle(cornerRadius: Raggio.piccolo, style: .continuous)
                        .fill(Palette.rosaTenue)
                        .frame(width: 52, height: 52)
                    Text(desiderio.categoria.emoji).font(.system(size: 24))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(desiderio.titolo)
                        .font(Tipo.corpoForte)
                        .foregroundStyle(desiderio.acquistato ? Palette.testoTenue : Palette.testo)
                        .strikethrough(desiderio.acquistato, color: Palette.testoTenue)
                        .lineLimit(2)

                    HStack(spacing: Spazio.piccolo) {
                        if let prezzo = desiderio.prezzo {
                            Text(prezzo, format: .currency(code: desiderio.valuta).precision(.fractionLength(0)))
                                .font(Tipo.didascalia)
                                .foregroundStyle(Palette.rosa)
                        }

                        if desiderio.linkProdotto != nil {
                            Image(systemName: "link")
                                .font(.caption2)
                                .foregroundStyle(Palette.testoTenue)
                        }
                    }
                }

                Spacer(minLength: 0)

                Button {
                    deposito.segnaAcquistato(desiderio, !desiderio.acquistato)
                } label: {
                    Image(systemName: desiderio.acquistato ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(desiderio.acquistato ? Palette.successo : Palette.testoTenue.opacity(0.5))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(desiderio.acquistato ? "Segna come non ancora preso" : "Segna come preso")
            }
        }
        .opacity(desiderio.acquistato ? 0.7 : 1)
        .contextMenu {
            Button { onModifica() } label: { Label("Modifica", systemImage: "pencil") }

            if let link = desiderio.linkProdotto, let url = URL(string: link) {
                Link(destination: url) { Label("Apri il link", systemImage: "safari") }
            }

            Button(role: .destructive) {
                deposito.elimina(desiderio)
            } label: {
                Label("Elimina", systemImage: "trash")
            }
        }
    }
}

// MARK: - Creazione e modifica

struct ModificaDesiderio: View {
    var desiderio: Desiderio?

    @Environment(Deposito.self) private var deposito
    @Environment(\.dismiss) private var chiudi

    @State private var titolo = ""
    @State private var prezzo = ""
    @State private var categoria: WishlistCategory = .altro
    @State private var link = ""
    @State private var dettaglio = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Cosa ti piacerebbe?", text: $titolo)
                    TextField("Prezzo (facoltativo)", text: $prezzo)
                        .keyboardType(.decimalPad)
                }
                .listRowBackground(Palette.carta)

                Section("Categoria") {
                    Picker("Categoria", selection: $categoria) {
                        ForEach(WishlistCategory.allCases) { valore in
                            Text("\(valore.emoji)  \(valore.etichetta)").tag(valore)
                        }
                    }
                }
                .listRowBackground(Palette.carta)

                Section("Altro") {
                    TextField("Link al prodotto", text: $link)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    TextField("Note", text: $dettaglio, axis: .vertical)
                        .lineLimit(2...5)
                }
                .listRowBackground(Palette.carta)

                if desiderio != nil {
                    Section {
                        Button(role: .destructive) {
                            if let desiderio { deposito.elimina(desiderio) }
                            chiudi()
                        } label: {
                            Label("Elimina", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                    }
                    .listRowBackground(Palette.carta)
                }
            }
            .scrollContentBackground(.hidden)
            .background(SfondoNina())
            .navigationTitle(desiderio == nil ? "Nuovo desiderio" : "Modifica")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { chiudi() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") { salva() }
                        .fontWeight(.semibold)
                        .disabled(titolo.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                guard let desiderio else { return }
                titolo = desiderio.titolo
                prezzo = desiderio.prezzo.map { String(format: "%.2f", $0) } ?? ""
                categoria = desiderio.categoria
                link = desiderio.linkProdotto ?? ""
                dettaglio = desiderio.dettaglio ?? ""
            }
        }
    }

    private func salva() {
        let testo = titolo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !testo.isEmpty else { return }

        // La virgola è come si scrivono i decimali in italiano: accettarla
        // evita che "24,90" diventi nil e il prezzo sparisca senza spiegazioni.
        let valore = Double(prezzo.replacingOccurrences(of: ",", with: "."))
        let indirizzo = link.trimmingCharacters(in: .whitespaces)
        let note = dettaglio.trimmingCharacters(in: .whitespacesAndNewlines)

        if let desiderio {
            deposito.modificaDesiderio(desiderio) { modifica in
                modifica.titolo = testo
                modifica.prezzo = valore
                modifica.categoria = categoria
                modifica.linkProdotto = indirizzo.isEmpty ? nil : indirizzo
                modifica.dettaglio = note.isEmpty ? nil : note
            }
        } else {
            deposito.creaDesiderio(
                titolo: testo, prezzo: valore, categoria: categoria,
                link: indirizzo.isEmpty ? nil : indirizzo,
                dettaglio: note.isEmpty ? nil : note
            )
        }

        chiudi()
    }
}
