import type { MetadataRoute } from "next";
import { getVehicles } from "@/lib/vehicles";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vehicles = await getVehicles();
  const pages = ["", "/veicoli", "/servizi", "/chi-siamo", "/contatti"].map((p) => ({ url: `${site.url}${p}` }));
  return [...pages, ...vehicles.map((v) => ({ url: `${site.url}/veicoli/${v.slug}`, lastModified: v.created_at }))];
}
