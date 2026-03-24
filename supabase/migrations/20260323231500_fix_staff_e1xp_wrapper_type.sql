create or replace function public.list_staff_e1xp_activity(
  input_session_token text,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  ledger_id uuid,
  profile_id uuid,
  profile_name text,
  profile_username text,
  wallet_address text,
  amount bigint,
  source text,
  description text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1
  from public.get_staff_admin_session(input_session_token);

  return query
  select
    activity.ledger_id,
    activity.profile_id,
    activity.profile_name,
    activity.profile_username,
    activity.wallet_address,
    activity.amount::bigint,
    activity.source,
    activity.description,
    activity.created_at
  from public.list_staff_e1xp_activity(input_limit, input_offset) as activity;
end;
$$;
