import { ProfileForm, TestimonialForm } from "@/components/forms/client-forms";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("id,name,status").eq("client_id", user.id);
  const completed = (projects ?? []).filter((p) => p.status === "completed");
  return (
    <>
      <PageHeader title="Profile" description={user.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-5 font-semibold text-fg">Your details</h2><ProfileForm profile={user.profile} /></Card>
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-fg">Security</h2>
            <p className="mt-2 text-sm text-muted">Change your password using a secure email link.</p>
            <ButtonLink href="/forgot-password" variant="secondary" size="sm" className="mt-4">Change password</ButtonLink>
          </Card>
          <Card id="testimonial">
            <h2 className="font-semibold text-fg">Share your experience</h2>
            {completed.length > 0 ? (
              <div className="mt-5"><TestimonialForm projects={completed.map((p) => ({ id: p.id, name: p.name }))} defaultName={user.profile.full_name ?? ""} defaultCompany={user.profile.company_name ?? ""} /></div>
            ) : (
              <p className="mt-2 text-sm text-muted">You can leave a testimonial once a project is completed.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
