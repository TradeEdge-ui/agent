"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { registerUploadedFile } from "@/actions/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

const MAX = 25 * 1024 * 1024;
const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

function safeName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-120) || "file";
}

/** Uploads directly from the browser to private storage under the user's own folder. */
export function FileUpload({ userId, projectId }: { userId: string; projectId?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    let ok = 0;
    for (const file of files) {
      if (file.size > MAX) {
        setMsg({ ok: false, text: `${file.name} is larger than 25 MB.` });
        continue;
      }
      const path = `${userId}/${projectId ?? "requests"}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from("project-files").upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) {
        setMsg({ ok: false, text: `${file.name}: ${error.message}` });
        continue;
      }
      const res = await registerUploadedFile({ path, filename: file.name.slice(0, 255), size: file.size, mime: file.type || undefined, project_id: projectId ?? "" });
      if (!res.ok) setMsg({ ok: false, text: res.message ?? "Upload failed" });
      else ok++;
    }
    if (ok) setMsg({ ok: true, text: `${ok} file${ok > 1 ? "s" : ""} uploaded.` });
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={onChange} id={`upload-${projectId ?? "general"}`} />
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : "Upload files"}
      </Button>
      <p className="mt-2 text-xs text-subtle">Images, PDF, Office documents or ZIP · max 25 MB each · stored privately.</p>
      {msg && <Alert tone={msg.ok ? "success" : "danger"} className="mt-3">{msg.text}</Alert>}
    </div>
  );
}
