#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera index.html e assets/js/products.js a partire da scripts/products.json.

Uso:  python3 scripts/build.py
Da rilanciare ogni volta che modifichi products.json (prezzi, colori, misure).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import bags  # noqa: E402

SITE = "https://teresasardanelli.vercel.app"
EMAIL = "ciao@teresasardanelli.it"
IG = "teresasardanelli"

FAQ = [
    ("Quanto tempo ci vuole per ricevere la borsa?",
     "Non tengo magazzino: ogni clutch viene cucita dopo l’ordine. Servono 7–10 giorni "
     "lavorativi, più 1–2 giorni di spedizione tracciata. Se ti serve per una data precisa "
     "scrivimelo prima di ordinare: quasi sempre riesco a organizzarmi."),
    ("Posso avere un colore che non c’è in collezione?",
     "Sì. Puoi mandarmi una foto del vestito o un campione di stoffa e cerco la tonalità "
     "più vicina fra i tessuti che ho. Il sovrapprezzo per il su misura è di 20 euro."),
    ("Come si paga?",
     "Quando completi l’ordine mi arriva il riepilogo su WhatsApp o via email. Ti rispondo "
     "con la conferma della disponibilità e i dati per il bonifico, oppure ti mando un link "
     "di pagamento con carta o PayPal. Comincio a cucire quando ricevo il pagamento."),
    ("Quanto costa la spedizione?",
     "Sette euro in tutta Italia, con tracciamento. Gratuita per ordini da 150 euro in su. "
     "Per l’estero scrivimi: calcolo il costo esatto in base al paese."),
    ("Posso restituirla se non mi piace?",
     "Hai 14 giorni dalla consegna per il reso, purché la borsa sia integra e mai usata. "
     "Le borse su misura, essendo fatte apposta per te, non sono rimborsabili — ma prima "
     "di cucirle ti mando sempre un disegno da approvare."),
    ("Come si lava e si conserva?",
     "Mai in lavatrice. Un panno morbido appena umido per le macchie, e per seta e raso "
     "meglio la lavanderia specializzata. Conservala nel sacchetto di cotone che trovi nella "
     "confezione, lontano dal sole diretto."),
    ("Le riparate se si rovina?",
     "Per il primo anno riparo gratis qualsiasi cucitura o chiusura che ceda: paghi solo la "
     "spedizione per mandarmela. Dopo il primo anno il preventivo è simbolico."),
]


def mix(hex_a, hex_b, f):
    a = [int(hex_a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(hex_b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02X%02X%02X" % tuple(round(x + (y - x) * f) for x, y in zip(a, b))


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def main():
    data = json.load(open(os.path.join(HERE, "products.json"), encoding="utf-8"))
    pal = data["palette"]
    for key, c in pal.items():
        c["lt"] = mix(c["hex"], "#FFFFFF", .44)
        c["dk"] = mix(c["hex"], "#12293A", .34)

    cards, select, offers = [], [], []
    for p in data["products"]:
        first = pal[p["colors"][0]]
        prices = [s["price"] for s in p["sizes"]]
        swatches = "".join(
            '<button class="sw" type="button" data-key="%s" data-lt="%s" data-base="%s" data-dk="%s"'
            ' style="background:%s" title="%s" aria-label="Vedi %s in %s" aria-pressed="%s"></button>'
            % (k, pal[k]["lt"], pal[k]["hex"], pal[k]["dk"], pal[k]["hex"],
               esc(pal[k]["name"]), esc(p["name"]), esc(pal[k]["name"]),
               "true" if i == 0 else "false")
            for i, k in enumerate(p["colors"]))
        sizes = "".join("<span>%s</span>" % esc(s["name"]) for s in p["sizes"])
        badge = ('<span class="card__badge">%s</span>' % esc(p["badge"])) if p["badge"] else ""

        # Se in products.json aggiungi "photo": "nome-file.jpg", al posto del
        # disegno viene mostrata la tua fotografia (cartella assets/img/products/).
        if p.get("photo"):
            media = ('<img class="bag__svg" src="/assets/img/products/%s" width="800" height="800" '
                     'loading="lazy" decoding="async" alt="Clutch %s — %s">'
                     % (esc(p["photo"]), esc(p["name"]), esc(p["tagline"])))
        else:
            media = bags.svg(p)

        cards.append(
            '      <article class="card reveal" data-slug="%s" data-cat="%s" data-color="%s"\n'
            '        style="--d:%.2fs;--bag-lt:%s;--bag:%s;--bag-dk:%s">\n'
            '        <div class="card__media" data-open="%s">%s%s\n'
            '          <button class="card__quick" type="button" data-open="%s">Guarda e scegli</button>\n'
            '        </div>\n'
            '        <div class="card__body">\n'
            '          <div class="card__row"><h3 class="card__name">%s</h3>\n'
            '            <div class="card__price">da <b>€%d</b></div></div>\n'
            '          <p class="card__tag">%s</p>\n'
            '          <div class="card__foot">\n'
            '            <div class="swatches" role="group" aria-label="Colori di %s">%s</div>\n'
            '            <div class="sizes">%s</div>\n'
            '          </div>\n'
            '        </div>\n'
            '      </article>'
            % (p["slug"], p["category"], p["colors"][0],
               .06 * len(cards), first["lt"], first["hex"], first["dk"],
               p["slug"], badge, media, p["slug"], esc(p["name"]), min(prices), esc(p["tagline"]),
               esc(p["name"]), swatches, sizes))

        select.append('          <option>%s — da €%d</option>' % (esc(p["name"]), min(prices)))
        offers.append({
            "@type": "Product",
            "name": "Clutch " + p["name"],
            "description": p["tagline"] + " " + p["material"] + ".",
            "brand": {"@type": "Brand", "name": "Teresa Sardanelli"},
            "material": p["material"],
            "url": SITE + "/#collezione",
            "offers": {
                "@type": "AggregateOffer",
                "priceCurrency": "EUR",
                "lowPrice": min(prices),
                "highPrice": max(prices),
                "offerCount": len(p["sizes"]) * len(p["colors"]),
                "availability": "https://schema.org/MadeToOrder",
            },
        })

    faq = "".join(
        '<div class="acc__i reveal" style="--d:%.2fs">'
        '<button class="acc__b" type="button" aria-expanded="false" aria-controls="faq-%d">'
        '%s<i aria-hidden="true"></i></button>'
        '<div class="acc__p" id="faq-%d" data-open="false"><div><p>%s</p></div></div></div>'
        % (.05 * i, i, esc(q), i, esc(a)) for i, (q, a) in enumerate(FAQ))

    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": ["Organization", "Store"],
                "@id": SITE + "/#brand",
                "name": "Teresa Sardanelli",
                "description": "Atelier artigianale di clutch bag cucite a mano in Italia.",
                "url": SITE + "/",
                "email": EMAIL,
                "founder": {"@type": "Person", "name": "Teresa Sardanelli"},
                "areaServed": "IT",
                "sameAs": ["https://instagram.com/" + IG],
            },
            {"@type": "WebSite", "url": SITE + "/", "name": "Teresa Sardanelli",
             "inLanguage": "it-IT", "publisher": {"@id": SITE + "/#brand"}},
            {"@type": "ItemList", "name": "Collezione clutch",
             "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": o}
                                 for i, o in enumerate(offers)]},
            {"@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]},
        ],
    }, ensure_ascii=False, indent=1)

    hero = data["products"][0]
    hc = pal[hero["colors"][0]]
    plname = "".join(
        '<span style="animation-delay:%.2fs">%s</span>' % (.04 * i, ch if ch != " " else "&nbsp;")
        for i, ch in enumerate("teresa sardanelli"))

    html = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
    for k, v in [("{{CARDS}}", "\n".join(cards)), ("{{FAQ}}", faq), ("{{JSONLD}}", jsonld),
                 ("{{SELECT}}", "\n".join(select)), ("{{SITE}}", SITE), ("{{EMAIL}}", EMAIL),
                 ("{{IG}}", IG), ("{{PLNAME}}", plname),
                 ("{{HERO_BAG}}", bags.svg(hero, uid="hero", cls="bag__svg")),
                 ("{{HERO_LT}}", hc["lt"]), ("{{HERO_BASE}}", hc["hex"]), ("{{HERO_DK}}", hc["dk"])]:
        html = html.replace(k, v)
    assert "{{" not in html, "placeholder non sostituito"
    open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(html)

    js = ("/* Generato da scripts/build.py — non modificare a mano:\n"
          "   cambia scripts/products.json e rilancia `python3 scripts/build.py`. */\n"
          "window.PRODUCTS = " + json.dumps(
              {"palette": pal,
               "items": [{k: v for k, v in p.items() if k != "story" or True}
                         for p in data["products"]]},
              ensure_ascii=False, indent=1) + ";\n")
    open(os.path.join(ROOT, "assets/js/products.js"), "w", encoding="utf-8").write(js)

    print("index.html          %6.1f kB" % (len(html.encode()) / 1024))
    print("assets/js/products.js %4.1f kB" % (len(js.encode()) / 1024))
    print("%d prodotti, %d colori, %d FAQ" % (len(data["products"]), len(pal), len(FAQ)))


if __name__ == "__main__":
    main()
