create or replace function public.broadcast_analysis_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'stage', new.stage,
      'message', new.stage_message
    ),
    'stage_changed',
    'analysis:' || new.id::text,
    true
  );
  return new;
end;
$$;

revoke execute on function public.broadcast_analysis_stage() from public, anon, authenticated;
