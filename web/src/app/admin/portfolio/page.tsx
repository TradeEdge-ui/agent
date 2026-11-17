import { PortfolioForm } from "@/components/admin/forms";
import { SectionTitle } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { deletePortfolioItem } from "@/actions/admin";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioItem } from "@/lib/types";

export default async function AdminPortfolioPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("portfolio_items").select("*").order("sort_order");
  const items = (data ?? []) as PortfolioItem[];
  return (
    <>
      <PageHeader title="Portfolio" description="Only add work you actually delivered. Named client projects need the client's permission." />
      <Alert tone="info" className="mb-6">Tip: after each project, ask the client for permission to feature it and for a short testimonial from their dashboard.</Alert>
      <Card><SectionTitle>Add project</SectionTitle><PortfolioForm /></Card>
      <div className="mt-8 space-y-6">
        {items.map((it) => (
          <Card key={it.id}>
            <PortfolioForm item={it} />
            <form action={deletePortfolioItem} className="mt-3"><input type="hidden" name="id" value={it.id} /><Button type="submit" variant="ghost" size="sm">Delete</Button></form>
          </Card>
        ))}
      </div>
    </>
  );
}
