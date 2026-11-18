-- Pin search_path on the remaining helper functions (Supabase security
-- advisor: function_search_path_mutable). They only use built-in pg_catalog
-- functions, so an empty search_path is safe.
alter function public.set_updated_at() set search_path = '';
alter function public.format_myr(bigint) set search_path = '';
alter function public.split_by_percent(bigint, numeric[]) set search_path = '';
