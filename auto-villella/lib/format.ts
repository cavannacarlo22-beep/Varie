const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("it-IT");

export const formatPrice = (n: number) => eur.format(n);
export const formatKm = (n: number) => `${num.format(n)} km`;
export const formatNumber = (n: number) => num.format(n);
export const formatDate = (d: string) =>
  new Date(d).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function vehicleTitle(v: { brand: string; model: string }) {
  return `${v.brand} ${v.model}`;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Rata mensile di un finanziamento alla francese. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}
