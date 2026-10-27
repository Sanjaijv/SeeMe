create extension if not exists "pgcrypto";

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  name text not null,
  repository_url text not null,
  created_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'complete', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  path text not null,
  language text,
  created_at timestamptz not null default now()
);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  from_file_id uuid not null references public.files(id) on delete cascade,
  to_file_id uuid not null references public.files(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  method text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create table public.explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.file_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index projects_organization_id_idx on public.projects (organization_id);
create index analyses_organization_id_created_at_idx on public.analyses (organization_id, created_at desc);
create index analyses_project_id_idx on public.analyses (project_id);
create index files_organization_id_idx on public.files (organization_id);
create index files_analysis_id_idx on public.files (analysis_id);
create index edges_organization_id_idx on public.edges (organization_id);
create index edges_analysis_id_idx on public.edges (analysis_id);
create index edges_from_file_id_idx on public.edges (from_file_id);
create index edges_to_file_id_idx on public.edges (to_file_id);
create index routes_organization_id_idx on public.routes (organization_id);
create index routes_analysis_id_idx on public.routes (analysis_id);
create index routes_file_id_idx on public.routes (file_id);
create index explanations_organization_id_idx on public.explanations (organization_id);
create index explanations_analysis_id_idx on public.explanations (analysis_id);
create index explanations_file_id_idx on public.explanations (file_id);
create index file_roles_organization_id_idx on public.file_roles (organization_id);
create index file_roles_analysis_id_idx on public.file_roles (analysis_id);
create index file_roles_file_id_idx on public.file_roles (file_id);
create index insights_organization_id_idx on public.insights (organization_id);
create index insights_analysis_id_idx on public.insights (analysis_id);

alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.files enable row level security;
alter table public.edges enable row level security;
alter table public.routes enable row level security;
alter table public.explanations enable row level security;
alter table public.file_roles enable row level security;
alter table public.insights enable row level security;

create policy "Organization members can access projects"
  on public.projects for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can access analyses"
  on public.analyses for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can access files"
  on public.files for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can access edges"
  on public.edges for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can access routes"
  on public.routes for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can access explanations"
  on public.explanations for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can access file roles"
  on public.file_roles for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can access insights"
  on public.insights for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

insert into public.projects (id, organization_id, name, repository_url)
values
  ('00000000-0000-0000-0000-000000000001', 'org_phase_two_alpha', 'Alpha workspace', 'https://github.com/example/alpha'),
  ('00000000-0000-0000-0000-000000000002', 'org_phase_two_beta', 'Beta workspace', 'https://github.com/example/beta');

insert into public.analyses (organization_id, project_id, status, started_at, completed_at, created_at)
values
  ('org_phase_two_alpha', '00000000-0000-0000-0000-000000000001', 'complete', now() - interval '2 days', now() - interval '2 days' + interval '4 minutes', now() - interval '2 days'),
  ('org_phase_two_alpha', '00000000-0000-0000-0000-000000000001', 'running', now() - interval '8 minutes', null, now() - interval '8 minutes'),
  ('org_phase_two_beta', '00000000-0000-0000-0000-000000000002', 'failed', now() - interval '1 day', now() - interval '1 day' + interval '1 minute', now() - interval '1 day');
