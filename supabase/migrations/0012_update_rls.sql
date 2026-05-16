-- Inntris BLOCK demo: database policy changes are production-sensitive.
alter table public.demo_accounts enable row level security;
