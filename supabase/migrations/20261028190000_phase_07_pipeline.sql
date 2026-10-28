alter table public.projects
  add constraint projects_organization_repository_unique unique (organization_id, repository_url);

alter table public.analyses
  add column stage text not null default 'queued',
  add column stage_message text not null default 'Queued.',
  add column error_message text,
  add column commit_sha text,
  add column root text,
  add column coverage jsonb,
  add column skipped jsonb,
  add column adapter text;

alter table public.files
  add column lines integer not null default 0,
  add column hash text,
  add column module_kind text,
  add column adapter_role text,
  add column fan_in integer not null default 0,
  add column fan_out integer not null default 0;

alter table public.edges
  add column kind text not null default 'import',
  add column specifier text not null default '';

alter table public.analyses
  add constraint analyses_stage_check
  check (stage in ('queued', 'fetching', 'selecting', 'parsing', 'storing', 'complete', 'failed'));

create policy "Organization members can create organizations"
  on public.organizations for insert to authenticated
  with check ((select auth.jwt() ->> 'org_id') = id);

create policy "Organization members can create projects"
  on public.projects for insert to authenticated
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can create analyses"
  on public.analyses for insert to authenticated
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can update analyses"
  on public.analyses for update to authenticated
  using ((select auth.jwt() ->> 'org_id') = organization_id)
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can create files"
  on public.files for insert to authenticated
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create policy "Organization members can create edges"
  on public.edges for insert to authenticated
  with check ((select auth.jwt() ->> 'org_id') = organization_id);

create or replace function public.broadcast_analysis_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform realtime.broadcast_changes(
    'analysis:' || new.id::text,
    'stage_changed',
    'analysis_stage',
    new,
    null
  );
  return new;
end;
$$;

revoke execute on function public.broadcast_analysis_stage() from public, anon, authenticated;

create trigger analyses_stage_broadcast
  after update of stage, stage_message on public.analyses
  for each row
  when (old.stage is distinct from new.stage or old.stage_message is distinct from new.stage_message)
  execute function public.broadcast_analysis_stage();

create policy "Organization members can subscribe to analysis stages"
  on realtime.messages for select to authenticated
  using (
    split_part((select realtime.topic()), ':', 1) = 'analysis'
    and exists (
      select 1
      from public.analyses
      where analyses.id::text = split_part((select realtime.topic()), ':', 2)
        and analyses.organization_id = (select auth.jwt() ->> 'org_id')
    )
  );
