import Link from "next/link";
import { FileUpload } from "@/components/app/file-upload";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import type { FileRecord } from "@/lib/types";

function size(n: number) {
  return n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default async function FilesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("files").select("*, projects(name)").eq("owner_id", user.id).order("created_at", { ascending: false });
  const files = (data ?? []) as (FileRecord & { projects: { name: string } | null })[];
  return (
    <>
      <PageHeader title="Files" description="Your uploaded assets and delivered files. Upload project-specific files from the project page." />
      <Card className="mb-6"><FileUpload userId={user.id} /></Card>
      {files.length === 0 ? <EmptyState title="No files yet" /> : (
        <Table>
          <thead><tr><Th>File</Th><Th>Project</Th><Th>Type</Th><Th>Size</Th><Th>Uploaded</Th></tr></thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <Td><a href={`/api/files/${f.id}`} className="text-brand-300 hover:text-brand-200">{f.filename}</a></Td>
                <Td>{f.project_id ? <Link className="hover:text-fg" href={`/dashboard/projects/${f.project_id}`}>{f.projects?.name ?? "Project"}</Link> : "General"}</Td>
                <Td>{f.kind}</Td>
                <Td>{size(f.size_bytes)}</Td>
                <Td>{formatDate(f.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
