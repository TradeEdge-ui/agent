import { notFound } from "next/navigation";
import { ServiceEditor } from "@/components/admin/service-editor";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/lib/types";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = data as Service;
  return (
    <>
      <PageHeader title={`Edit: ${s.name}`} actions={<ButtonLink href={`/services/${s.slug}`} variant="secondary" size="sm" target="_blank">View on site</ButtonLink>} />
      <ServiceEditor service={s} />
    </>
  );
}
