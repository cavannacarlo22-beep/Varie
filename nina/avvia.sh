#!/usr/bin/env bash
# FILE: nina/avvia.sh
#
# Mette in piedi Nina con un comando solo.
#
#   cd nina
#   ./avvia.sh
#
# Cosa fa, in ordine: controlla che ci siano Node e npm, prepara il file dei
# segreti, ne genera due sicuri, installa le dipendenze, crea le tabelle sul
# database, crea l'account amministratore e accende il backend. Se c'è
# XcodeGen genera anche il progetto Xcode.
#
# Due regole che questo script rispetta e che vale la pena conoscere:
#
#   · **si può rieseguire quante volte si vuole.** Ogni passo controlla se è
#     già stato fatto e in quel caso lo salta. Non sovrascrive mai un file
#     .env esistente e non rigenera segreti già presenti: rigenerarli
#     scollegherebbe tutte le sessioni aperte.
#
#   · **non stampa mai un segreto.** La stringa del database si incolla senza
#     che compaia a schermo, e la conferma mostra solo l'indirizzo con la
#     password mascherata. Quello che finisce nel terminale resta nella
#     cronologia, e la cronologia non è un posto per le password.
#
# Se qualcosa va storto, docs/TROUBLESHOOTING.md ha l'errore con la
# traduzione in italiano e cosa fare.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

RADICE="$PWD"
BACKEND="$RADICE/backend"
IOS="$RADICE/ios"
ENV_FILE="$BACKEND/.env"
ESEMPIO="$BACKEND/.env.example"

# --- Aspetto ---------------------------------------------------------------
# I colori solo se il terminale è davvero un terminale: se l'output finisce in
# un file, i codici di escape lo renderebbero illeggibile.

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  ROSA=$'\033[38;5;211m'; VERDE=$'\033[32m'; GIALLO=$'\033[33m'
  ROSSO=$'\033[31m'; TENUE=$'\033[2m'; GRASSETTO=$'\033[1m'; FINE=$'\033[0m'
else
  ROSA=''; VERDE=''; GIALLO=''; ROSSO=''; TENUE=''; GRASSETTO=''; FINE=''
fi

PASSO=0
passo()  { PASSO=$((PASSO + 1)); printf '\n%s%s[%d/8]%s %s%s%s\n' "$GRASSETTO" "$ROSA" "$PASSO" "$FINE" "$GRASSETTO" "$1" "$FINE"; }
ok()     { printf '      %s✓%s %s\n' "$VERDE" "$FINE" "$1"; }
salto()  { printf '      %s·%s %s\n' "$TENUE" "$FINE" "$1"; }
avviso() { printf '      %s!%s %s\n' "$GIALLO" "$FINE" "$1"; }
info()   { printf '      %s%s%s\n' "$TENUE" "$1" "$FINE"; }

muori() {
  printf '\n%s%s✗ %s%s\n' "$GRASSETTO" "$ROSSO" "$1" "$FINE" >&2
  shift
  for riga in "$@"; do printf '  %s\n' "$riga" >&2; done
  printf '\n  %sSe non capisci l'\''errore, cerca il messaggio in docs/TROUBLESHOOTING.md%s\n\n' "$TENUE" "$FINE" >&2
  exit 1
}

# Vero solo se possiamo davvero fare domande a qualcuno.
interattivo() { [ -t 0 ] && [ -t 1 ]; }

chiedi_si_no() {
  local domanda="$1" predefinita="${2:-s}" risposta
  if ! interattivo; then return 1; fi
  local suffisso='[S/n]'
  [ "$predefinita" = "n" ] && suffisso='[s/N]'
  printf '      %s %s ' "$domanda" "$suffisso"
  read -r risposta || risposta=''
  risposta="${risposta:-$predefinita}"
  [[ "$risposta" =~ ^([sS]|[yY])$ ]]
}

# --- Lettura e scrittura del file .env -------------------------------------
#
# Niente sed: la stringa di connessione contiene / e & e spesso caratteri che
# sed interpreterebbe. Riscrivere il file riga per riga non ha questo problema
# e non richiede nessun escape.

leggi_variabile() {
  local nome="$1"
  [ -f "$ENV_FILE" ] || return 0
  local riga
  while IFS= read -r riga || [ -n "$riga" ]; do
    case "$riga" in
      "$nome"=*) printf '%s' "${riga#*=}"; return 0 ;;
    esac
  done < "$ENV_FILE"
}

imposta_variabile() {
  local nome="$1" valore="$2" trovata=0 riga
  local tmp; tmp="$(mktemp)"

  if [ -f "$ENV_FILE" ]; then
    while IFS= read -r riga || [ -n "$riga" ]; do
      case "$riga" in
        "$nome"=*) printf '%s=%s\n' "$nome" "$valore" >> "$tmp"; trovata=1 ;;
        *)         printf '%s\n' "$riga" >> "$tmp" ;;
      esac
    done < "$ENV_FILE"
  fi

  [ "$trovata" -eq 0 ] && printf '%s=%s\n' "$nome" "$valore" >> "$tmp"

  mv "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

# Una stringa di connessione con la password sostituita da asterischi, per
# poterla mostrare senza rivelarla.
maschera_url() {
  printf '%s' "$1" | sed -E 's#(://[^:/@]+):[^@]*@#\1:••••••@#'
}

# Il valore è ancora il segnaposto di .env.example?
e_segnaposto() {
  case "$1" in
    ''|*utente:password*|*ep-xxxx*) return 0 ;;
    *) return 1 ;;
  esac
}

genera_segreto() {
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
}

# ---------------------------------------------------------------------------

printf '\n%s%s  Nina%s %s— installazione%s\n' "$GRASSETTO" "$ROSA" "$FINE" "$TENUE" "$FINE"
printf '  %sQuesto script si può rieseguire: salta da solo i passi già fatti.%s\n' "$TENUE" "$FINE"

# --- 1. Prerequisiti -------------------------------------------------------

passo "Controllo cosa c'è installato"

command -v node >/dev/null 2>&1 || muori \
  "Node.js non è installato." \
  "Serve la versione 20.11 o superiore." \
  "" \
  "  Su Mac, il modo più semplice:" \
  "    brew install node" \
  "" \
  "  Senza Homebrew, scarica l'installer da https://nodejs.org (versione LTS)."

VERSIONE_NODE="$(node -v)"                     # per esempio v22.11.0
NUMERO="${VERSIONE_NODE#v}"
MAGGIORE="${NUMERO%%.*}"
RESTO="${NUMERO#*.}"
MINORE="${RESTO%%.*}"

if [ "$MAGGIORE" -lt 20 ] || { [ "$MAGGIORE" -eq 20 ] && [ "$MINORE" -lt 11 ]; }; then
  muori "Node.js $VERSIONE_NODE è troppo vecchio." \
        "Serve la 20.11 o superiore. Aggiorna con: brew upgrade node"
fi
ok "Node.js $VERSIONE_NODE"

command -v npm >/dev/null 2>&1 || muori \
  "npm non è installato." \
  "Di solito arriva insieme a Node: prova a reinstallare Node."
ok "npm $(npm -v)"

[ -f "$BACKEND/package.json" ] || muori \
  "Non trovo il backend." \
  "Questo script va eseguito dalla cartella 'nina':" \
  "" \
  "    cd nina && ./avvia.sh"

# --- 2. Il file dei segreti ------------------------------------------------

passo "Preparo il file della configurazione"

if [ -f "$ENV_FILE" ]; then
  salto "backend/.env esiste già: non lo tocco."
else
  [ -f "$ESEMPIO" ] || muori "Manca backend/.env.example: il repository è incompleto."
  cp "$ESEMPIO" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "Creato backend/.env da .env.example"
fi

# --- 3. La stringa del database --------------------------------------------

passo "Collegamento al database"

URL_ATTUALE="$(leggi_variabile DATABASE_URL)"

if ! e_segnaposto "$URL_ATTUALE"; then
  salto "Già configurato: $(maschera_url "$URL_ATTUALE")"
else
  if ! interattivo; then
    muori "Manca la stringa di connessione al database." \
          "Apri backend/.env e compila la riga DATABASE_URL=" \
          "Come ottenerla: docs/NEON_SETUP.md, passi da 1 a 4."
  fi

  printf '\n'
  info "Serve la stringa di connessione di Neon. Si prende dalla dashboard,"
  info "riquadro «Connection string», con «Pooled connection» spuntato."
  info "Comincia per postgresql:// e finisce per ?sslmode=require"
  info ""
  info "Non comparirà a schermo mentre la incolli: contiene una password,"
  info "e quello che si scrive nel terminale resta nella cronologia."
  printf '\n      Incolla la stringa e premi invio: '

  read -rs NUOVO_URL || NUOVO_URL=''
  printf '\n'

  # Gli a capo e gli spazi che si portano dietro i copia-incolla dal browser.
  NUOVO_URL="$(printf '%s' "$NUOVO_URL" | tr -d '\r\n' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"

  case "$NUOVO_URL" in
    postgresql://*|postgres://*) : ;;
    '') muori "Non hai incollato niente." "Riprova: ./avvia.sh" ;;
    *)  muori "Quella non sembra una stringa di connessione." \
              "Deve cominciare per postgresql:// — ricontrolla di aver copiato tutto." ;;
  esac

  case "$NUOVO_URL" in
    *sslmode=require*) : ;;
    *) avviso "La stringa non contiene ?sslmode=require — Neon lo pretende."
       avviso "La salvo lo stesso, ma se il collegamento fallisce è questo." ;;
  esac

  imposta_variabile DATABASE_URL "$NUOVO_URL"
  ok "Salvata in backend/.env: $(maschera_url "$NUOVO_URL")"
fi

# --- 4. I due segreti ------------------------------------------------------

passo "Segreti per le sessioni"

SEGRETO_1="$(leggi_variabile JWT_SECRET)"
SEGRETO_2="$(leggi_variabile JWT_REFRESH_SECRET)"

if [ -n "$SEGRETO_1" ] && [ -n "$SEGRETO_2" ] && [ "$SEGRETO_1" != "$SEGRETO_2" ]; then
  salto "Già presenti. Non li rigenero: cambiarli chiuderebbe tutte le sessioni aperte."
else
  imposta_variabile JWT_SECRET "$(genera_segreto)"
  imposta_variabile JWT_REFRESH_SECRET "$(genera_segreto)"
  ok "Generati due segreti da 48 byte casuali, diversi fra loro."
  info "Sono in backend/.env, che è escluso da git e leggibile solo da te."
fi

# --- 5. Dipendenze ---------------------------------------------------------

passo "Installo le librerie del backend"

cd "$BACKEND"

if [ -d node_modules ] && [ package-lock.json -ot node_modules ]; then
  salto "Già installate e aggiornate."
else
  info "La prima volta ci mette un paio di minuti."
  npm install --no-audit --no-fund
  ok "Librerie installate."
fi

# --- 6. Tabelle del database -----------------------------------------------

passo "Creo le tabelle sul database"

info "La prima richiesta può metterci qualche secondo: nel piano gratuito"
info "Neon mette in pausa i database inattivi e va risvegliato."

if ! npm run --silent migrate; then
  muori "Non sono riuscito a creare le tabelle." \
        "Quasi sempre è la stringa di connessione." \
        "" \
        "  Controlla su docs/TROUBLESHOOTING.md, sezione «Il database»." \
        "  Per correggere la stringa: apri backend/.env e cambia la riga DATABASE_URL="
fi
ok "Schema del database aggiornato."

# --- 7. Amministratrice ----------------------------------------------------

passo "Account amministratore"

if ! interattivo; then
  salto "Serve un terminale interattivo. Eseguilo a mano: cd backend && npm run create-admin"
elif chiedi_si_no "Vuoi creare (o aggiornare) l'amministratrice adesso?" s; then
  printf '\n'
  info "La password si digita qui sotto e non comparirà a schermo."
  info "Non finisce in nessun file: nel database va solo la sua impronta."
  printf '\n'
  npm run --silent create-admin
  ok "Fatto."
else
  salto "Saltato. Quando vuoi: cd backend && npm run create-admin"
fi

# --- 8. Progetto Xcode -----------------------------------------------------

passo "Progetto Xcode"

if [ "$(uname -s)" != "Darwin" ]; then
  salto "Non siamo su un Mac: l'app iOS si compila solo lì. Il backend però funziona."
elif ! command -v xcodegen >/dev/null 2>&1; then
  avviso "XcodeGen non è installato, quindi il progetto non l'ho generato."
  info "Installalo con:  brew install xcodegen"
  info "poi:             cd ios && xcodegen generate"
else
  ( cd "$IOS" && xcodegen generate >/dev/null )
  ok "Generato ios/Nina.xcodeproj"
  info "Aprilo con: open ios/Nina.xcodeproj"
fi

# --- Fine ------------------------------------------------------------------

printf '\n%s%s  Pronto.%s\n\n' "$GRASSETTO" "$VERDE" "$FINE"
printf '  %sBackend%s        cd backend && npm run dev\n' "$GRASSETTO" "$FINE"
printf '  %sDocumentazione%s http://localhost:3000/docs  (a backend acceso)\n' "$GRASSETTO" "$FINE"
printf '  %sStato%s          curl http://localhost:3000/health\n' "$GRASSETTO" "$FINE"

if [ "$(uname -s)" = "Darwin" ]; then
  printf '  %sApp%s            open ios/Nina.xcodeproj, poi il tasto ▶\n' "$GRASSETTO" "$FINE"
fi

printf '\n'

if interattivo && chiedi_si_no "Avvio il backend adesso?" s; then
  printf '\n  %sPer fermarlo: Ctrl+C%s\n\n' "$TENUE" "$FINE"
  exec npm run dev
fi

printf '\n'
