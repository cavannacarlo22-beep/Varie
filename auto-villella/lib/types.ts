export type VehicleStatus = "disponibile" | "riservato" | "venduto";

export type Vehicle = {
  id: number;
  slug: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  km: number;
  fuel: string;
  gearbox: string;
  power_cv: number | null;
  body: string;
  color: string | null;
  doors: number | null;
  seats: number | null;
  price: number;
  price_old: number | null;
  description: string | null;
  features: string[];
  images: string[];
  featured: boolean;
  status: VehicleStatus;
  created_at: string;
};

export type Lead = {
  id: number;
  vehicle_id: number | null;
  vehicle_label: string | null;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  read: boolean;
  created_at: string;
};

export type VehicleFilters = {
  q?: string;
  brand?: string;
  fuel?: string;
  gearbox?: string;
  body?: string;
  maxPrice?: number;
  maxKm?: number;
  minYear?: number;
  sort?: "recenti" | "prezzo-asc" | "prezzo-desc" | "km-asc" | "anno-desc";
};
