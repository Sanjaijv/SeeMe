drop policy if exists "Organization members can subscribe to analysis stages"
  on realtime.messages;

create policy "Organization members can subscribe to analysis stages"
  on realtime.messages for select to authenticated
  using (
    split_part((select realtime.topic()), ':', 1) = 'analysis'
    and exists (
      select 1
      from public.analyses
      where analyses.id::text = split_part((select realtime.topic()), ':', 2)
        and analyses.organization_id = (
          (select current_setting('request.jwt.claims', true)::json ->> 'org_id')
        )
    )
  );
