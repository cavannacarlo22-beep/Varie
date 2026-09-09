// FILE: backend/src/routes/pages.ts
//
// Le uniche due pagine HTML del backend: quelle che si aprono cliccando un link
// ricevuto per email. Tutto il resto dell'API è JSON.
//
// Non usano CSS o script esterni — nessuna richiesta verso terzi da una pagina
// che tratta una password — e seguono il tema chiaro/scuro del dispositivo.

/** Escape del testo inserito nell'HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE = `
  :root {
    color-scheme: light dark;
    --rosa: #E96A95;
    --rosa-chiaro: #FCE4EC;
    --sfondo: #FFF9FB;
    --carta: #FFFFFF;
    --testo: #30252A;
    --tenue: #B88A9A;
    --bordo: #F3D9E2;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --rosa: #FF9DBB;
      --rosa-chiaro: #3A2A31;
      --sfondo: #171114;
      --carta: #221A1E;
      --testo: #F6EAEF;
      --tenue: #B08D9B;
      --bordo: #3A2A31;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    background: var(--sfondo); color: var(--testo);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
  }
  .carta {
    width: 100%; max-width: 420px; background: var(--carta); border-radius: 24px;
    padding: 36px 32px; border: 1px solid var(--bordo);
    box-shadow: 0 8px 40px rgba(233, 106, 149, .10);
  }
  h1 { font-size: 26px; margin: 0 0 12px; color: var(--rosa); letter-spacing: -.02em; }
  p  { margin: 0 0 20px; font-size: 16px; }
  .tenue { color: var(--tenue); font-size: 14px; }
  label { display: block; font-size: 14px; font-weight: 600; margin: 0 0 8px; }
  input {
    width: 100%; padding: 14px 16px; font-size: 16px; border-radius: 14px;
    border: 1.5px solid var(--bordo); background: var(--sfondo); color: var(--testo);
    margin-bottom: 16px; font-family: inherit;
  }
  input:focus { outline: none; border-color: var(--rosa); }
  button {
    width: 100%; padding: 15px; font-size: 16px; font-weight: 600; color: #fff;
    background: var(--rosa); border: none; border-radius: 999px; cursor: pointer;
    font-family: inherit;
  }
  button:disabled { opacity: .55; cursor: default; }
  .avviso { font-size: 14px; padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; display: none; }
  .avviso.errore { display: block; background: var(--rosa-chiaro); color: var(--rosa); }
  .avviso.ok     { display: block; background: var(--rosa-chiaro); color: var(--rosa); }
  .cuore { font-size: 40px; margin: 0 0 8px; }
`;

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · Nina</title>
<style>${STYLE}</style>
</head>
<body>
<main class="carta">
${bodyHtml}
</main>
</body>
</html>`;
}

export function resultPage(title: string, message: string, success: boolean): string {
  return shell(
    title,
    `<p class="cuore">${success ? '💗' : '😅'}</p>
     <h1>${escapeHtml(title)}</h1>
     <p>${escapeHtml(message)}</p>`,
  );
}

export function resetPasswordPage(token: string, minLength: number): string {
  // Il token viaggia in un attributo data-, non dentro il JavaScript: così lo
  // script può stare in un file separato e la Content-Security-Policy può
  // vietare del tutto gli script inline invece di autorizzarli.
  return shell(
    'Nuova password',
    `<h1>Scegli una nuova password</h1>
     <p class="tenue">Dev'essere lunga almeno ${minLength} caratteri. Una frase che ricordi facilmente va benissimo.</p>

     <div id="avviso" class="avviso"></div>

     <form id="form" autocomplete="on" data-token="${escapeHtml(token)}">
       <label for="pw">Nuova password</label>
       <input id="pw" name="new-password" type="password" autocomplete="new-password"
              minlength="${minLength}" required>

       <label for="pw2">Ripetila</label>
       <input id="pw2" name="confirm-password" type="password" autocomplete="new-password"
              minlength="${minLength}" required>

       <button id="invia" type="submit">Salva la nuova password</button>
     </form>

     <script src="/auth/reset-password.js" defer></script>`,
  );
}

/** Lo script della pagina di reset, servito come file a sé. */
export const RESET_PASSWORD_SCRIPT = `(function () {
  var form   = document.getElementById('form');
  var avviso = document.getElementById('avviso');
  var invia  = document.getElementById('invia');
  var token  = form.getAttribute('data-token');

  function mostra(testo, tipo) {
    avviso.textContent = testo;
    avviso.className = 'avviso ' + tipo;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var pw  = document.getElementById('pw').value;
    var pw2 = document.getElementById('pw2').value;

    if (pw !== pw2) {
      mostra('Le due password non coincidono.', 'errore');
      return;
    }

    invia.disabled = true;
    invia.textContent = 'Un attimo…';

    fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, newPassword: pw })
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          form.style.display = 'none';
          mostra('Fatto! Ora puoi accedere dall\\'app con la nuova password 💗', 'ok');
          return;
        }
        var messaggio = (result.data && result.data.error && result.data.error.message)
          ? result.data.error.message
          : 'Non ha funzionato. Riprova.';
        mostra(messaggio, 'errore');
        invia.disabled = false;
        invia.textContent = 'Salva la nuova password';
      })
      .catch(function () {
        mostra('Non riesco a raggiungere il server. Controlla la connessione.', 'errore');
        invia.disabled = false;
        invia.textContent = 'Salva la nuova password';
      });
  });
})();
`;
