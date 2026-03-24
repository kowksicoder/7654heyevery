create or replace function public.list_staff_profile_launches(
  input_session_token text,
  input_profile_id uuid
)
returns table (
  launch_id uuid,
  ticker text,
  name text,
  status text,
  coin_address text,
  created_at timestamptz,
  launched_at timestamptz
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
    launch.launch_id,
    launch.ticker,
    launch.name,
    launch.status::text,
    launch.coin_address,
    launch.created_at,
    launch.launched_at
  from public.list_staff_profile_launches(input_profile_id) as launch;
end;
$$;

create or replace function public.list_staff_coin_launches(
  input_session_token text,
  input_search text default null,
  input_limit integer default 50,
  input_offset integer default 0
)
returns table (
  launch_id uuid,
  creator_id uuid,
  creator_name text,
  creator_username text,
  ticker text,
  name text,
  status text,
  coin_address text,
  cover_image_url text,
  created_at timestamptz,
  launched_at timestamptz,
  is_hidden boolean,
  pinned_slot integer
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
    launch.launch_id,
    launch.creator_id,
    launch.creator_name,
    launch.creator_username,
    launch.ticker,
    launch.name,
    launch.status::text,
    launch.coin_address,
    launch.cover_image_url,
    launch.created_at,
    launch.launched_at,
    launch.is_hidden,
    launch.pinned_slot
  from public.list_staff_coin_launches(input_search, input_limit, input_offset) as launch;
end;
$$;

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
    referral.reward_e1xp,
    referral.referred_trade_count,
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
    earning.item_id,
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
    mission.reward_e1xp,
    mission.task_count,
    mission.participant_count,
    mission.starts_at,
    mission.ends_at
  from public.list_staff_missions() as mission;
end;
$$;
