import raw from "@/data/demo-vehicles.json";
import type { Vehicle } from "./types";
import { slugify } from "./format";

type Raw = (typeof raw)[number];

export const demoVehicles: Vehicle[] = (raw as Raw[]).map((v, i) => ({
  ...v,
  id: i + 1,
  slug: `${slugify(`${v.brand} ${v.model} ${v.year}`)}-${i + 1}`,
  images: [],
  status: "disponibile",
  created_at: new Date(Date.UTC(2026, 10, 20 - i)).toISOString(),
}));
