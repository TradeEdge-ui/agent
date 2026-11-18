import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config";
import { getServices } from "@/lib/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths = ["", "/services", "/pricing", "/portfolio", "/about", "/faq", "/contact", "/get-quote", "/book", "/legal/terms", "/legal/privacy", "/legal/refund"];
  let services: { slug: string }[] = [];
  try {
    services = await getServices();
  } catch {
    services = [];
  }
  return [
    ...staticPaths.map((p) => ({
      url: `${siteConfig.url}${p}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : p.startsWith("/legal") ? 0.3 : 0.8,
    })),
    ...services.map((s) => ({ url: `${siteConfig.url}/services/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
