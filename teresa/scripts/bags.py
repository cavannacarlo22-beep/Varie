# -*- coding: utf-8 -*-
"""Disegna le illustrazioni SVG delle clutch.

Il colore non è scritto dentro l’SVG: viene letto dalle CSS custom properties
--bag-lt / --bag / --bag-dk impostate sulla scheda prodotto. Cosi' cliccando
una pastiglia colore la borsa cambia colore all'istante, senza ricaricare
nessuna immagine.
"""

HW = {
    "oro":     ("#F5E6BC", "#CDAA66", "#94773F"),
    "argento": ("#F2F4F7", "#C4CAD3", "#8B949F"),
}


def defs(slug, hardware):
    a, b, c = HW.get(hardware, HW["oro"])
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
<stop offset="0" stop-color="#fff" stop-opacity=".55"/>
<stop offset=".45" stop-color="#fff" stop-opacity=".07"/>
<stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<radialGradient id="pl-{slug}" cx=".35" cy=".3" r=".8">
<stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#F0EDE6"/><stop offset="1" stop-color="#CFC7BB"/>
</radialGradient>
<radialGradient id="fl-{slug}" cx=".5" cy=".5" r=".5">
<stop offset="0" stop-color="#0B1F2C" stop-opacity=".22"/>
<stop offset="1" stop-color="#0B1F2C" stop-opacity="0"/>
</radialGradient>
</defs>'''


def floor(slug, cy=318, rx=132, ry=17):
    return f'<ellipse cx="200" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#fl-{slug})"/>'


def stitch(d, w=1.4, o=".38"):
    return (f'<path d="{d}" fill="none" stroke="#fff" stroke-opacity="{o}" '
            f'stroke-width="{w}" stroke-dasharray="5 6" stroke-linecap="round"/>')


# ---------------------------------------------------------------- silhouettes

def busta(s):
    return f'''{floor(s)}
<rect x="72" y="176" width="256" height="124" rx="16" fill="url(#bg-{s})"/>
<rect x="72" y="176" width="256" height="124" rx="16" fill="url(#sh-{s})"/>
<path d="M86 236q30 22 114 22t114-22v10q0 22-114 22T86 246z" fill="#0B1F2C" fill-opacity=".13"/>
<path d="M72 158a14 14 0 0 1 14-14h228a14 14 0 0 1 14 14v38q0 48-128 48T72 196z" fill="url(#bd-{s})"/>
<path d="M72 176q0 68 128 68t128-68v20q0 48-128 48T72 196z" fill="#0B1F2C" fill-opacity=".16"/>
{stitch("M88 206q26 30 112 30t112-30")}
<rect x="188" y="228" width="24" height="30" rx="9" fill="url(#hw-{s})"/>
<rect x="194" y="239" width="12" height="4" rx="2" fill="#0B1F2C" fill-opacity=".3"/>'''


def mezzaluna(s):
    return f'''{floor(s, 312, 112, 14)}
<path d="M126 180C126 92 274 92 274 180" fill="none" stroke="url(#hw-{s})" stroke-width="10" stroke-linecap="round"/>
<path d="M76 180c0 64 40 116 124 116s124-52 124-116z" fill="url(#bg-{s})"/>
<path d="M76 180c0 64 40 116 124 116s124-52 124-116z" fill="url(#sh-{s})"/>
<ellipse cx="200" cy="180" rx="124" ry="15" fill="url(#bd-{s})"/>
<ellipse cx="200" cy="179" rx="108" ry="9" fill="#0B1F2C" fill-opacity=".16"/>
{stitch("M94 216c62 22 150 22 212 0")}
<circle cx="126" cy="180" r="8" fill="url(#hw-{s})"/>
<circle cx="274" cy="180" r="8" fill="url(#hw-{s})"/>'''


def puffy(s):
    return f'''{floor(s, 314, 126, 16)}
<pattern id="q-{s}" width="34" height="34" patternUnits="userSpaceOnUse">
<path d="M0 0 34 34M0 34 34 0" stroke="#0B1F2C" stroke-opacity=".13" stroke-width="1.6" fill="none"/>
<path d="M2 0 36 34M2 34 36 0" stroke="#fff" stroke-opacity=".3" stroke-width="1.4" fill="none"/>
</pattern>
<path d="M150 150C150 96 250 96 250 150" fill="none" stroke="url(#hw-{s})" stroke-width="5" stroke-dasharray="9 5" stroke-linecap="round"/>
<rect x="68" y="146" width="264" height="152" rx="52" fill="url(#bg-{s})"/>
<rect x="68" y="146" width="264" height="152" rx="52" fill="url(#q-{s})"/>
<rect x="68" y="146" width="264" height="152" rx="52" fill="url(#sh-{s})"/>
<rect x="96" y="158" width="208" height="9" rx="4.5" fill="url(#hw-{s})"/>
<circle cx="200" cy="162" r="9" fill="url(#hw-{s})"/>'''


def perline(s):
    return f'''{floor(s, 316, 120, 15)}
<pattern id="q-{s}" width="17.2" height="17.2" patternUnits="userSpaceOnUse">
<g fill="#fff" fill-opacity=".26"><circle cx="4.3" cy="4.3" r="4"/><circle cx="12.9" cy="12.9" r="4"/></g>
<g fill="#fff" fill-opacity=".8"><circle cx="3.1" cy="3.1" r="1.4"/><circle cx="11.7" cy="11.7" r="1.4"/></g>
<g fill="#0B1F2C" fill-opacity=".14"><circle cx="5.9" cy="6.1" r="1.6"/><circle cx="14.5" cy="14.7" r="1.6"/></g>
</pattern>
<path d="M132 172C132 92 268 92 268 172" fill="none" stroke="url(#hw-{s})" stroke-width="4" stroke-dasharray="2 6" stroke-linecap="round"/>
<rect x="84" y="164" width="232" height="138" rx="18" fill="url(#bd-{s})"/>
<rect x="84" y="164" width="232" height="138" rx="18" fill="url(#q-{s})"/>
<rect x="84" y="164" width="232" height="138" rx="18" fill="url(#sh-{s})"/>
<rect x="84" y="162" width="232" height="15" rx="7.5" fill="url(#hw-{s})"/>
<circle cx="200" cy="169" r="10" fill="url(#hw-{s})"/>
<circle cx="200" cy="169" r="4" fill="#0B1F2C" fill-opacity=".22"/>'''


def onda(s):
    d = "M66 236c0-42 60-66 134-66s134 24 134 66-60 66-134 66S66 278 66 236z"
    return f'''{floor(s, 318, 126, 16)}
<path d="{d}" fill="url(#bg-{s})"/>
<path d="M66 226c0-40 60-56 134-56s134 16 134 56c-26 22-58 8-96-2s-84 34-124 20c-27-9-44-12-44-18z" fill="url(#bd-{s})" fill-opacity=".8"/>
<path d="{d}" fill="url(#sh-{s})"/>
<path d="M78 222c50 24 108-22 160-2 32 12 58 6 76-10" fill="none" stroke="url(#hw-{s})" stroke-width="3" stroke-linecap="round" opacity=".9"/>
{stitch("M80 234c50 24 108-22 160-2 32 12 58 6 76-10", 1.5, ".42")}
<rect x="176" y="163" width="48" height="11" rx="5.5" fill="url(#hw-{s})"/>'''


def pochette(s):
    def bez(t):
        x = (1 - t) ** 2 * 112 + 2 * (1 - t) * t * 200 + t * t * 288
        y = (1 - t) ** 2 * 188 + 2 * (1 - t) * t * 78 + t * t * 188
        return x, y
    pearls = ''.join(
        '<circle cx="%.1f" cy="%.1f" r="7.5" fill="url(#pl-%s)"/>' % (bez(i / 16.0) + (s,))
        for i in range(17))
    return f'''{floor(s, 320, 108, 14)}
{pearls}
<path d="M104 202c0-18 30-28 96-28s96 10 96 28v46c0 40-40 58-96 58s-96-18-96-58z" fill="url(#bg-{s})"/>
<path d="M104 202c0-18 30-28 96-28s96 10 96 28v46c0 40-40 58-96 58s-96-18-96-58z" fill="url(#sh-{s})"/>
<path d="M104 200q96-26 192 0v11q-96-26-192 0z" fill="url(#hw-{s})"/>
{stitch("M122 250q78 22 156 0")}
<circle cx="200" cy="178" r="15" fill="url(#pl-{s})"/>
<circle cx="195" cy="173" r="4" fill="#fff" fill-opacity=".9"/>'''


def rafia(s):
    d = ("M98 178h204c9 0 15 5 16 12l17 98c2 11-5 18-16 18H81c-11 0-18-7-16-18l17-98"
         "c1-7 7-12 16-12z")
    return f'''{floor(s, 320, 132, 16)}
<pattern id="q-{s}" width="11" height="8" patternUnits="userSpaceOnUse">
<path d="M0 1h11" stroke="#0B1F2C" stroke-opacity=".11" stroke-width="2.4"/>
<path d="M0 4h11" stroke="#fff" stroke-opacity=".3" stroke-width="1.6"/>
<path d="M5.5 0v5" stroke="#0B1F2C" stroke-opacity=".09" stroke-width="3.2"/>
</pattern>
<path d="M128 180C128 108 272 108 272 180" fill="none" stroke="#C9A87C" stroke-width="9" stroke-linecap="round"/>
<path d="M128 180C128 108 272 108 272 180" fill="none" stroke="#8E6E4A" stroke-opacity=".55" stroke-width="9" stroke-dasharray="3 22" stroke-linecap="round"/>
<path d="{d}" fill="url(#bg-{s})"/>
<path d="{d}" fill="url(#q-{s})"/>
<path d="{d}" fill="url(#sh-{s})"/>
<path d="M96 190h208" stroke="url(#hw-{s})" stroke-width="7" stroke-linecap="round"/>'''


def tonda(s):
    return f'''{floor(s, 340, 102, 13)}
<rect x="186" y="106" width="28" height="34" rx="8" fill="url(#hw-{s})"/>
<circle cx="200" cy="98" r="26" fill="none" stroke="url(#hw-{s})" stroke-width="9"/>
<circle cx="200" cy="232" r="104" fill="url(#bg-{s})"/>
<circle cx="200" cy="232" r="104" fill="url(#sh-{s})"/>
<path d="M101 200a104 104 0 0 1 198 0 99 24 0 0 1-198 0z" fill="url(#bd-{s})" fill-opacity=".92"/>
<path d="M101 200a99 24 0 0 0 198 0" fill="none" stroke="#0B1F2C" stroke-opacity=".16" stroke-width="2"/>
{stitch("M112 194a88 20 0 0 0 176 0")}
<circle cx="200" cy="232" r="88" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="1.2" stroke-dasharray="4 7"/>'''


SHAPES = {"busta": busta, "mezzaluna": mezzaluna, "puffy": puffy, "perline": perline,
          "onda": onda, "pochette": pochette, "rafia": rafia, "tonda": tonda}


def svg(p, uid=None, cls="bag__svg"):
    s = uid or p["slug"]
    body = SHAPES[p["shape"]](s)
    return (f'<svg class="{cls}" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="Clutch {p["name"]}, {p["tagline"]}">'
            f'{defs(s, p["hardware"])}{body}</svg>')
