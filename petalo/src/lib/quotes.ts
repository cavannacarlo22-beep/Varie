/** Short motivational lines (original, unattributed). */
export const QUOTES = [
  'Un passo alla volta, ma ogni giorno.',
  'Studia con calma: la costanza batte la fretta.',
  'Oggi fai qualcosa di cui la te di domani ti ringrazierà.',
  'Non serve essere perfetta, serve iniziare.',
  'Ogni pagina che scrivi è un pezzo di futuro.',
  'Piccoli progressi restano progressi.',
  'Respira. Hai già superato giornate difficili.',
  'La tua strada ha il tuo ritmo: rispettalo.',
  'Prima il caffè, poi il mondo.',
  'Un esame alla volta, un sogno alla volta.',
  'Sii gentile con te stessa anche nei giorni no.',
  'Le cose belle richiedono tempo — e tu stai costruendo qualcosa di bello.',
  'Organizzata non vuol dire rigida: vuol dire libera.',
  'Fai spazio a ciò che conta.',
  'Credi nel lavoro silenzioso di ogni giorno.',
  'Oggi basta fare bene una cosa.',
  'Anche le pause fanno parte del percorso.',
  'Sei più capace di quanto pensi.',
  'Chiudi un capitolo, aprine uno migliore.',
  'Il tuo impegno di oggi è la tua tranquillità di domani.',
];

export function quoteOfDay(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const day = Math.floor((date.getTime() - start) / 86400000);
  return QUOTES[day % QUOTES.length];
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}
