import "server-only";
import catalogJson from "@/content/catalog.json";
import { createPublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { Service, ServiceCategory } from "@/lib/types";

/** Offline fallback used only when Supabase is not configured (local preview / CI). */
export const DEFAULT_SERVICES: Service[] = catalogJson.services.map((s, i) => ({
  id: `default-${i}`,
  slug: s.slug,
  category: s.category as ServiceCategory,
  name: s.name,
  tagline: s.tagline ?? null,
  description: s.description ?? null,
  price_min_cents: s.price_min_cents,
  price_max_cents: s.price_max_cents,
  price_notes: (s as { price_notes?: string }).price_notes ?? null,
  billing_type: s.billing_type as Service["billing_type"],
  purchase_mode: s.purchase_mode as Service["purchase_mode"],
  deposit_percent: s.deposit_percent,
  deliverables: s.deliverables,
  exclusions: s.exclusions,
  revisions_included: s.revisions_included,
  timeline_text: s.timeline_text ?? null,
  is_featured: s.is_featured,
  is_active: true,
  sort_order: s.sort_order,
}));

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  website: "Website Development",
  ai: "AI Solutions",
  maintenance: "Monthly Care Plans",
};

export async function getServices(): Promise<Service[]> {
  if (!isSupabaseConfigured()) return DEFAULT_SERVICES;
  const supabase = createPublicClient()!;
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Could not load services: ${error.message}`);
  return (data ?? []) as Service[];
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const all = await getServices();
  return all.find((s) => s.slug === slug) ?? null;
}

export function groupByCategory(services: Service[]): Record<ServiceCategory, Service[]> {
  return {
    website: services.filter((s) => s.category === "website"),
    ai: services.filter((s) => s.category === "ai"),
    maintenance: services.filter((s) => s.category === "maintenance"),
  };
}
