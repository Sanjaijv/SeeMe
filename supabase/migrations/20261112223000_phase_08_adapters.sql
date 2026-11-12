create policy "Organization members can create routes"
  on public.routes for insert to authenticated
  with check ((select auth.jwt() ->> 'org_id') = organization_id);
