import { InvoiceEditor } from "@/components/admin/invoice-editor";
import { PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/settings";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const settings = await getBusinessSettings();
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,company_name").eq("role", "client").order("full_name"),
    supabase.from("projects").select("id,name,client_id").order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="New invoice" description="For change requests, extra work or ad-hoc billing. Project instalments are created automatically from accepted quotations." />
      <InvoiceEditor
        clients={(clients ?? []).map((c) => ({ id: c.id, label: `${c.full_name ?? c.email}${c.company_name ? ` (${c.company_name})` : ""}` }))}
        projects={projects ?? []}
        defaultClient={sp.client}
        defaultTaxRate={settings.sst_registered ? Number(settings.sst_rate) : 0}
      />
    </>
  );
}
