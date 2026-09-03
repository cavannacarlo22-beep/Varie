# -*- coding: utf-8 -*-
"""Disegna le clutch all'uncinetto in SVG.

ATTENZIONE: questi sono disegni provvisori, non fotografie. Servono a far vedere
il sito finito mentre Teresa scatta le foto vere. Appena una foto e' pronta,
basta metterla in products.json (campo "photos") e prende il posto del disegno.

Il colore non e' scritto dentro l'SVG: viene letto dalle CSS custom properties
--bag-lt / --bag / --bag-dk impostate sulla scheda prodotto, cosi' cliccando una
pastiglia colore la borsa cambia filato all'istante.
"""

HW = {
    "legno":   ("#E4C79B", "#C09A66", "#8A6A42"),
    "bambu":   ("#EBD9B4", "#C8AC79", "#8F7448"),
    "oro":     ("#F5E6BC", "#CDAA66", "#94773F"),
    "argento": ("#F2F4F7", "#C4CAD3", "#8B949F"),
}


def defs(slug, hardware, stitch_def):
    a, b, c = HW.get(hardware, HW["legno"])
    return f'''<defs>
<linearGradient id="bg-{slug}" x1="0" y1="0" x2=".25" y2="1">
<stop offset="0" style="stop-color:var(--bag-lt)"/>
<stop offset=".52" style="stop-color:var(--bag)"/>
<stop offset="1" style="stop-color:var(--bag-dk)"/>
</linearGradient>
<linearGradient id="bd-{slug}" x1="0" y1="0" x2=".3" y2="1">
<stop offset="0" style="stop-color:var(--bag)"/>
<stop offset="1" style="stop-color:var(--bag-dk)"/>
</linearGradient>
<linearGradient id="hw-{slug}" x1="0" y1="0" x2=".6" y2="1">
<stop offset="0" stop-color="{a}"/><stop offset=".5" stop-color="{b}"/><stop offset="1" stop-color="{c}"/>
</linearGradient>
<linearGradient id="sh-{slug}" x1=".1" y1="0" x2=".6" y2="1">
<stop offset="0" stop-color="#fff" stop-opacity=".4"/>
<stop offset=".45" stop-color="#fff" stop-opacity=".05"/>
<stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<radialGradient id="fl-{slug}" cx=".5" cy=".5" r=".5">
<stop offset="0" stop-color="#0B1F2C" stop-opacity=".2"/>
<stop offset="1" stop-color="#0B1F2C" stop-opacity="0"/>
</radialGradient>
{stitch_def}
</defs>'''


def floor(slug, cy=318, rx=132, ry=17):
    return f'<ellipse cx="200" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#fl-{slug})"/>'


# ------------------------------------------------------------------ i punti
# Ogni punto e' un pattern che si ripete: il filato scuro fa l'ombra fra un
# punto e l'altro, quello chiaro il riflesso sulla parte alta del filo.

def st_basso(s):
    """Punto basso: le classiche V fitte, riga dopo riga."""
    return f'''<pattern id="st-{s}" width="15" height="13" patternUnits="userSpaceOnUse">
<g fill="none" stroke-linecap="round">
<path d="M3.5 1.5 7.5 10.5 11.5 1.5" stroke="#0B1F2C" stroke-opacity=".2" stroke-width="3.4"/>
<path d="M3 .6 7 9.6 11 .6" stroke="#fff" stroke-opacity=".34" stroke-width="1.9"/>
<path d="M-4 12.5h23" stroke="#0B1F2C" stroke-opacity=".1" stroke-width="1.6"/>
</g></pattern>'''


def st_granny(s):
    """Piastrella granny square: anelli concentrici di gruppetti e buchini."""
    ring = ('<rect x="{i}" y="{i}" width="{w}" height="{w}" rx="2" fill="none" '
            'stroke="#0B1F2C" stroke-opacity=".17" stroke-width="3" stroke-dasharray="9 4.5"/>'
            '<rect x="{i}" y="{j}" width="{w}" height="{w}" rx="2" fill="none" '
            'stroke="#fff" stroke-opacity=".3" stroke-width="1.6" stroke-dasharray="9 4.5"/>')
    rings = "".join(ring.format(i=i, j=i - 1.6, w=48 - 2 * i) for i in (5, 13, 21))
    holes = "".join(
        f'<circle cx="{x}" cy="{y}" r="1.9" fill="#0B1F2C" fill-opacity=".22"/>'
        for x, y in ((5, 5), (43, 5), (5, 43), (43, 43), (13, 13), (35, 13), (13, 35), (35, 35)))
    return f'''<pattern id="st-{s}" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="scale(1.72)">
{rings}{holes}
<circle cx="24" cy="24" r="5.5" fill="none" stroke="#0B1F2C" stroke-opacity=".18" stroke-width="3"/>
<circle cx="24" cy="24" r="2.4" fill="#0B1F2C" fill-opacity=".2"/>
<path d="M0 0h48M0 48h48M0 0v48M48 0v48" stroke="#0B1F2C" stroke-opacity=".12" stroke-width="2"/>
</pattern>'''


def st_ventaglio(s):
    """Punto ventaglio: file di conchiglie aperte."""
    fan = "".join(
        '<path d="M11 15 %.1f %.1f" stroke="#0B1F2C" stroke-opacity=".18" stroke-width="2.8" stroke-linecap="round"/>'
        '<path d="M11 14 %.1f %.1f" stroke="#fff" stroke-opacity=".32" stroke-width="1.5" stroke-linecap="round"/>'
        % (11 + 9.5 * __import__("math").cos(a), 15 - 10.5 * __import__("math").sin(a),
           11 + 9.5 * __import__("math").cos(a), 14 - 10.5 * __import__("math").sin(a))
        for a in (0.35, 0.95, 1.57, 2.19, 2.79))
    return f'''<pattern id="st-{s}" width="22" height="15" patternUnits="userSpaceOnUse">
{fan}<circle cx="11" cy="15" r="2" fill="#0B1F2C" fill-opacity=".16"/>
</pattern>'''


def st_nocciolina(s):
    """Punto nocciolina: palline in rilievo alternate."""
    return f'''<pattern id="st-{s}" width="26" height="26" patternUnits="userSpaceOnUse">
<g><ellipse cx="7" cy="7" rx="6" ry="5.4" fill="#fff" fill-opacity=".22"/>
<ellipse cx="20" cy="20" rx="6" ry="5.4" fill="#fff" fill-opacity=".22"/>
<ellipse cx="5.4" cy="5.2" rx="2.4" ry="2" fill="#fff" fill-opacity=".45"/>
<ellipse cx="18.4" cy="18.2" rx="2.4" ry="2" fill="#fff" fill-opacity=".45"/>
<ellipse cx="8.6" cy="9.4" rx="3.6" ry="2.6" fill="#0B1F2C" fill-opacity=".14"/>
<ellipse cx="21.6" cy="22.4" rx="3.6" ry="2.6" fill="#0B1F2C" fill-opacity=".14"/></g>
<path d="M13.5 0v26M0 13h26" stroke="#0B1F2C" stroke-opacity=".08" stroke-width="2"/>
</pattern>'''


def st_rete(s):
    """Punto rete (filet): maglie aperte, si intravede la fodera."""
    return f'''<pattern id="st-{s}" width="20" height="20" patternUnits="userSpaceOnUse">
<path d="M10 0 20 10 10 20 0 10z" fill="#0B1F2C" fill-opacity=".16"/>
<g fill="none" stroke-linejoin="round">
<path d="M10 1.6 18.4 10 10 18.4 1.6 10z" stroke="#fff" stroke-opacity=".3" stroke-width="2"/>
<path d="M10 3 17 10 10 17 3 10z" stroke="#0B1F2C" stroke-opacity=".12" stroke-width="2.6"/>
</g></pattern>'''


def st_coste(s):
    """Punto a coste: colonnine verticali in rilievo."""
    return f'''<pattern id="st-{s}" width="16" height="11" patternUnits="userSpaceOnUse">
<rect x="2" y="0" width="7" height="11" rx="3.5" fill="#fff" fill-opacity=".2"/>
<rect x="3" y="0" width="2.6" height="11" rx="1.3" fill="#fff" fill-opacity=".34"/>
<rect x="9.5" y="0" width="4" height="11" rx="2" fill="#0B1F2C" fill-opacity=".15"/>
<path d="M0 10.2h16" stroke="#0B1F2C" stroke-opacity=".12" stroke-width="1.5"/>
</pattern>'''


STITCH = {"basso": st_basso, "granny": st_granny, "ventaglio": st_ventaglio,
          "nocciolina": st_nocciolina, "rete": st_rete, "coste": st_coste}


def yarn_edge(d, s, w=7):
    """Bordo a filo grosso: e' quello che rende l'idea del lavoro a mano."""
    return (f'<path d="{d}" fill="none" stroke="url(#bd-{s})" stroke-width="{w}" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="#0B1F2C" stroke-opacity=".13" stroke-width="{w}" '
            f'stroke-dasharray="6 5" stroke-linecap="round"/>')


def texture(d, s):
    """Corpo della borsa: base sfumata + punto + luce."""
    return (f'<path d="{d}" fill="url(#bg-{s})"/>'
            f'<path d="{d}" fill="url(#st-{s})"/>'
            f'<path d="{d}" fill="url(#sh-{s})"/>')


# ------------------------------------------------------------------ i modelli

def busta(s):
    body = "M72 176h256v106a16 16 0 0 1-16 16H88a16 16 0 0 1-16-16z"
    flap = "M72 158a14 14 0 0 1 14-14h228a14 14 0 0 1 14 14v34q0 50-128 50T72 192z"
    return f'''{floor(s)}
{texture(body, s)}
{texture(flap, s)}
<path d="M72 176q0 66 128 66t128-66v16q0 50-128 50T72 192z" fill="#0B1F2C" fill-opacity=".14"/>
{yarn_edge(flap, s)}
{yarn_edge("M72 176v106a16 16 0 0 0 16 16h224a16 16 0 0 0 16-16V176", s)}
<circle cx="200" cy="238" r="13" fill="url(#hw-{s})"/>
<circle cx="200" cy="238" r="5" fill="#0B1F2C" fill-opacity=".22"/>'''


def mezzaluna(s):
    body = "M76 180c0 66 40 118 124 118s124-52 124-118z"
    return f'''{floor(s, 314, 112, 14)}
<circle cx="200" cy="150" r="46" fill="none" stroke="url(#hw-{s})" stroke-width="12"/>
<circle cx="200" cy="150" r="46" fill="none" stroke="#0B1F2C" stroke-opacity=".16" stroke-width="12" stroke-dasharray="4 26"/>
{texture(body, s)}
{yarn_edge(body, s)}
<ellipse cx="200" cy="180" rx="124" ry="15" fill="url(#bd-{s})"/>
<ellipse cx="200" cy="179" rx="108" ry="9" fill="#0B1F2C" fill-opacity=".2"/>
<path d="M76 180a124 15 0 0 0 248 0" fill="none" stroke="url(#bd-{s})" stroke-width="8"/>'''


def puffy(s):
    body = "M68 146h264v152H68z"
    body = "M120 146h160a52 52 0 0 1 52 52v48a52 52 0 0 1-52 52H120a52 52 0 0 1-52-52v-48a52 52 0 0 1 52-52z"
    return f'''{floor(s, 314, 126, 16)}
<path d="M150 152C150 98 250 98 250 152" fill="none" stroke="url(#hw-{s})" stroke-width="6" stroke-dasharray="10 5" stroke-linecap="round"/>
{texture(body, s)}
{yarn_edge(body, s)}
<rect x="98" y="156" width="204" height="10" rx="5" fill="url(#hw-{s})"/>'''


def granny(s):
    body = "M84 156h232a10 10 0 0 1 10 10v122a10 10 0 0 1-10 10H84a10 10 0 0 1-10-10V166a10 10 0 0 1 10-10z"
    return f'''{floor(s, 314, 126, 15)}
<path d="M128 156C128 92 272 92 272 156" fill="none" stroke="url(#hw-{s})" stroke-width="9" stroke-linecap="round"/>
{texture(body, s)}
{yarn_edge(body, s)}
<path d="M200 156v142M74 227h252" stroke="#0B1F2C" stroke-opacity=".14" stroke-width="3"/>
<rect x="182" y="272" width="36" height="14" rx="7" fill="url(#hw-{s})"/>'''


def onda(s):
    body = "M66 236c0-42 60-66 134-66s134 24 134 66-60 66-134 66S66 278 66 236z"
    return f'''{floor(s, 318, 126, 16)}
{texture(body, s)}
{yarn_edge(body, s)}
<path d="M78 214c50 24 108-22 160-2 32 12 58 6 76-10" fill="none" stroke="url(#bd-{s})" stroke-width="7" stroke-linecap="round"/>
<path d="M78 214c50 24 108-22 160-2 32 12 58 6 76-10" fill="none" stroke="#0B1F2C" stroke-opacity=".14" stroke-width="7" stroke-dasharray="5 6" stroke-linecap="round"/>
<rect x="176" y="163" width="48" height="12" rx="6" fill="url(#hw-{s})"/>'''


def pochette(s):
    body = "M104 200c0-18 30-28 96-28s96 10 96 28v48c0 40-40 58-96 58s-96-18-96-58z"
    import math
    beads = "".join(
        '<circle cx="%.1f" cy="%.1f" r="6.5" fill="url(#hw-%s)"/>'
        % ((1 - t) ** 2 * 116 + 2 * (1 - t) * t * 200 + t * t * 284,
           (1 - t) ** 2 * 188 + 2 * (1 - t) * t * 86 + t * t * 188, s)
        for t in [i / 15.0 for i in range(16)])
    del math
    return f'''{floor(s, 320, 108, 14)}
{beads}
{texture(body, s)}
{yarn_edge(body, s)}
<path d="M104 196q96-24 192 0v10q-96-24-192 0z" fill="url(#hw-{s})"/>'''


def trapezio(s):
    body = ("M98 172h204c9 0 15 5 16 12l17 100c2 11-5 18-16 18H81c-11 0-18-7-16-18l17-100"
            "c1-7 7-12 16-12z")
    return f'''{floor(s, 320, 132, 16)}
<path d="M126 174C126 104 274 104 274 174" fill="none" stroke="url(#hw-{s})" stroke-width="10" stroke-linecap="round"/>
{texture(body, s)}
{yarn_edge(body, s)}
<path d="M92 184h216" stroke="url(#hw-{s})" stroke-width="9" stroke-linecap="round"/>'''


def tonda(s):
    body = "M200 128a104 104 0 1 1 0 208 104 104 0 0 1 0-208z"
    body = "M304 232a104 104 0 1 1-208 0 104 104 0 0 1 208 0z"
    return f'''{floor(s, 342, 100, 13)}
<rect x="186" y="106" width="28" height="34" rx="8" fill="url(#hw-{s})"/>
<circle cx="200" cy="98" r="26" fill="none" stroke="url(#hw-{s})" stroke-width="10"/>
{texture(body, s)}
{yarn_edge(body, s)}
<path d="M101 200a104 104 0 0 1 198 0 99 24 0 0 1-198 0z" fill="#0B1F2C" fill-opacity=".12"/>
<path d="M101 200a99 24 0 0 0 198 0" fill="none" stroke="url(#bd-{s})" stroke-width="7"/>'''


SHAPES = {"busta": busta, "mezzaluna": mezzaluna, "puffy": puffy, "granny": granny,
          "onda": onda, "pochette": pochette, "trapezio": trapezio, "tonda": tonda}


def svg(p, uid=None, cls="bag__svg"):
    s = uid or p["slug"]
    stitch_def = STITCH[p.get("stitch", "basso")](s)
    body = SHAPES[p["shape"]](s)
    return (f'<svg class="{cls}" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="Disegno della clutch {p["name"]}: {p["tagline"]}">'
            f'{defs(s, p["hardware"], stitch_def)}{body}</svg>')
