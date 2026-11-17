import { Card, PageHeader } from "@/components/ui/primitives";
import { ProjectRequestForm } from "@/components/forms/client-forms";
import { getServices } from "@/lib/catalog";

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const services = (await getServices()).map((s) => ({ slug: s.slug, name: s.name }));
  return (
    <>
      <PageHeader title="New project request" description="Share your requirements. We'll reply with questions or a written quotation." />
      <Card className="max-w-3xl p-6 sm:p-8"><ProjectRequestForm services={services} defaultService={service} /></Card>
    </>
  );
}
