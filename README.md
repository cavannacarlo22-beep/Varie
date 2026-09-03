# UI/UX Pro Max — installazione e uso in qualsiasi cartella

Questo repo contiene il bundle di skill [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
(v2.13.0) e gli script per renderlo disponibile **in ogni cartella, in ogni sessione**.

Le 7 skill incluse:

| Skill | Cosa fa |
|---|---|
| `ui-ux-pro-max` | Motore principale: ricerca locale su stili, palette, font pairing, chart, stack |
| `design` | Design system generation, reasoning engine |
| `design-system` | Token architecture (primitive → semantic → component), component spec |
| `ui-styling` | shadcn/ui, Tailwind, temi, dark mode, componenti accessibili |
| `brand` | Brand voice, identità visiva, messaging framework |
| `banner-design` | Banner per social, ads, hero, print |
| `slides` | Presentazioni HTML con Chart.js e design token |

## Prerequisito

Python 3.x, usato dallo script di ricerca (solo standard library, nessuna
richiesta di rete, non installa nulla).

```bash
python3 --version
```

## Come averla in qualsiasi cartella

Il punto chiave: una skill è disponibile **in ogni cartella** solo se sta a
livello utente (`~/.claude/skills/`) o a livello account. Se sta solo in
`<progetto>/.claude/skills/`, vale solo per quel progetto.

Sotto, le opzioni dalla più ampia alla più locale. Scegline una: non serve
farle tutte.

### 1. A livello account — vale su tutti i dispositivi e sul web

Il modo più durevole: la skill viene sincronizzata in ogni sessione di Claude
Code, su qualsiasi macchina e in qualsiasi cartella, senza reinstallarla.

```bash
./scripts/package-skills.sh          # genera dist/*.zip
```

Poi su [claude.ai](https://claude.ai) → **Settings → Capabilities → Skills** →
carica `dist/ui-ux-pro-max.zip` (e, se le vuoi, gli altri zip in `dist/`).

### 2. A livello utente sulla macchina locale — vale in ogni cartella di quel PC

```bash
npm install -g ui-ux-pro-max-cli
uipro init --ai claude --global      # installa in ~/.claude/skills/
```

Oppure, senza npm, partendo da questo repo (funziona offline):

```bash
git clone https://github.com/cavannacarlo22-beep/Varie.git
cd Varie
./.claude/hooks/session-start.sh     # copia le 7 skill in ~/.claude/skills/
```

### 3. Come plugin del marketplace — vale in ogni cartella

Da dentro Claude Code, due comandi:

```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

### 4. Sessioni remote di questo repo — automatico

`.claude/settings.json` registra un hook `SessionStart` che esegue
`.claude/hooks/session-start.sh`: a ogni avvio di sessione copia le skill di
questo repo in `~/.claude/skills/`, così valgono anche fuori dal progetto.

Serve perché i container di Claude Code sul web sono effimeri: senza l'hook,
l'installazione globale andrebbe persa a ogni nuova sessione.

L'hook è **idempotente** — confronta un hash del contenuto e ricopia solo se
qualcosa è cambiato. Se non trova le skill nel repo, ripiega su
`npx ui-ux-pro-max-cli init --ai claude --global`.

Per disattivarlo:

```bash
export UIPM_SKIP_GLOBAL_INSTALL=1
```

> L'hook diventa attivo per tutte le sessioni future una volta unito nel branch
> di default del repo.

## Verificare che funzioni

```bash
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "landing page saas"
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "ecommerce color palette"
```

Da dentro Claude Code basta chiedere in linguaggio naturale, la skill si attiva
da sola — per esempio: *"costruisci una landing page per una SaaS"*.

## Aggiornare

```bash
uipro update --global                            # se hai installato via npm
# oppure: aggiorna la copia nel repo e riesegui
npx ui-ux-pro-max-cli@latest init --ai claude    # rigenera .claude/skills/
./.claude/hooks/session-start.sh                 # risincronizza ~/.claude/skills/
```

## Test

Il bundle include la sua suite di test:

```bash
cd .claude/skills/ui-ux-pro-max/scripts
python3 -m unittest discover -s tests -p "test_*.py"
```

`test_relevance_evaluator` e `test_catalog_refresh` danno errore di import: sono
test da maintainer, richiedono script (`evaluate-relevance.py`,
`refresh-google-fonts.py`, `refresh-icon-catalog.py`) che il CLI
volutamente non include nel bundle distribuito. Gli altri 130 passano.

## Struttura

```
.claude/
  settings.json               hook SessionStart
  hooks/session-start.sh      installer idempotente verso ~/.claude/skills/
  skills/                     le 7 skill (fonte di verità per gli script sopra)
scripts/
  package-skills.sh           genera gli zip per l'upload a livello account
```

## Licenza

Le skill sono di [nextlevelbuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
distribuite con licenza MIT.
