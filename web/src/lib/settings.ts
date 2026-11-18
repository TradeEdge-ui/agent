import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { DEFAULT_BOOKING_CONFIG } from "@/lib/booking";
import type { BusinessSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: BusinessSettings = {
  id: 1,
  business_name: "ARyzz AI Solutions",
  legal_name: null,
  registration_no: null,
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
  phone: null,
  whatsapp: null,
  address: null,
  bank_name: null,
  bank_account_name: null,
  bank_account_no: null,
  duitnow_id: null,
  sst_registered: false,
  sst_number: null,
  sst_rate: 0,
  invoice_due_days: 7,
  quote_validity_days: 14,
  invoice_footer: null,
  booking_config: DEFAULT_BOOKING_CONFIG,
  auto_payment_reminders: true,
};

export const getBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  const supabase = createPublicClient();
  if (!supabase) return DEFAULT_SETTINGS;
  const { data } = await supabase.from("business_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    sst_rate: Number(data.sst_rate),
    booking_config: { ...DEFAULT_BOOKING_CONFIG, ...(data.booking_config ?? {}) },
  } as BusinessSettings;
});

export function whatsappLink(number: string | null | undefined, text?: string): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
