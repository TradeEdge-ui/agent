import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Redirects to a 60-second signed URL after checking access via RLS. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const supabase = await createClient();
  // RLS ensures only the owner (or an admin) can read this row.
  const { data: file } = await supabase.from("files").select("bucket,path,filename").eq("id", id).single();
  if (!file) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await createAdminClient()
    .storage.from(file.bucket)
    .createSignedUrl(file.path, 60, { download: file.filename });
  if (error || !data) return new NextResponse("File unavailable", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
