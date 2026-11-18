import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { markAllNotificationsRead } from "@/actions/client";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/cn";
import type { Notification } from "@/lib/types";

export async function NotificationsList({ basePath }: { basePath: string }) {
  const user = await requireUser(basePath);
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const items = (data ?? []) as Notification[];
  return (
    <>
      <PageHeader title="Notifications" actions={items.some((n) => !n.read_at) ? <form action={markAllNotificationsRead}><Button type="submit" variant="secondary" size="sm">Mark all as read</Button></form> : undefined} />
      {items.length === 0 ? <EmptyState title="You're all caught up" /> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? basePath} className={cn("glass block rounded-xl p-4 transition hover:border-brand-400/30", !n.read_at && "border-brand-400/30")}>
                <div className="flex items-start justify-between gap-3">
                  <p className={cn("text-sm", n.read_at ? "text-muted" : "font-medium text-fg")}>{n.title}</p>
                  <span className="shrink-0 text-xs text-subtle">{formatDateTime(n.created_at)}</span>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

