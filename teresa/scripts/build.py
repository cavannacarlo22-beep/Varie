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
     "Non tengo magazzino: ogni clutch viene lavorata a uncinetto dopo l’ordine. Servono "
     "10–14 giorni lavorativi — la fodera è cucita a mano dentro, e anche quella vuole il "
     "suo tempo — più 1–2 giorni di spedizione tracciata. Se ti serve per una data precisa "
     "scrivimelo prima di ordinare: quasi sempre riesco a organizzarmi."),
    ("Che filati usi? Non è che si sformano?",
     "Uso solo cotone: cotone egiziano per i modelli fini, cotone ritorto e fettuccia di "
     "cotone riciclato per quelli più strutturati. Niente acrilico. Ogni borsa è bloccata a "
     "umido a lavoro finito e foderata a mano con tessuto di cotone, che è la cosa che "
     "davvero le impedisce di sformarsi: senza fodera, una borsa a uncinetto cede in un mese."),
    ("Posso avere un colore o un punto che non c’è in collezione?",
     "Sì. Puoi mandarmi una foto del vestito e cerco il filato più vicino fra quelli che ho, "
     "oppure lo ordino. Posso anche fare la forma di un modello con il punto di un altro — "
     "per esempio la Luna a punto ventaglio. Il sovrapprezzo per il su misura è di 20 euro."),
    ("Come si paga?",
     "Quando completi l’ordine mi arriva il riepilogo su WhatsApp o via email. Ti rispondo "
     "con la conferma e i dati per il bonifico, oppure ti mando un link di pagamento con "
     "carta o PayPal. Comincio a lavorare quando ricevo il pagamento."),
    ("Quanto costa la spedizione?",
     "Sette euro in tutta Italia, con tracciamento. Gratuita per ordini da 120 euro in su. "
     "Per l’estero scrivimi: calcolo il costo esatto in base al paese."),
    ("Posso restituirla se non mi piace?",
     "Hai 14 giorni dalla consegna per il reso, purché la borsa sia integra e mai usata. "
     "Le borse su misura, essendo lavorate apposta per te, non sono rimborsabili — ma prima "
     "di cominciare ti mando sempre la foto del campione del punto e del filato."),
    ("Come si lava una borsa a uncinetto?",
     "Mai in lavatrice e mai strizzata: il cotone lavorato a uncinetto si allunga da bagnato. "
     "Per le macchie basta un panno umido con un po’ di sapone neutro, tamponando. Per un "
     "lavaggio vero: acqua fredda, a mano, senza sfregare, poi asciugatura in piano su un "
     "asciugamano — mai appesa, o il manico tira e la borsa si deforma. I modelli con manico "
     "in legno o bambù vanno smontati prima (il manico si sfila, te lo spiego nel cartellino)."),
    ("Le riparate se si rovina?",
     "Per il primo anno riparo gratis qualsiasi punto che si apra, manico che si allenti o "
     "fodera che si scuce: paghi solo la spedizione per mandarmela. Dopo il primo anno il "
     "preventivo è simbolico."),
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

        # La media della scheda contiene il disegno + una fotografia per ogni
        # colore gia' fotografato (products.json -> "photos"). Ne resta visibile
        # una sola: la pastiglia colore fa lo scambio. Finche' la foto di quel
        # colore non c'e', si vede il disegno.
        photos = p.get("photos") or {}
        media = bags.svg(p)
        if photos.get(p["colors"][0]):
            media = media.replace('class="bag__svg"', 'class="bag__svg bag__art" hidden', 1)
        else:
            media = media.replace('class="bag__svg"', 'class="bag__svg bag__art"', 1)
        for key in p["colors"]:
            f = photos.get(key)
            if not f:
                continue
            media += ('<img class="bag__svg bag__photo" data-color="%s" '
                      'src="/assets/img/products/%s" width="1000" height="1000" '
                      'loading="lazy" decoding="async" alt="Clutch %s all\u2019uncinetto, colore %s"%s>'
                      % (key, esc(f), esc(p["name"]), esc(pal[key]["name"]),
                         "" if key == p["colors"][0] else " hidden"))

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
            '          <p class="card__yarn">%s</p>\n'
            '          <div class="card__foot">\n'
            '            <div class="swatches" role="group" aria-label="Colori di %s">%s</div>\n'
            '            <div class="sizes">%s</div>\n'
            '          </div>\n'
            '        </div>\n'
            '      </article>'
            % (p["slug"], p["category"], p["colors"][0],
               .06 * len(cards), first["lt"], first["hex"], first["dk"],
               p["slug"], badge, media, p["slug"], esc(p["name"]), min(prices), esc(p["tagline"]), esc(p["yarn"]),
               esc(p["name"]), swatches, sizes))

        select.append('          <option>%s — da €%d</option>' % (esc(p["name"]), min(prices)))
        offers.append({
            "@type": "Product",
            "name": "Clutch " + p["name"],
            "description": p["tagline"] + " " + p["yarn"] + ". " + p["material"] + ".",
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
                "description": "Atelier artigianale di clutch bag lavorate a uncinetto in Italia.",
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
