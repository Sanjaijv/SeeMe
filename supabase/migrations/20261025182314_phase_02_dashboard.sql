create extension if not exists "pgcrypto";

create table public.organizations (
  id text primary key
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  repository_url text not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  status text not null check (status in ('queued', 'running', 'complete', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  path text not null,
  language text,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.edges (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  from_file_id uuid not null,
  to_file_id uuid not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  method text not null,
  path text not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.explanations (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.file_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  file_id uuid not null,
  role text not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

alter table public.analyses
  add constraint analyses_project_organization_fk
  foreign key (project_id, organization_id)
  references public.projects (id, organization_id)
  on delete cascade;

alter table public.files
  add constraint files_analysis_organization_fk
  foreign key (analysis_id, organization_id)
  references public.analyses (id, organization_id)
  on delete cascade;

alter table public.edges
  add constraint edges_analysis_organization_fk
  foreign key (analysis_id, organization_id)
  references public.analyses (id, organization_id)
  on delete cascade,
  add constraint edges_from_file_organization_fk
  foreign key (from_file_id, organization_id)
  references public.files (id, organization_id)
  on delete cascade,
  add constraint edges_to_file_organization_fk
  foreign key (to_file_id, organization_id)
  references public.files (id, organization_id)
  on delete cascade;

alter table public.routes
  add constraint routes_analysis_organization_fk
  foreign key (analysis_id, organization_id)
  references public.analyses (id, organization_id)
  on delete cascade,
  add constraint routes_file_organization_fk
  foreign key (file_id, organization_id)
  references public.files (id, organization_id)
  on delete cascade;

alter table public.explanations
  add constraint explanations_analysis_organization_fk
  foreign key (analysis_id, organization_id)
  references public.analyses (id, organization_id)
  on delete cascade,
  add constraint explanations_file_organization_fk
  foreign key (file_id, organization_id)
  references public.files (id, organization_id)
  on delete cascade;

alter table public.file_roles
  add constraint file_roles_analysis_organization_fk
  foreign key (analysis_id, organization_id)
  references public.analyses (id, organization_id)
  on delete cascade,
  add constraint file_roles_file_organization_fk
  foreign key (file_id, organization_id)
  references public.files (id, organization_id)
  on delete cascade;

alter table public.insights
  add constraint insights_analysis_organization_fk
  foreign key (analysis_id, organization_id)
  references public.analyses (id, organization_id)
  on delete cascade;

create index organizations_id_idx on public.organizations (id);
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

alter table public.organizations enable row level security;
alter table public.projects enable row level security;
alter table public.analyses enable row level security;
alter table public.files enable row level security;
alter table public.edges enable row level security;
alter table public.routes enable row level security;
alter table public.explanations enable row level security;
alter table public.file_roles enable row level security;
alter table public.insights enable row level security;

create policy "Organization members can access organizations"
  on public.organizations for all to authenticated
  using ((select auth.jwt() ->> 'org_id') = id)
  with check ((select auth.jwt() ->> 'org_id') = id);

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

insert into public.organizations (id)
values
  ('org_phase_two_alpha'),
  ('org_phase_two_beta');

insert into public.projects (id, organization_id, name, repository_url)
values
  ('00000000-0000-0000-0000-000000000001', 'org_phase_two_alpha', 'Alpha workspace', 'https://github.com/example/alpha'),
  ('00000000-0000-0000-0000-000000000002', 'org_phase_two_beta', 'Beta workspace', 'https://github.com/example/beta');

insert into public.analyses (organization_id, project_id, status, started_at, completed_at, created_at)
values
  ('org_phase_two_alpha', '00000000-0000-0000-0000-000000000001', 'complete', now() - interval '2 days', now() - interval '2 days' + interval '4 minutes', now() - interval '2 days'),
  ('org_phase_two_alpha', '00000000-0000-0000-0000-000000000001', 'running', now() - interval '8 minutes', null, now() - interval '8 minutes'),
  ('org_phase_two_beta', '00000000-0000-0000-0000-000000000002', 'failed', now() - interval '1 day', now() - interval '1 day' + interval '1 minute', now() - interval '1 day');
