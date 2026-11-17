import { SendNotificationForm } from "@/components/admin/forms";
import { NotificationsList } from "@/components/app/notifications-list";
import { Card } from "@/components/ui/primitives";
import { SectionTitle } from "@/components/app/bits";
import { createClient } from "@/lib/supabase/server";

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("profiles").select("id,email,full_name,company_name").eq("role", "client").order("full_name");
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div><NotificationsList basePath="/admin" /></div>
      <Card className="h-fit">
        <SectionTitle>Message a client</SectionTitle>
        <SendNotificationForm clients={(clients ?? []).map((c) => ({ id: c.id, label: `${c.full_name ?? c.email}${c.company_name ? ` (${c.company_name})` : ""}` }))} />
      </Card>
    </div>
  );
}
