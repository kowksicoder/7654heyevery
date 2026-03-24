create or replace function public.list_staff_referrals(
  input_session_token text,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  referral_event_id uuid,
  referrer_name text,
  referrer_username text,
  referred_name text,
  referred_username text,
  referred_wallet text,
  status text,
  reward_e1xp bigint,
  referred_trade_count bigint,
  joined_at timestamptz,
  rewarded_at timestamptz
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
    referral.referral_event_id,
    referral.referrer_name,
    referral.referrer_username,
    referral.referred_name,
    referral.referred_username,
    referral.referred_wallet,
    referral.status::text,
    referral.reward_e1xp::bigint,
    referral.referred_trade_count::bigint,
    referral.joined_at,
    referral.rewarded_at
  from public.list_staff_referrals(input_limit, input_offset) as referral;
end;
$$;

create or replace function public.list_staff_earnings(
  input_session_token text,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  item_kind text,
  item_id text,
  profile_name text,
  profile_username text,
  wallet_address text,
  amount numeric,
  currency text,
  status text,
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
    earning.item_kind,
    earning.item_id::text,
    earning.profile_name,
    earning.profile_username,
    earning.wallet_address,
    earning.amount,
    earning.currency,
    earning.status::text,
    earning.created_at
  from public.list_staff_earnings(input_limit, input_offset) as earning;
end;
$$;

create or replace function public.list_staff_missions(
  input_session_token text
)
returns table (
  mission_id uuid,
  slug text,
  title text,
  status text,
  reward_e1xp bigint,
  task_count bigint,
  participant_count bigint,
  starts_at timestamptz,
  ends_at timestamptz
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
    mission.mission_id,
    mission.slug,
    mission.title,
    mission.status::text,
    mission.reward_e1xp::bigint,
    mission.task_count::bigint,
    mission.participant_count::bigint,
    mission.starts_at,
    mission.ends_at
  from public.list_staff_missions() as mission;
end;
$$;
