-- =============================================================================
-- Private storage bucket for client assets and deliverables.
-- Object paths are "<client_user_id>/<project_id|requests>/<uuid>-<filename>".
-- Clients can only read/write under their own user-id folder; admins can
-- access everything. Downloads use short-lived signed URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  26214400, -- 25 MB
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "project files: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'project-files'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "project files: upload own or admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files'
              and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "project files: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
