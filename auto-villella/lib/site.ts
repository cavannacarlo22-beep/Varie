// ⚠️ Dati dell'attività: SOSTITUIRE i valori segnaposto prima di andare online.
export const site = {
  name: "Auto Villella",
  tagline: "Auto selezionate, garantite e pronte a partire.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.autovillella.it",
  phone: "+39 000 000 0000", // TODO numero reale
  phoneHref: "tel:+390000000000",
  whatsapp: "390000000000", // TODO numero WhatsApp senza + e spazi
  email: "info@autovillella.it", // TODO
  address: "Via Esempio 1", // TODO
  city: "00000 Città (XX)", // TODO
  mapsQuery: "Auto Villella", // testo cercato su Google Maps
  vat: "P.IVA 00000000000", // TODO
  hours: [
    { days: "Lunedì – Venerdì", time: "9:00 – 13:00 · 15:00 – 19:30" },
    { days: "Sabato", time: "9:00 – 13:00" },
    { days: "Domenica", time: "Chiuso" },
  ],
};

export const FUELS = ["Benzina", "Diesel", "Ibrida", "Ibrida plug-in", "Elettrica", "GPL", "Metano"] as const;
export const GEARBOXES = ["Manuale", "Automatico"] as const;
export const BODIES = ["City car", "Berlina", "SUV", "Station wagon", "Monovolume", "Coupé", "Cabrio", "Commerciale"] as const;
export const STATUSES = ["disponibile", "riservato", "venduto"] as const;
