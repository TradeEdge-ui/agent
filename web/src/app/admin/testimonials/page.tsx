import { TestimonialAdminForm } from "@/components/admin/forms";
import { SectionTitle } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { deleteTestimonial, setTestimonialPublished } from "@/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import type { Testimonial } from "@/lib/types";

export default async function AdminTestimonialsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false });
  const items = (data ?? []) as Testimonial[];
  return (
    <>
      <PageHeader title="Testimonials" description="Genuine testimonials only. Publishing requires recorded client consent (enforced by the database)." />
      <div className="space-y-4">
        {items.length === 0 && <EmptyState title="No testimonials yet">Clients can submit one from their profile after a project is completed.</EmptyState>}
        {items.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-fg">{t.author_name}</p>
              <span className="text-sm text-muted">{[t.author_title, t.company].filter(Boolean).join(", ")}</span>
              {t.rating && <Badge>{t.rating}/5</Badge>}
              {t.is_published ? <Badge tone="success">published</Badge> : <Badge>not published</Badge>}
              {t.submitted_by ? <Badge tone="info">submitted by client</Badge> : <Badge>added by admin</Badge>}
              <span className="text-xs text-subtle">{formatDate(t.created_at)}</span>
            </div>
            <blockquote className="mt-3 text-sm text-fg">“{t.quote}”</blockquote>
            <div className="mt-4 flex gap-2">
              <form action={setTestimonialPublished}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="publish" value={t.is_published ? "false" : "true"} />
                <Button type="submit" size="sm" variant={t.is_published ? "secondary" : "primary"} disabled={!t.consent_to_publish}>{t.is_published ? "Unpublish" : "Publish"}</Button>
              </form>
              <form action={deleteTestimonial}><input type="hidden" name="id" value={t.id} /><Button type="submit" size="sm" variant="ghost">Delete</Button></form>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-8"><SectionTitle>Add a testimonial you received</SectionTitle><TestimonialAdminForm /></Card>
    </>
  );
}
